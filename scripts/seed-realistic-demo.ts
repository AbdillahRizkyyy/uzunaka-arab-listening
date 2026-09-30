import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { db, json } from '../src/lib/db';
import { questionSchema } from '../src/lib/contracts';
import { allowsDemoContent } from '../src/lib/environment';
import { realisticDemoQuestions, type DemoManifest } from './demo-questions';

async function main() {
  const database = new URL(process.env.DATABASE_URL!);
  if (!allowsDemoContent() || !['localhost', '127.0.0.1'].includes(database.hostname))
    throw new Error('Gunakan seed-staging untuk demo cloud. Perintah ini hanya untuk development lokal.');
  const manifest: DemoManifest = JSON.parse(
    await readFile('public/media/demo-arabic/manifest.json', 'utf8'),
  );
  const unitId = 'demo-arabic-daily';
  await db.unit.upsert({
    where: { id: unitId },
    create: {
      id: unitId,
      level: 1,
      title: 'Kegiatan sehari-hari · Demo audio Arab',
      theme: 'Kalimat sederhana, benda, dan bunyi',
      description: '10 soal dengan audio Arab sintetis untuk mencoba seluruh tipe soal. Demo; belum ditinjau pengajar.',
      developmentOnly: true,
    },
    update: { developmentOnly: true },
  });
  for (const [position, source] of realisticDemoQuestions(manifest).entries()) {
    const q = questionSchema.parse(source);
    await db.question.upsert({
      where: { id: q.id },
      create: { id: q.id, unitId, level: 1, pool: 'practice', status: 'published', position, data: json(q) },
      update: {},
    });
  }
  console.log('Paket demo Arab siap. Perubahan admin sebelumnya tidak ditimpa.');
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => db.$disconnect());
