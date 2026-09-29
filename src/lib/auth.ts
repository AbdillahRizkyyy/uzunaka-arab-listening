import type { NextAuthOptions } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getServerSession } from 'next-auth';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from './db';
import { assert } from './domain';
import { limit } from './security';
export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 7 * 24 * 3600 },
  pages: { signIn: '/akun' },
  providers: [
    Credentials({
      name: 'Email',
      credentials: { email: {}, password: {}, portal: {} },
      async authorize(credentials) {
        const input = z
          .object({
            email: z.string().email(),
            password: z.string().min(1).max(128),
            portal: z.enum(['user', 'admin']).default('user'),
          })
          .parse(credentials);
        const email = input.email.toLowerCase();
        await limit('login:' + email, 10, 900);
        const user = await db.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(
          input.password,
          user?.passwordHash ?? '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxX0OGhBi9eQaBR/JLfCLjBaT2.',
        );
        if (!user || !valid || !user.verifiedAt || user.disabledAt) return null;
        if (input.portal === 'admin' && user.role !== 'admin') return null;
        if (input.portal === 'user' && user.role === 'admin')
          throw new Error('Gunakan halaman login admin.');
        return { id: user.id, name: user.name, email: user.email, authVersion: user.authVersion };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.version = (user as unknown as { authVersion: number }).authVersion;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as unknown as { id: string; version: number }).id = String(token.uid);
        (session.user as unknown as { version: number }).version = Number(token.version);
      }
      return session;
    },
  },
};
export async function currentUser() {
  const session = await getServerSession(authOptions);
  const identity = session?.user as { id?: string; version?: number } | undefined;
  if (!identity?.id) return null;
  const user = await db.user.findUnique({ where: { id: identity.id } });
  return user && user.authVersion === identity.version && user.verifiedAt && !user.disabledAt
    ? user
    : null;
}
export async function requireUser() {
  const user = await currentUser();
  assert(user, 'Silakan masuk terlebih dahulu.', 401);
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  assert(user.role === 'admin', 'Akses admin diperlukan.', 403);
  return user;
}
