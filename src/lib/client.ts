export async function api<T = any>(
  path: string,
  data?: unknown,
  participantToken?: string,
): Promise<T> {
  const response = await fetch('/api/platform/' + path, {
    method: data === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(participantToken ? { 'x-participant-token': participantToken } : {}),
    },
    body: data === undefined ? undefined : JSON.stringify(data),
    cache: 'no-store',
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? 'Permintaan gagal.');
  return payload;
}
