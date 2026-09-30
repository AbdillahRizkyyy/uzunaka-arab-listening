import { resolve } from 'node:path';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError, assert } from './domain';
import {
  cloudMediaEnabled,
  storageConfig,
  storagePath,
  publicMediaUrl,
  storageRequest,
  requireStorageResponse,
  removePending,
  type StorageConfig,
} from './supabase-storage';
export { cloudMediaEnabled } from './supabase-storage';
export type Media = {
  url: string;
  name: string;
  kind: 'audio' | 'image';
  type: string;
  duration: number;
  size: number;
  createdAt: string;
};
export const mediaDirectory = resolve(process.cwd(), '.local-runtime', 'admin-media');
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;
const mediaSchema = z.object({
  name: z.string().max(200),
  kind: z.enum(['audio', 'image']),
  type: z.string(),
  duration: z.number().min(0).max(180),
  size: z.number().int().positive().max(MAX_MEDIA_BYTES),
  createdAt: z.iso.datetime(),
});
const filenamePattern = /^[a-f0-9-]{36}\.(wav|mp3|m4a|webm|ogg|png|jpg|webp)$/;
const mimeFormats: Record<string, { ext: string; type: string; kind: Media['kind'] }> = {
  'audio/mpeg': { ext: 'mp3', type: 'audio/mpeg', kind: 'audio' },
  'audio/mp3': { ext: 'mp3', type: 'audio/mpeg', kind: 'audio' },
  'audio/wav': { ext: 'wav', type: 'audio/wav', kind: 'audio' },
  'audio/x-wav': { ext: 'wav', type: 'audio/wav', kind: 'audio' },
  'audio/ogg': { ext: 'ogg', type: 'audio/ogg', kind: 'audio' },
  'audio/mp4': { ext: 'm4a', type: 'audio/mp4', kind: 'audio' },
  'audio/x-m4a': { ext: 'm4a', type: 'audio/mp4', kind: 'audio' },
  'audio/webm': { ext: 'webm', type: 'audio/webm', kind: 'audio' },
  'image/png': { ext: 'png', type: 'image/png', kind: 'image' },
  'image/jpeg': { ext: 'jpg', type: 'image/jpeg', kind: 'image' },
  'image/webp': { ext: 'webp', type: 'image/webp', kind: 'image' },
};
export function detectMedia(b: Buffer): { ext: string; type: string; kind: Media['kind'] } | null {
  const head = b.subarray(0, 16);
  if (head.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return { ext: 'png', type: 'image/png', kind: 'image' };
  if (head[0] === 255 && head[1] === 216 && head[2] === 255)
    return { ext: 'jpg', type: 'image/jpeg', kind: 'image' };
  if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP')
    return { ext: 'webp', type: 'image/webp', kind: 'image' };
  if (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WAVE')
    return { ext: 'wav', type: 'audio/wav', kind: 'audio' };
  if (head.toString('ascii', 0, 3) === 'ID3' || (head[0] === 255 && (head[1] & 0xe0) === 0xe0))
    return { ext: 'mp3', type: 'audio/mpeg', kind: 'audio' };
  if (head.toString('ascii', 0, 4) === 'OggS')
    return { ext: 'ogg', type: 'audio/ogg', kind: 'audio' };
  if (head.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163])))
    return { ext: 'webm', type: 'audio/webm', kind: 'audio' };
  if (head.toString('ascii', 4, 8) === 'ftyp')
    return { ext: 'm4a', type: 'audio/mp4', kind: 'audio' };
  return null;
}
export async function listMedia(): Promise<Media[]> {
  if (cloudMediaEnabled()) return listCloudMedia(storageConfig());
  assert(
    process.env.NODE_ENV !== 'production',
    'Penyimpanan media Supabase belum dikonfigurasi.',
    503,
  );
  await mkdir(mediaDirectory, { recursive: true });
  const names = (await readdir(mediaDirectory)).filter((n) => n.endsWith('.json'));
  return (
    await Promise.all(
      names.map(
        async (n) => JSON.parse(await readFile(resolve(mediaDirectory, n), 'utf8')) as Media,
      ),
    )
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function saveMedia(bytes: Buffer, name: string, duration: number) {
  assert(bytes.length > 0 && bytes.length <= MAX_MEDIA_BYTES, 'Ukuran file maksimal 20 MB.');
  const format = detectMedia(bytes);
  assert(format, 'Format tidak didukung. Gunakan MP3, WAV, OGG, M4A, WebM, PNG, JPG, atau WebP.');
  assert(
    format.kind !== 'audio' || (Number.isFinite(duration) && duration > 0 && duration <= 180),
    'Audio harus berdurasi 1–180 detik.',
  );
  const filename = randomUUID() + '.' + format.ext;
  const media: Media = {
    url: '/media/uploads/' + filename,
    name: name.slice(0, 200),
    kind: format.kind,
    type: format.type,
    duration: format.kind === 'audio' ? duration : 0,
    size: bytes.length,
    createdAt: new Date().toISOString(),
  };
  if (cloudMediaEnabled()) {
    const config = storageConfig();
    return uploadCloudMedia(config, filename, bytes, media);
  }
  assert(
    process.env.NODE_ENV !== 'production',
    'Penyimpanan media Supabase belum dikonfigurasi.',
    503,
  );
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(resolve(mediaDirectory, filename), bytes, { flag: 'wx' });
  await writeFile(resolve(mediaDirectory, filename + '.json'), JSON.stringify(media), {
    flag: 'wx',
  });
  return media;
}

async function uploadCloudMedia(
  config: StorageConfig,
  filename: string,
  bytes: Buffer,
  media: Media,
) {
  const url = publicMediaUrl(config, 'admin/' + filename);
  const { url: _localUrl, ...metadata } = media;
  const response = await storageRequest(
    config,
    `object/${storagePath(config.bucket, 'admin/' + filename)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': media.type,
        'Cache-Control': 'max-age=31536000',
        'x-upsert': 'false',
        'x-metadata': Buffer.from(JSON.stringify({ uzunaka: metadata })).toString('base64'),
      },
      body: new Uint8Array(bytes),
    },
  );
  // A repeated finalization refers to exactly the same immutable destination.
  if (response.status === 409 || response.status === 400) {
    const existing = await readCloudMedia(config, filename);
    if (existing && existing.size === media.size && existing.type === media.type) return existing;
  }
  await requireStorageResponse(response);
  return { ...media, url };
}

async function readCloudMedia(config: StorageConfig, filename: string): Promise<Media | null> {
  const response = await storageRequest(
    config,
    `object/info/${storagePath(config.bucket, 'admin/' + filename)}`,
  );
  if (response.status === 404) return null;
  // Supabase versions may return HTTP400 with a structured404 for a missing object.
  if (response.status === 400) {
    const error = await response
      .clone()
      .json()
      .catch(() => null);
    if (String(error?.statusCode) === '404' || error?.error === 'not_found') return null;
  }
  await requireStorageResponse(response);
  const object = await response.json();
  const result = mediaSchema.safeParse(object.user_metadata?.uzunaka);
  if (!result.success) return null;
  return { ...result.data, url: publicMediaUrl(config, 'admin/' + filename) };
}

async function listCloudMedia(config: StorageConfig) {
  const media: Media[] = [];
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const response = await storageRequest(
      config,
      `object/list/${encodeURIComponent(config.bucket)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: 'admin',
          limit: pageSize,
          offset,
          sortBy: { column: 'name', order: 'asc' },
        }),
      },
    );
    await requireStorageResponse(response);
    const objects: { name: string; user_metadata?: { uzunaka?: unknown } }[] =
      await response.json();
    assert(Array.isArray(objects), 'Daftar media tidak tersedia.', 503);
    const files = objects.filter((object) => filenamePattern.test(object.name));
    // Older Storage list APIs omit custom metadata; info returns the durable record.
    for (let index = 0; index < files.length; index += 8) {
      const batch = await Promise.all(
        files.slice(index, index + 8).map(async (object) => {
          const parsed = mediaSchema.safeParse(object.user_metadata?.uzunaka);
          return parsed.success
            ? { ...parsed.data, url: publicMediaUrl(config, 'admin/' + object.name) }
            : readCloudMedia(config, object.name);
        }),
      );
      media.push(...batch.filter((value): value is Media => Boolean(value)));
    }
    if (objects.length < pageSize) break;
  }
  return media.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const uploadInputSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().max(100),
  size: z.number().int().positive().max(MAX_MEDIA_BYTES),
  duration: z.number().min(0).max(180),
});
const ticketSchema = uploadInputSchema.extend({
  filename: z.string().regex(filenamePattern),
  expires: z.number(),
  purpose: z.literal('admin-media-upload-v1'),
  createdAt: z.iso.datetime(),
  bucket: z.string(),
  uploadBucket: z.string(),
});
function ticketSignature(payload: string) {
  const secret = process.env.NEXTAUTH_SECRET;
  assert(secret && secret.length >= 32, 'Konfigurasi upload belum tersedia.', 503);
  return createHmac('sha256', secret)
    .update('admin-media:' + payload)
    .digest();
}

