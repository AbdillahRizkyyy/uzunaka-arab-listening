import { createHash, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { atomic } from './db';
import { assert } from './domain';
export const hash = (s: string) => createHash('sha256').update(s).digest('hex');
export const token = () => randomBytes(32).toString('base64url');
export async function limit(key: string, max = 20, seconds = 60) {
  await atomic(async (tx) => {
    const old = await tx.rateLimit.findUnique({ where: { key } }),
      now = new Date();
    if (!old || old.expiresAt <= now)
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, expiresAt: new Date(+now + seconds * 1000) },
        update: { count: 1, expiresAt: new Date(+now + seconds * 1000) },
      });
    else {
      assert(old.count < max, 'Terlalu banyak permintaan. Coba lagi nanti.', 429);
      await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
    }
  }, 'rate:' + key);
}
function secret() {
  const s = process.env.SOCKET_SECRET;
  assert(s && s.length >= 32, 'Konfigurasi koneksi live belum siap.', 503);
  return s;
}
export function issueTicket(subject: { userId?: string; participantId?: string; roomId: string }) {
  const payload = Buffer.from(JSON.stringify({ ...subject, expires: Date.now() + 60000 })).toString(
    'base64url',
  );
  return payload + '.' + createHmac('sha256', secret()).update(payload).digest('base64url');
}
export function readTicket(ticket: string): {
  userId?: string;
  participantId?: string;
  roomId: string;
  expires: number;
} {
  const [payload, signature] = ticket.split('.');
  assert(payload && signature, 'Tiket tidak valid.', 401);
  const expected = createHmac('sha256', secret()).update(payload).digest(),
    actual = Buffer.from(signature, 'base64url');
  assert(
    actual.length === expected.length && timingSafeEqual(actual, expected),
    'Tiket tidak valid.',
    401,
  );
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  assert(data.expires > Date.now(), 'Tiket kedaluwarsa.', 401);
  return data;
}
