import type { Media } from './admin-media';

async function responseJson(response: Response) {
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(result?.error || 'Unggahan gagal. Periksa koneksi lalu coba kembali.');
  return result;
}

export async function uploadMedia(file: File, duration: number): Promise<Media> {
  const prepared = await responseJson(
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'prepare', name: file.name, type: file.type, size: file.size, duration }),
    }),
  );
  if (prepared.mode === 'local') {
    const form = new FormData();
    form.append('file', file);
    form.append('duration', String(duration));
    return responseJson(await fetch('/api/admin/media', { method: 'POST', body: form }));
  }
  if (prepared.mode !== 'direct' || !prepared.uploadUrl || !prepared.verificationTicket)
    throw new Error('Konfigurasi unggahan belum tersedia.');
  const uploaded = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
    credentials: 'omit',
  });
  if (!uploaded.ok) throw new Error('File belum berhasil diunggah. Periksa koneksi lalu coba kembali.');
  return responseJson(
    await fetch('/api/admin/media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'finalize', verificationTicket: prepared.verificationTicket }),
    }),
  );
}
