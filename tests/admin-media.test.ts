import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  finalizeMediaUpload,
  listMedia,
  MAX_MEDIA_BYTES,
  prepareMediaUpload,
  saveMedia,
} from '../src/lib/admin-media';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const base = 'https://example.supabase.co/storage/v1/';
const fetchMock = vi.fn<typeof fetch>();
const json = (data: unknown, status = 200) => Response.json(data, { status });
const input = { name: 'صورة تجربة.png', type: 'image/png', size: png.length, duration: 0 };

beforeEach(() => {
  vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-service-key-never-public');
  vi.stubEnv('SUPABASE_AUDIO_BUCKET', 'audio');
  vi.stubEnv('SUPABASE_UPLOAD_BUCKET', 'media-uploads');
  vi.stubEnv('NEXTAUTH_SECRET', 'test-auth-key-at-least-thirty-two-characters');
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function prepare() {
  fetchMock.mockResolvedValueOnce(json({ public: false, file_size_limit: MAX_MEDIA_BYTES }));
  fetchMock.mockImplementationOnce(async (url) =>
    json({
      url: String(url).replace(base, '/') + '?token=signed-upload-token',
    }),
  );
  return prepareMediaUpload(input);
}

describe('durable admin media', () => {
  it('stores the file and its original Unicode name atomically in cloud metadata', async () => {
    fetchMock.mockResolvedValueOnce(json({ Key: 'uploaded' }));
    const result = await saveMedia(png, input.name, 0);
    expect(result.url).toMatch(
      /^https:\/\/example.supabase.co\/storage\/v1\/object\/public\/audio\/admin\/[a-f0-9-]+\.png$/,
    );
    expect(result.name).toBe(input.name);
    expect(JSON.stringify(result)).not.toContain('test-service-key');
    const request = fetchMock.mock.calls[0][1]!;
    const headers = request.headers as Record<string, string>;
    expect(headers['x-upsert']).toBe('false');
    expect(JSON.parse(Buffer.from(headers['x-metadata'], 'base64').toString()).uzunaka.name).toBe(
      input.name,
    );
    expect(request.redirect).toBe('error');
  });

  it('reports a failed cloud write rather than claiming the file was saved', async () => {
    fetchMock.mockResolvedValueOnce(json({ message: 'private-internal-key' }, 503));
    await expect(saveMedia(png, 'image.png', 0)).rejects.toThrow(
      'Penyimpanan media belum tersedia',
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed in production when cloud storage has not been configured', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    await expect(saveMedia(png, 'image.png', 0)).rejects.toThrow('belum dikonfigurasi');
    await expect(listMedia()).rejects.toThrow('belum dikonfigurasi');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists metadata on older Storage versions without exposing credentials or trusting metadata URLs', async () => {
    const filename = '11111111-1111-4111-a111-111111111111.png';
    fetchMock.mockResolvedValueOnce(json([{ name: filename }, { name: '../unrelated-file' }]));
    fetchMock.mockResolvedValueOnce(
      json({
        user_metadata: {
          uzunaka: {
            name: input.name,
            type: 'image/png',
            kind: 'image',
            duration: 0,
            size: png.length,
            createdAt: '2026-09-30T00:00:00.000Z',
            url: 'https://untrusted.invalid/',
          },
        },
      }),
    );
    const media = await listMedia();
    expect(media).toHaveLength(1);
    expect(media[0].url).toBe(base + 'object/public/audio/admin/' + filename);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('validates unsupported data before making external requests', async () => {
    await expect(
      saveMedia(Buffer.from('<script>alert(1)</script>'), 'fake.png', 0),
    ).rejects.toThrow('Format');
    await expect(prepareMediaUpload({ ...input, size: MAX_MEDIA_BYTES + 1 })).rejects.toThrow();
    await expect(prepareMediaUpload({ ...input, type: 'image/svg+xml' })).rejects.toThrow('Format');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('direct browser upload', () => {
  it('returns only a scoped upload URL and signed verification ticket', async () => {
    const prepared = await prepare();
    expect(prepared.uploadUrl).toMatch(
      /^https:\/\/example.supabase.co\/storage\/v1\/object\/upload\/sign\/media-uploads\/[a-f0-9-]+\.png\?token=/,
    );
    expect(prepared.verificationTicket.split('.')).toHaveLength(2);
    expect(JSON.stringify(prepared)).not.toContain('test-service-key');
  });

  it('refuses a public pending bucket or an unbounded bucket', async () => {
    fetchMock.mockResolvedValueOnce(json({ public: true, file_size_limit: MAX_MEDIA_BYTES }));
    await expect(prepareMediaUpload(input)).rejects.toThrow('harus privat');
    fetchMock.mockResolvedValueOnce(json({ public: false, file_size_limit: null }));
    await expect(prepareMediaUpload(input)).rejects.toThrow('maksimal 20 MB');
  });

  it('rejects a tampered or expired verification ticket before accessing Storage', async () => {
    const prepared = await prepare();
    fetchMock.mockClear();
    await expect(finalizeMediaUpload(prepared.verificationTicket + 'x')).rejects.toThrow(
      'Tiket upload tidak valid',
    );
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 21 * 60 * 1000);
    await expect(finalizeMediaUpload(prepared.verificationTicket)).rejects.toThrow('kedaluwarsa');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates downloaded bytes, publishes once, and cleans up the private temporary file', async () => {
    const prepared = await prepare();
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({}, 404));
    fetchMock.mockResolvedValueOnce(new Response(png));
    fetchMock.mockResolvedValueOnce(json({ Key: 'published' }));
    fetchMock.mockResolvedValueOnce(json([]));
    const media = await finalizeMediaUpload(prepared.verificationTicket);
    expect(media.kind).toBe('image');
    expect(media.url).toContain('/object/public/audio/admin/');
    expect(fetchMock.mock.calls[2][1]?.method).toBe('POST');
    expect(fetchMock.mock.calls[3][1]?.method).toBe('DELETE');
    expect(fetchMock.mock.calls[3][0]).toBe(base + 'object/media-uploads');

    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({ user_metadata: { uzunaka: media } }));
    expect(await finalizeMediaUpload(prepared.verificationTicket)).toEqual(media);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not publish spoofed file bytes and cleans up invalid input', async () => {
    const prepared = await prepare();
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({}, 404));
    fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(png.length, 1)));
    fetchMock.mockResolvedValueOnce(json([]));
    await expect(finalizeMediaUpload(prepared.verificationTicket)).rejects.toThrow(
      'Isi file tidak sesuai',
    );
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/object/audio/'))).toBe(
      false,
    );
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
  });

  it('bounds streaming reads even when Content-Length is absent', async () => {
    const prepared = await prepare();
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({}, 404));
    fetchMock.mockResolvedValueOnce(new Response(Buffer.alloc(png.length + 1)));
    fetchMock.mockResolvedValueOnce(json([]));
    await expect(finalizeMediaUpload(prepared.verificationTicket)).rejects.toThrow(
      'Ukuran file upload tidak sesuai',
    );
    expect(fetchMock.mock.calls[2][1]?.method).toBe('DELETE');
  });

  it('preserves a valid pending file when publishing temporarily fails', async () => {
    const prepared = await prepare();
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce(json({}, 404));
    fetchMock.mockResolvedValueOnce(new Response(png));
    fetchMock.mockResolvedValueOnce(json({}, 503));
    await expect(finalizeMediaUpload(prepared.verificationTicket)).rejects.toThrow(
      'Penyimpanan media belum tersedia',
    );
    expect(fetchMock.mock.calls.some(([, request]) => request?.method === 'DELETE')).toBe(false);
  });
});
