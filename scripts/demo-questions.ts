import type { Question } from '../src/lib/contracts';

export type DemoManifest = Record<string, { url: string; duration: number; transcript: string }>;

export function realisticDemoQuestions(
  manifest: DemoManifest,
  imageUrls: Record<string, string> = {},
): Question[] {
  const unitId = 'demo-arabic-daily';
  const audio = (...names: string[]) =>
    names.map((name) => ({
      url: manifest[name].url,
      duration: manifest[name].duration,
      native: false,
      reviewed: false,
      license:
        'Audio sintetis Microsoft Edge TTS untuk pengujian development/staging; bukan rekaman native atau materi peluncuran publik.',
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
          image: imageUrls.pen ?? '/media/demo-arabic/pen.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
        {
          id: '1',
          text: 'Buku',
          image: imageUrls.book ?? '/media/demo-arabic/book.svg',
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
          image: imageUrls.water ?? '/media/demo-arabic/water.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
        {
          id: '1',
          text: 'Susu',
          image: imageUrls.milk ?? '/media/demo-arabic/milk.svg',
          license: 'Ilustrasi SVG asli proyek',
        },
      ],
      explanation: 'أَشْرَبُ الْمَاءَ. berarti saya minum air. Kata الْمَاءَ menunjukkan air.',
    },
  ];
  return questions;
}
