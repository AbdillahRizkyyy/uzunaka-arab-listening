import 'dotenv/config';
import { db, json } from '../src/lib/db';
import { levels, questionSchema, type Question } from '../src/lib/contracts';

const audio = (duration = 1) => [
  {
    url: '/media/test-tone.wav',
    duration,
    native: true,
    license: 'Fixture development lokal — bukan materi produksi',
    reviewed: true,
  },
];

const image = '/media/test-image.svg';

function makeQuestion(level: number, pool: 'practice' | 'assessment', index: number): Question {
  const type = ['pilihan_ganda', 'urutkan', 'dikte', 'beda_bunyi', 'pilih_gambar'][index % 5] as Question['type'];
  const id = `demo-l${level}-${pool}-${String(index + 1).padStart(2, '0')}`;
  const base = {
    id,
    unitId: `level-${level}-unit-${(index % 2) + 1}`,
    version: 1,
    level,
    pool,
    prompt: `Dengarkan contoh level ${level}, lalu pilih jawaban yang paling tepat.`,
    category: levels[level - 1].title,
    transcript: `هَذَا تَمْرِينٌ تَجْرِيبِيٌّ لِلْمُسْتَوَى ${level}.`,
    explanation: `Jawaban ini sesuai dengan makna audio latihan level ${level}. Fixture ini dipakai untuk menguji alur aplikasi.`,
    harakat: 'full' as const,
    seconds: 20,
  };
  if (type === 'urutkan') {
    const options = [
      { id: 't1', text: 'هَذَا' },
      { id: 't2', text: 'تَمْرِينٌ' },
      { id: 't3', text: 'تَجْرِيبِيٌّ' },
      { id: 't4', text: 'مُفِيدٌ' },
    ];
    return questionSchema.parse({ ...base, type, audio: audio(), options, accepted: [['t1', 't2', 't3', 't4']] });
  }
  if (type === 'dikte') {
    return questionSchema.parse({
      ...base,
      type,
      audio: audio(),
      options: [],
      accepted: [base.transcript],
    });
  }
  if (type === 'beda_bunyi') {
    return questionSchema.parse({
      ...base,
      type,
      audio: [...audio(), ...audio()],
      options: [
        { id: 'a', text: 'Bunyi pertama' },
        { id: 'b', text: 'Bunyi kedua' },
      ],
      accepted: ['a'],
    });
  }
  const options = [
    { id: 'a', text: 'المكتبة', ...(type === 'pilih_gambar' ? { image, license: 'Fixture development lokal' } : {}) },
    { id: 'b', text: 'المطعم', ...(type === 'pilih_gambar' ? { image, license: 'Fixture development lokal' } : {}) },
    { id: 'c', text: 'الفصل', ...(type === 'pilih_gambar' ? { image, license: 'Fixture development lokal' } : {}) },
    { id: 'd', text: 'البيت', ...(type === 'pilih_gambar' ? { image, license: 'Fixture development lokal' } : {}) },
  ];
  return questionSchema.parse({ ...base, type, audio: audio(), options, accepted: ['a'] });
}

async function main() {
  let created = 0;
  for (const level of levels) {
    for (let i = 0; i < 2; i++) {
      const id = `level-${level.id}-unit-${i + 1}`;
      await db.unit.upsert({
        where: { id },
        create: {
          id,
          level: level.id,
          title: i === 0 ? `${level.title} · Fondasi` : `${level.title} · Praktik`,
          theme: i === 0 ? 'Fondasi listening' : 'Praktik terpandu',
          description: `Paket fixture untuk mencoba latihan ${level.title.toLowerCase()}.`,
        },
        update: {},
      });
    }
    for (const pool of ['practice', 'assessment'] as const) {
      const count = pool === 'practice' ? 20 : 30;
      for (let i = 0; i < count; i++) {
        const question = makeQuestion(level.id, pool, i);
        const existing = await db.question.findUnique({ where: { id: question.id } });
        await db.question.upsert({
          where: { id: question.id },
          create: { id: question.id, unitId: question.unitId, level: question.level, pool: question.pool, version: 1, status: 'published', data: json(question) },
          update: { unitId: question.unitId, level: question.level, pool: question.pool, version: (existing?.version ?? 0) + 1, status: 'published', data: json({ ...question, version: (existing?.version ?? 0) + 1 }) },
        });
        created++;
      }
    }
  }
  await db.reviewConfig.upsert({
    where: { id: 'placement-v1' },
    create: { id: 'placement-v1', approved: true, reviewer: 'Fixture development' , reviewedAt: new Date() },
    update: { approved: true, reviewer: 'Fixture development', reviewedAt: new Date() },
  });
  // Keep one dummy user ready for the placement flow and one ready for practice/live.
  await db.user.updateMany({
    where: { email: 'user2@istima.local' },
    data: { onboarding: false, level: 1 },
  });
  console.log(`Fixture siap: ${created} soal (100 latihan, 150 assessment), 10 paket, audio/gambar lokal.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
