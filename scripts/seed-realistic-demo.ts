import 'dotenv/config';
import { readFile, writeFile } from 'node:fs/promises';
import { db, json } from '../src/lib/db';
import { questionSchema, type Question } from '../src/lib/contracts';

async function main() {
  const database = new URL(process.env.DATABASE_URL!);
  if (
    process.env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(database.hostname)
  )
    throw new Error('Demo hanya untuk database development lokal.');
  const manifest = JSON.parse(
    await readFile('public/media/demo-arabic/manifest.json', 'utf8'),
  ) as Record<string, { url: string; duration: number; transcript: string }>;
  const unitId = 'demo-arabic-daily';
  const audio = (...names: string[]) =>
    names.map((name) => ({
      url: manifest[name].url,
      duration: manifest[name].duration,
      native: false,
      reviewed: false,
      license:
        'Audio sintetis Microsoft Edge TTS; demo development saja, belum untuk distribusi publik.',
    }));
  const options = (a: string, b: string, c?: string) =>
    [a, b, ...(c ? [c] : [])].map((text, i) => ({ id: String(i), text }));
  const base = (id: number, clip: string): Question => ({
    id: `demo-daily-${id}`,
    unitId,
    version: 1,
    level: 1,
    pool: 'practice',
    type: 'pilihan_ganda',
    prompt: '',
    category: 'Kegiatan sehari-hari · demo sintetis',
    audio: audio(clip),
    options: options('', ''),
    accepted: ['0'],
    transcript: manifest[clip].transcript,
    explanation: '',
    harakat: 'full',
    seconds: 35,
  });
  const questions: Question[] = [
    {
      ...base(1, 'library'),
      prompt: 'Di mana penutur membaca buku?',
      options: options('Di perpustakaan', 'Di rumah', 'Di pasar'),
      explanation:
        'فِي الْمَكْتَبَةِ berarti di perpustakaan. Kalimat menyebut penutur membaca buku di sana.',
    },
    {
      ...base(2, 'school'),
      prompt: 'Kapan Ahmad pergi ke sekolah?',
      options: options('Pagi hari', 'Malam hari', 'Sore hari'),
      explanation: 'صَبَاحًا berarti pada pagi hari. Ahmad pergi ke sekolah pada pagi hari.',
    },
    {
      ...base(3, 'library'),
      type: 'urutkan',
      prompt: 'Susun kalimat sesuai urutan yang didengar.',
      options: options('أَنَا', 'أَقْرَأُ').concat([
        { id: '2', text: 'كِتَابًا' },
        { id: '3', text: 'فِي' },
        { id: '4', text: 'الْمَكْتَبَةِ.' },
      ]),
      accepted: [['0', '1', '2', '3', '4']],
      explanation: 'Urutannya: saya → membaca → sebuah buku → di → perpustakaan.',
    },
    {
      ...base(4, 'desk'),
      type: 'urutkan',
      prompt: 'Susun letak buku sesuai audio.',
      options: options('الْكِتَابُ', 'عَلَى', 'الْمَكْتَبِ.'),
      accepted: [['0', '1', '2']],
      explanation: 'الْكِتَابُ عَلَى الْمَكْتَبِ berarti buku itu berada di atas meja.',
    },
    {
      ...base(5, 'book'),
      type: 'dikte',
      prompt: 'Tulis kalimat dengan harakat dan tanda titik.',
      options: [],
      accepted: [manifest.book.transcript],
      explanation:
        'هَذَا كِتَابٌ. berarti ini sebuah buku. Dikte menilai harakat, spasi, dan tanda titik secara persis.',
    },
    {
      ...base(6, 'teacher'),
      type: 'dikte',
      prompt: 'Tulis profesi penutur dalam kalimat lengkap, dengan harakat dan titik.',
      options: [],
      accepted: [manifest.teacher.transcript],
      explanation: 'أَنَا مُعَلِّمٌ. berarti saya seorang guru. Perhatikan tasydid pada huruf lam.',
    },
    {
      ...base(7, 'heart'),
      type: 'beda_bunyi',
      audio: audio('heart', 'dog'),
      transcript: 'قَلْبٌ — كَلْبٌ',
      prompt: 'Klip mana yang menyebut kata “hati” (قَلْبٌ)?',
      options: options('Klip pertama', 'Klip kedua'),
      explanation:
        'Klip pertama قَلْبٌ (hati), klip kedua كَلْبٌ (anjing). Dengarkan perbedaan qaf dan kaf.',
    },
    {
      ...base(8, 'dog'),
      type: 'beda_bunyi',
      audio: audio('dog', 'heart'),
      transcript: 'كَلْبٌ — قَلْبٌ',
      prompt: 'Klip mana yang dimulai dengan bunyi qaf (ق)?',
      options: options('Klip pertama', 'Klip kedua'),
      accepted: ['1'],
      explanation:
        'Klip kedua mengucapkan قَلْبٌ dengan qaf. Klip pertama mengucapkan كَلْبٌ dengan kaf.',
    },
    {
      ...base(9, 'pen'),
      type: 'pilih_gambar',
      prompt: 'Pilih benda yang disebutkan dalam audio.',
      options: [
        {
          id: '0',
          text: 'Pena',
          image: '/media/demo-arabic/pen.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
        {
          id: '1',
          text: 'Buku',
          image: '/media/demo-arabic/book.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
      ],
      explanation: 'هَذَا قَلَمٌ. berarti ini sebuah pena. Pilih gambar pena.',
    },
    {
      ...base(10, 'water'),
      type: 'pilih_gambar',
      prompt: 'Pilih minuman yang disebutkan penutur.',
      options: [
        {
          id: '0',
          text: 'Air',
          image: '/media/demo-arabic/water.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
        {
          id: '1',
          text: 'Susu',
          image: '/media/demo-arabic/milk.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
      ],
      explanation: 'أَشْرَبُ الْمَاءَ. berarti saya minum air. Kata الْمَاءَ menunjukkan air.',
    },
  ];
  const svg = (drawing: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="180" viewBox="0 0 240 180"><rect width="240" height="180" rx="20" fill="#f5eedc"/>${drawing}</svg>`;
  const images = {
    pen: '<path d="M65 135L155 35l25 25-90 100-35 10z" fill="#1a5946"/><path d="M65 135l25 25-35 10z" fill="#d9b65f"/>',
    book: '<path d="M35 45q45-15 85 10 40-25 85-10v105q-45-15-85 10-40-25-85-10z" fill="#fff" stroke="#1a5946" stroke-width="5"/><path d="M120 55v105M50 70l50 8M50 90l50 8M145 77l45-7M145 97l45-7" stroke="#b9a15f" stroke-width="4"/>',
    water:
      '<path d="M75 30h90l-10 130H85z" fill="#eefbff" stroke="#326e88" stroke-width="4"/><path d="M80 85q20-10 40 0t40 0l-5 75H85z" fill="#82cde2"/>',
    milk: '<path d="M85 30h60l15 25v110H70V55z" fill="#fff" stroke="#326e88" stroke-width="4"/><path d="M70 55h90M85 30l15 25v110" fill="none" stroke="#326e88" stroke-width="4"/><path d="M125 75q-30 35 0 40 30-5 0-40" fill="#82cde2"/>',
  };
  for (const [name, drawing] of Object.entries(images))
    await writeFile(`public/media/demo-arabic/${name}.svg`, svg(drawing));
  await db.$transaction(async (tx) => {
    await tx.unit.upsert({
      where: { id: unitId },
      create: {
        id: unitId,
        level: 1,
        title: 'Kegiatan sehari-hari · Demo audio Arab',
        theme: 'Kalimat sederhana, benda, dan bunyi',
        description:
          '10 soal dengan audio Arab sintetis untuk mencoba seluruh tipe soal. Development saja; belum ditinjau pengajar.',
        developmentOnly: true,
      },
      update: { developmentOnly: true },
    });
    for (const [position, source] of questions.entries()) {
      const q = questionSchema.parse(source);
      await tx.question.upsert({
        where: { id: q.id },
        create: {
          id: q.id,
          unitId,
          level: 1,
          pool: 'practice',
          status: 'published',
          position,
          data: json(q),
        },
        update: {},
      });
    }
  });
  console.log(
    'Paket demo Arab: 10 soal, lima tipe, audio sintetis. Perubahan admin sebelumnya tidak ditimpa.',
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
