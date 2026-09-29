import 'dotenv/config';
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
const directory = resolve('.local-postgres');
const connection = new URL(process.env.DATABASE_URL ?? 'postgresql://localhost:55432/istima');
if (!['localhost', '127.0.0.1'].includes(connection.hostname))
  throw new Error('local:db hanya untuk DATABASE_URL lokal.');
const port = Number(connection.port || 55432);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Port database lokal tidak valid.');
const pg = new EmbeddedPostgres({
  databaseDir: directory,
  user: 'istima',
  password: 'istima-local-only',
  port,
  persistent: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
if (!existsSync(resolve(directory, 'PG_VERSION'))) await pg.initialise();
await pg.start();
const client = pg.getPgClient('postgres', '127.0.0.1');
await client.connect();
for (const name of ['istima', 'istima_test']) {
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname=$1', [name]);
  if (!result.rowCount) await client.query('CREATE DATABASE ' + name);
}
await client.end();
console.log(`Local PostgreSQL ready at 127.0.0.1:${port} (istima and istima_test).`);
const keepAlive = setInterval(() => {}, 60000);
async function stop() {
  clearInterval(keepAlive);
  await pg.stop();
  process.exit(0);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