export async function prepareMediaUpload(input: {
  name: string;
  type: string;
  size: number;
  duration: number;
}) {
  const data = uploadInputSchema.parse(input);
  const format = mimeFormats[data.type.split(';')[0].trim().toLowerCase()];
  assert(format, 'Format media tidak didukung.');
  assert(format.kind !== 'audio' || data.duration > 0, 'Audio harus berdurasi 1–180 detik.');
  const config = storageConfig();
  const bucketResponse = await storageRequest(
    config,
    `bucket/${encodeURIComponent(config.uploadBucket)}`,
  );
  await requireStorageResponse(bucketResponse);
  const bucket = await bucketResponse.json();
  assert(bucket.public === false, 'Bucket upload sementara harus privat.', 503);
  assert(
    Number(bucket.file_size_limit) > 0 && Number(bucket.file_size_limit) <= MAX_MEDIA_BYTES,
    'Batas ukuran bucket upload harus maksimal 20 MB.',
    503,
  );
  const filename = randomUUID() + '.' + format.ext;
  const payload = Buffer.from(
    JSON.stringify({
      ...data,
      type: format.type,
      filename,
      expires: Date.now() + 20 * 60 * 1000,
      createdAt: new Date().toISOString(),
      purpose: 'admin-media-upload-v1',
      bucket: config.bucket,
      uploadBucket: config.uploadBucket,
    }),
  ).toString('base64url');
  const verificationTicket = payload + '.' + ticketSignature(payload).toString('base64url');
  const response = await storageRequest(
    config,
    `object/upload/sign/${storagePath(config.uploadBucket, filename)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-upsert': 'false' },
      body: '{}',
    },
  );
  await requireStorageResponse(response);
  const signed = await response.json();
  assert(typeof signed.url === 'string', 'URL upload tidak tersedia.', 503);
  const uploadUrl = new URL(config.base + '/storage/v1' + signed.url);
  assert(
    uploadUrl.origin === config.base && uploadUrl.searchParams.has('token'),
    'URL upload tidak valid.',
    503,
  );
  return { uploadUrl: uploadUrl.toString(), verificationTicket };
}

export async function finalizeMediaUpload(ticket: string): Promise<Media> {
  assert(typeof ticket === 'string' && ticket.length <= 5000, 'Tiket upload tidak valid.', 401);
  const parts = ticket.split('.');
  assert(parts.length === 2, 'Tiket upload tidak valid.', 401);
  const [payload, signature] = parts;
  const expected = ticketSignature(payload),
    actual = Buffer.from(signature, 'base64url');
  assert(
    actual.length === expected.length && timingSafeEqual(actual, expected),
    'Tiket upload tidak valid.',
    401,
  );
  const data = ticketSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  assert(data.expires > Date.now(), 'Tiket upload kedaluwarsa. Unggah kembali file.', 401);
  const config = storageConfig();
  assert(
    data.bucket === config.bucket && data.uploadBucket === config.uploadBucket,
    'Tiket upload tidak valid.',
    401,
  );
  const existing = await readCloudMedia(config, data.filename);
  if (existing) return existing;
  const response = await storageRequest(
    config,
    `object/${storagePath(config.uploadBucket, data.filename)}`,
  );
  await requireStorageResponse(response);
  const reader = response.body?.getReader();
  assert(reader, 'File upload belum tersedia.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let discardPending = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      assert(size <= MAX_MEDIA_BYTES && size <= data.size, 'Ukuran file upload tidak sesuai.');
      chunks.push(value);
    }
    assert(size === data.size, 'Ukuran file upload tidak sesuai.');
    const bytes = Buffer.concat(chunks);
    const format = detectMedia(bytes);
    assert(format && format.type === data.type, 'Isi file tidak sesuai dengan format media.');
    const media: Media = {
      url: '',
      name: data.name,
      kind: format.kind,
      type: format.type,
      duration: format.kind === 'audio' ? data.duration : 0,
      size,
      createdAt: data.createdAt,
    };
    const saved = await uploadCloudMedia(config, data.filename, bytes, media);
    discardPending = true;
    return saved;
  } catch (error) {
    // Keep valid pending files if Storage is temporarily unavailable so finalization can retry.
    discardPending = error instanceof AppError && error.status < 500;
    throw error;
  } finally {
    await reader.cancel().catch(() => undefined);
    // Failed cleanup must not turn an already committed upload into a client error.
    if (discardPending)
      await removePending(config, data.filename).catch(() =>
        console.warn('media_pending_cleanup_failed'),
      );
  }
}
