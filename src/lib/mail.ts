import nodemailer from 'nodemailer';
import { assert } from './domain';
import { settings } from './admin-controls';
export async function sendToken(email: string, kind: 'verify' | 'reset', token: string) {
  assert(
    process.env.SMTP_HOST && process.env.MAIL_FROM && process.env.APP_URL,
    'Layanan email belum dikonfigurasi.',
    503,
  );
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  const link = `${process.env.APP_URL}/akun?mode=${kind}&token=${encodeURIComponent(token)}`;
  const { name } = await settings();
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to: email,
    subject: kind === 'verify' ? `Verifikasi akun ${name}` : `Atur ulang password ${name}`,
    text: `${kind === 'verify' ? 'Verifikasi akun Anda' : 'Atur ulang password Anda'} melalui tautan berikut. Berlaku 1 jam.\n\n${link}\n\nAbaikan email jika Anda tidak meminta tindakan ini.`,
  });
}
