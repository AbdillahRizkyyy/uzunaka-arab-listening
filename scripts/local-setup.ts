import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
if (existsSync('.env')) {
  console.log('.env sudah ada; tidak diubah.');
} else {
  let env = await readFile('.env.example', 'utf8');
  env = env.replace(
    'postgresql://istima:istima@localhost:5432/istima',
    'postgresql://istima:istima-local-only@127.0.0.1:55432/istima',
  );
  env = env
    .replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(48).toString('hex'))
    .replace(
      'replace-with-a-different-random-secret-at-least-32-characters',
      randomBytes(48).toString('hex'),
    );
  await writeFile('.env', env, { flag: 'wx' });
  console.log(
    'Konfigurasi lokal dibuat. Rahasia tidak dicetak. SMTP masih perlu disiapkan untuk pendaftaran.',
  );
}
