import { assert } from './domain';

export type StorageConfig = { base: string; key: string; bucket: string; uploadBucket: string };

export function cloudMediaEnabled() {
  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function storageConfig(): StorageConfig {
  assert(typeof window === 'undefined', 'Penyimpanan hanya tersedia di server.', 503);
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  assert(base && key, 'Penyimpanan media Supabase belum dikonfigurasi.', 503);
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    throw new Error('SUPABASE_URL tidak valid.');
  }
  assert(
    (url.protocol === 'https:' ||
      (process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname))) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      url.pathname === '/',
    'SUPABASE_URL harus berupa origin HTTPS.',
    503,
  );
  const bucket = process.env.SUPABASE_AUDIO_BUCKET || 'audio';
  const uploadBucket = process.env.SUPABASE_UPLOAD_BUCKET || 'media-uploads';
  assert(
    [bucket, uploadBucket].every((value) => /^[a-zA-Z0-9_-]{1,100}$/.test(value)),
    'Nama bucket media tidak valid.',
    503,
  );
  assert(bucket !== uploadBucket, 'Bucket media publik dan upload privat harus berbeda.', 503);
  return { base: url.origin, key, bucket, uploadBucket };
}

export function storagePath(bucket: string, path: string) {
  return [bucket, ...path.split('/')].map(encodeURIComponent).join('/');
}

export function publicMediaUrl(config: StorageConfig, path: string) {
  return `${config.base}/storage/v1/object/public/${storagePath(config.bucket, path)}`;
}

// Credentials stay on the server; redirects must never forward the service role key.
export async function storageRequest(config: StorageConfig, path: string, init: RequestInit = {}) {
  return fetch(`${config.base}/storage/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.key}`,
      apikey: config.key,
      ...init.headers,
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(60000),
  });
}

export async function requireStorageResponse(response: Response) {
  assert(response.ok, 'Penyimpanan media belum tersedia. Coba lagi sebentar.', 503);
  return response;
}

export async function removePending(config: StorageConfig, path: string) {
  const response = await storageRequest(
    config,
    `object/${encodeURIComponent(config.uploadBucket)}`,
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: [path] }),
    },
  );
  await requireStorageResponse(response);
}
