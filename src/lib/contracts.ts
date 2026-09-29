import { z } from 'zod';

export const levels = [
  {
    id: 1,
    title: 'Jumlah Murakkabah',
    arabic: 'الجمل المركبة',
    description: 'Tangkap makna kalimat, dhamir, dan perubahan kata kerja.',
    points: 100,
  },
  {
    id: 2,
    title: 'Hiwar Muta’awassith',
    arabic: 'الحوار المتوسط',
    description: 'Ikuti percakapan dan pahami maksud setiap penutur.',
    points: 150,
  },
  {
    id: 3,
    title: 'Istima’ Muwassa’',
    arabic: 'الاستماع الموسع',
    description: 'Temukan ide pokok dan detail dalam cerita pendek.',
    points: 200,
  },
  {
    id: 4,
    title: 'Tamyiz Sauti Lanjutan',
    arabic: 'التمييز الصوتي',
    description: 'Asah kepekaan terhadap bunyi dan pelafalan yang mirip.',
    points: 150,
  },
  {
    id: 5,
    title: 'Istima’ Tanpa Teks',
    arabic: 'الاستماع دون نص',
    description: 'Pahami bahasa Arab dengan mengandalkan pendengaran.',
    points: 250,
  },
] as const;
export const typeLabels = {
  pilihan_ganda: 'Pilihan ganda',
  urutkan: 'Susun kata',
  dikte: 'Dikte',
  beda_bunyi: 'Beda bunyi',
  pilih_gambar: 'Pilih gambar',
};
const asset = z
  .string()
  .refine(
    (s) => /^https:\/\//.test(s) || /^\/media\/[\w./-]+$/.test(s),
    'Gunakan URL HTTPS atau aset /media/.',
  );
export const questionSchema = z
  .object({
    id: z.string().min(1).max(100),
    unitId: z.string().min(1).max(100),
    version: z.number().int().positive(),
    level: z.number().int().min(1).max(5),
    pool: z.enum(['practice', 'assessment']),
    type: z.enum(['pilihan_ganda', 'urutkan', 'dikte', 'beda_bunyi', 'pilih_gambar']),
    prompt: z.string().min(1).max(1000),
    category: z.string().min(1),
    audio: z
      .array(
        z.object({
          url: asset,
          duration: z.number().positive().max(180),
          native: z.boolean(),
          license: z.string(),
          reviewed: z.boolean(),
        }),
      )
      .min(1)
      .max(5),
    options: z
      .array(
        z.object({
          id: z.string().min(1),
          text: z.string(),
          image: asset.optional(),
          license: z.string().optional(),
        }),
      )
      .max(20),
    accepted: z.array(z.union([z.string(), z.array(z.string())])).min(1),
    transcript: z.string().min(1),
    explanation: z.string().min(1),
    harakat: z.enum(['full', 'partial', 'none']),
    seconds: z.number().int().min(10).max(180),
  })
  .superRefine((q, ctx) => {
    const ids = q.options.map((o) => o.id);
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (new Set(ids).size !== ids.length) issue('ID opsi/token harus unik.');
    if (q.type === 'dikte') {
      if (q.accepted.length !== 1 || typeof q.accepted[0] !== 'string')
        issue('Dikte memiliki tepat satu kunci teks.');
    } else if (q.type === 'urutkan') {
      if (ids.length < 2) issue('Minimal dua token.');
      if (
        q.accepted.some(
          (a) =>
            !Array.isArray(a) ||
            a.length !== ids.length ||
            new Set(a).size !== ids.length ||
            a.some((id) => !ids.includes(id)),
        )
      )
        issue('Urutan harus memuat semua ID token tepat sekali.');
    } else {
      if (ids.length < 2 || q.accepted.some((a) => typeof a !== 'string' || !ids.includes(a)))
        issue('Kunci harus merujuk opsi yang tersedia.');
      if (q.type === 'pilih_gambar' && q.options.some((o) => !o.image || !o.license))
        issue('Gambar dan izin penggunaan wajib.');
      if (q.type === 'beda_bunyi' && q.audio.length < 2)
        issue('Beda bunyi memerlukan minimal dua klip.');
    }
  });
export type Question = z.infer<typeof questionSchema>;
export type PublicQuestion = Omit<Question, 'accepted' | 'transcript' | 'explanation' | 'audio'> & {
  audio: { url: string; duration: number }[];
};
export const answerSchema = z.union([z.string().max(2000), z.array(z.string().max(100)).max(20)]);
export type AnswerValue = z.infer<typeof answerSchema>;
export const commandSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('play') }),
  z.object({ action: z.literal('replay') }),
  z.object({ action: z.literal('heard') }),
  z.object({ action: z.literal('answer'), value: answerSchema }),
  z.object({ action: z.literal('next') }),
]);
export const roomCommandSchema = z.object({
  action: z.enum(['check', 'ready', 'start', 'next', 'cancel', 'end', 'remove']),
  participantId: z.string().optional(),
});
export const CONFIG_VERSION = 'placement-v1';
