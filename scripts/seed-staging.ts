import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { db, json } from '../src/lib/db';
import { saveMedia } from '../src/lib/admin-media';
import { CONFIG_VERSION, questionSchema } from '../src/lib/contracts';
import { realisticDemoQuestions, type DemoManifest } from './demo-questions';
import { fixtureTone, stagingCredentials, stagingQuestions, stagingUnits } from './staging-fixtures';

async function uploadFixtureAssets() {
  const one = fixtureTone(1), two = fixtureTone(2);
  const circleImage = async (count: 1 | 2) => {
    const shapes = count === 1 ? '<circle cx="120" cy="90" r="35"/>'
      : '<circle cx="70" cy="90" r="30"/><circle cx="170" cy="90" r="30"/>';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180"><rect width="240" height="180" rx="20" fill="#fbfaf5"/><g fill="#064d3c">${shapes}</g></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    return saveMedia(png, `staging-count-${count}.png`, 0);
  };
  const audioOne = await saveMedia(one.bytes, 'staging-one-tone.wav', one.duration);
  const audioTwo = await saveMedia(two.bytes, 'staging-two-tones.wav', two.duration);
  const imageOne = await circleImage(1), imageTwo = await circleImage(2);
  return { one: audioOne.url, two: audioTwo.url, imageOne: imageOne.url, imageTwo: imageTwo.url };
}

async function uploadArabicDemo() {
  const folder = join(process.cwd(), 'public', 'media', 'demo-arabic');
  const manifest: DemoManifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8'));
  const images: Record<string, string> = {};
  for (const name of ['pen', 'book', 'water', 'milk']) {
    const png = await sharp(await readFile(join(folder, `${name}.svg`))).png().toBuffer();
    images[name] = (await saveMedia(png, `staging-arabic-${name}.png`, 0)).url;
  }
  for (const [name, clip] of Object.entries(manifest)) {
    if (!/^[a-z]+$/.test(name)) throw new Error('Nama aset demo tidak valid.');
    const media = await saveMedia(await readFile(join(folder, `${name}.mp3`)), `staging-arabic-${name}.mp3`, clip.duration);
    clip.url = media.url;
  }
  return realisticDemoQuestions(manifest, images).map((q) => ({
    ...q, id: `staging-${q.id}`, unitId: 'staging-arabic-daily',
  }));
}

async function main() {
  // Validate all account inputs and destination before writing or uploading anything.
  const profiles = stagingCredentials();
  if (!process.env.DATABASE_URL || !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
    throw new Error('Database staging dan Supabase Storage harus dikonfigurasi sebelum bootstrap.');
  for (const profile of profiles) {
    const user = await db.user.findUnique({ where: { email: profile.email } });
    if (user && user.role !== profile.role)
      throw new Error('Salah satu email bootstrap sudah dimiliki akun dengan peran berbeda. Akun tidak diubah.');
  }

  const units = [...stagingUnits(), {
    id: 'staging-arabic-daily', level: 1,
    title: 'Kegiatan sehari-hari · Demo audio Arab',
    theme: 'Kalimat sederhana, benda, dan bunyi',
    description: '10 soal listening Arab dengan suara sintetis untuk testing klien. Belum ditinjau pengajar; bukan materi native untuk peluncuran publik.',
    developmentOnly: true,
  }];
  const existing = await db.question.count({ where: { id: { startsWith: 'staging-' } } });
  if (existing < 260) {
    const fixtureAssets = await uploadFixtureAssets();
    const questions = [...stagingQuestions(fixtureAssets), ...await uploadArabicDemo()];
    await db.$transaction(async (tx) => {
      for (const unit of units) await tx.unit.upsert({
        where: { id: unit.id }, create: unit, update: { developmentOnly: true },
      });
      for (const [position, source] of questions.entries()) {
        const q = questionSchema.parse(source);
        await tx.question.upsert({
          where: { id: q.id },
          create: { id: q.id, unitId: q.unitId, level: q.level, pool: q.pool,
            version: q.version, status: 'published', position, data: json(q) },
          update: {},
        });
      }
    }, { timeout: 60000 });
  }
  for (const [index, profile] of profiles.entries()) {
    await db.user.upsert({
      where: { email: profile.email },
      create: {
        email: profile.email, passwordHash: await bcrypt.hash(profile.password, 12),
        name: index === 0 ? 'Admin Testing' : `Penguji ${index}`, role: profile.role,
        verifiedAt: new Date(), onboarding: profile.onboarding,
      },
      update: {},
    });
  }
  await db.reviewConfig.upsert({
    where: { id: CONFIG_VERSION }, create: { id: CONFIG_VERSION, approved: false }, update: {},
  });
  console.log('Bootstrap staging selesai: 11 paket demo, 260 soal, dan 3 akun testing.');
  console.log('Akun/konten yang sudah ada tidak ditimpa. Persetujuan pengajar tidak dibuat otomatis.');
  console.log('Audio Arab bersifat sintetis; assessment memakai fixture teknis dan bukan validasi kemampuan bahasa.');
}

main().catch(() => {
  // Do not print Prisma/Supabase error objects: they can include connection details.
  console.error('Bootstrap staging gagal. Periksa APP_ENV, kredensial bootstrap, koneksi database, dan konfigurasi Storage. Tidak ada rahasia dicetak.');
  process.exitCode = 1;
}).finally(() => db.$disconnect());
