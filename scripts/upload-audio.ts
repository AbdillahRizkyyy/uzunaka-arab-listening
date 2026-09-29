import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Pemakaian: npm run content:upload -- audio.mp3');
  const base = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket = process.env.SUPABASE_AUDIO_BUCKET ?? 'audio';
  if (!base || !key) throw new Error('Konfigurasi Supabase belum tersedia.');
  const types: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
  };
  const type = types[extname(file).toLowerCase()];
  if (!type) throw new Error('Format audio tidak didukung.');
  const bytes = await readFile(file);
  if (bytes.length > 20 * 1024 * 1024) throw new Error('Ukuran audio maksimum 20 MB.');
  const name = encodeURIComponent(basename(file)),
    url = `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${name}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      apikey: key,
      'Content-Type': type,
      'x-upsert': 'false',
    },
    body: bytes,
  });
  if (!response.ok)
    throw new Error(
      `Upload gagal (${response.status}). Aset lama tidak ditimpa; gunakan nama versi baru.`,
    );
  console.log(`${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${name}`);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
