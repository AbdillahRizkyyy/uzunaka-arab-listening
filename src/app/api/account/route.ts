import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { atomic, db } from '@/lib/db';
import { body, failure } from '@/lib/http';
import { assert } from '@/lib/domain';
import { hash, limit, token } from '@/lib/security';
import { sendToken } from '@/lib/mail';
import { requireUser } from '@/lib/auth';
const password = z.string().min(12, 'Password minimal 12 karakter.').max(128);
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('register'),
    name: z.string().trim().min(2).max(60),
    email: z.string().email().max(254),
    password,
  }),
  z.object({ action: z.enum(['forgot', 'resend']), email: z.string().email().max(254) }),
  z.object({ action: z.literal('verify'), token: z.string().min(20).max(200) }),
  z.object({ action: z.literal('reset'), token: z.string().min(20).max(200), password }),
  z.object({ action: z.literal('delete'), password: z.string().max(128) }),
]);
export async function POST(request: NextRequest) {
  try {
    const data = schema.parse(await body(request));
    if (data.action === 'delete') {
      const user = await requireUser();
      assert(await bcrypt.compare(data.password, user.passwordHash), 'Password tidak sesuai.');
      await atomic(async (tx) => {
        await tx.participant.updateMany({
          where: { userId: user.id },
          data: { name: 'Akun dihapus' },
        });
        await tx.user.delete({ where: { id: user.id } });
      });
      return NextResponse.json({ message: 'Akun telah dihapus.' });
    }
    if (data.action === 'verify' || data.action === 'reset') {
      await limit('token:' + hash(data.token), 5, 3600);
      const passwordHash =
        data.action === 'reset' ? await bcrypt.hash(data.password, 12) : undefined;
      await atomic(async (tx) => {
        const record = await tx.authToken.findUnique({ where: { hash: hash(data.token) } });
        assert(
          record && record.expiresAt > new Date() && record.kind === data.action,
          'Tautan tidak valid atau kedaluwarsa.',
        );
        await tx.user.update({
          where: { id: record.userId },
          data:
            data.action === 'verify'
              ? { verifiedAt: new Date() }
              : { passwordHash, authVersion: { increment: 1 } },
        });
        await tx.authToken.deleteMany({ where: { userId: record.userId, kind: data.action } });
      });
      return NextResponse.json({
        message:
          data.action === 'verify'
            ? 'Email terverifikasi. Silakan masuk.'
            : 'Password diperbarui. Silakan masuk.',
      });
    }
    const email = data.email.toLowerCase();
    await limit('email:' + email, 4, 3600);
    await limit('mail-global', 100, 3600);
    let user = await db.user.findUnique({ where: { email } });
    if (data.action === 'register' && !user)
      user = await db.user.create({
        data: { email, name: data.name, passwordHash: await bcrypt.hash(data.password, 12) },
      });
    const kind = data.action === 'forgot' ? 'reset' : 'verify';
    if (user && (kind === 'reset' || !user.verifiedAt)) {
      const raw = token();
      await db.authToken.create({
        data: { hash: hash(raw), userId: user.id, kind, expiresAt: new Date(Date.now() + 3600000) },
      });
      await sendToken(email, kind, raw);
    }
    return NextResponse.json({
      message: 'Jika alamat email memenuhi syarat, tautan telah dikirim. Periksa kotak masuk Anda.',
    });
  } catch (e) {
    return failure(e);
  }
}
