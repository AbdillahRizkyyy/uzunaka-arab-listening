import { resolve } from 'node:path';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { assert } from './domain';
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
  assert(
    process.env.NODE_ENV !== 'production',
    'Penyimpanan media lokal tersedia saat development.',
  );
  assert(bytes.length > 0 && bytes.length <= 20 * 1024 * 1024, 'Ukuran file maksimal 20 MB.');
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
  await mkdir(mediaDirectory, { recursive: true });
  await writeFile(resolve(mediaDirectory, filename), bytes, { flag: 'wx' });
  await writeFile(resolve(mediaDirectory, filename + '.json'), JSON.stringify(media), {
    flag: 'wx',
  });
  return media;
}
