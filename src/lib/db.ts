import { PrismaClient, Prisma } from '@prisma/client';
const globalDb = globalThis as unknown as { prisma?: PrismaClient };
function datasourceUrl() {
  const value = process.env.DATABASE_URL;
  if (!value || !['staging', 'production'].includes(process.env.APP_ENV ?? '')) return value;
  try {
    const url = new URL(value);
    // Vercel creates many short-lived instances. One connection per instance
    // prevents a burst of admin page loads from exhausting Supavisor's pool.
    url.searchParams.set('connection_limit', '1');
    url.searchParams.set('pool_timeout', '20');
    return url.toString();
  } catch {
    return value;
  }
}
export const db = globalDb.prisma ?? new PrismaClient({ datasourceUrl: datasourceUrl() });
if (process.env.NODE_ENV !== 'production') globalDb.prisma = db;
export type Tx = Prisma.TransactionClient;
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const queues = new Map<string, Promise<unknown>>();
// Locks are shared by HTTP and socket workers. Independent rooms never block
// one another; global capacity creation keeps a dedicated shared lock.
export function atomic<T>(fn: (tx: Tx) => Promise<T>, key = 'global-capacity', sharedKeys:string[] = []) {
  const previous = queues.get(key) ?? Promise.resolve();
  const work = previous
    .catch(() => {})
    .then(() =>
      db.$transaction(
        async (tx) => {
          for(const shared of sharedKeys)await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(hashtext(${shared}))`;
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
          return fn(tx);
        },
        { maxWait: 10000, timeout: 15000 },
      ),
    );
  queues.set(key, work);
  void work
    .finally(() => {
      if (queues.get(key) === work) queues.delete(key);
    })
    .catch(() => {});
  return work;
}
