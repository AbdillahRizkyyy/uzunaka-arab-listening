import { levels, questionSchema, type Question } from '../src/lib/contracts';
import { isStaging } from '../src/lib/environment';
import { z } from 'zod';

const profile = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  password: z.string().min(16).max(72),
});

export function stagingCredentials(env: NodeJS.ProcessEnv = process.env) {
  if (!isStaging()) throw new Error('Bootstrap hanya boleh dijalankan dengan APP_ENV=staging.');
  const credentials = ['ADMIN', 'USER1', 'USER2'].map((role) => {
    const result = profile.safeParse({
      email: env[`STAGING_${role}_EMAIL`],
      password: env[`STAGING_${role}_PASSWORD`],
    });
    if (!result.success)
      throw new Error(`Isi STAGING_${role}_EMAIL dan STAGING_${role}_PASSWORD (16–72 karakter).`);
    if (/istima\.local$|example\.com$|e2e\.example\.invalid$/.test(result.data.email))
      throw new Error(`STAGING_${role}_EMAIL harus memakai alamat testing Anda, bukan akun fixture lokal.`);
    if (/^(admin|user[12]|password|replace-with|E2e-only)/i.test(result.data.password))
      throw new Error(`Gunakan kata sandi acak unik untuk STAGING_${role}_PASSWORD.`);
    return { ...result.data, role: role === 'ADMIN' ? 'admin' : 'student', onboarding: role !== 'USER2' };
  });
  if (new Set(credentials.map((p) => p.email)).size !== credentials.length)
    throw new Error('Alamat email bootstrap harus berbeda.');
  if (new Set(credentials.map((p) => p.password)).size !== credentials.length)
    throw new Error('Kata sandi bootstrap harus berbeda untuk setiap akun.');
  return credentials;
}

/** Original synthesized tones: no speech recording or third-party asset rights. */
export function fixtureTone(count: 1 | 2) {
  const sampleRate = 16000;
  const duration = 1.2;
  const samples = Math.round(sampleRate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const start = t >= .65 && count === 2 ? .65 : .15;
    const local = t - start;
    const envelope = local >= 0 && local < .3 ? Math.min(1, local / .01, (.3 - local) / .01) : 0;
    wav.writeInt16LE(Math.round(Math.sin(t * 440 * Math.PI * 2) * 4500 * envelope), 44 + i * 2);
  }
  return { bytes: wav, duration };
}

export function stagingUnits() {
  return levels.flatMap((level) => [1, 2].map((index) => ({
    id: `staging-l${level.id}-unit-${index}`,
    level: level.id,
    title: `${level.title} · Uji alur ${index}`,
    theme: 'Fixture teknis · hitung bunyi',
    description: 'Paket pengujian tombol, audio, jawaban, skor, dan progres. Bunyi sintetis bukan materi kemampuan bahasa Arab.',
    developmentOnly: true,
  })));
}

export function stagingQuestions(assets: { one: string; two: string; imageOne: string; imageTwo: string }): Question[] {
  const output: Question[] = [];
  for (const level of levels) for (const pool of ['practice', 'assessment'] as const) {
    for (let index = 0; index < (pool === 'practice' ? 20 : 30); index++) {
      const count = index % 2 === 0 ? 1 : 2;
      const type = (['pilihan_ganda', 'urutkan', 'dikte', 'beda_bunyi', 'pilih_gambar'] as const)[index % 5];
      const audio = (n: number) => ({
        url: n === 1 ? assets.one : assets.two,
        duration: 1.2,
        native: false,
        reviewed: false,
        license: 'Bunyi sintetis asli proyek untuk pengujian staging. Bukan ucapan Arab atau materi terverifikasi.',
      });
      const number = count === 1 ? 'وَاحِدٌ' : 'اثْنَانِ';
      const q: Question = {
        id: `staging-l${level.id}-${pool}-${index + 1}`,
        unitId: `staging-l${level.id}-unit-${index % 2 + 1}`,
        level: level.id, version: 1, pool, type,
        prompt: 'Fixture teknis: berapa bunyi yang terdengar?',
        category: 'Uji alur staging · bukan penilaian bahasa',
        audio: [audio(count)],
        options: [{ id: '1', text: 'Satu bunyi' }, { id: '2', text: 'Dua bunyi' }],
        accepted: [String(count)],
        transcript: `${count} bunyi sintetis (${number}).`,
        explanation: `Terdengar ${count} bunyi. Soal ini menguji fungsi aplikasi; bukan latihan atau pengukuran kemampuan bahasa Arab.`,
        harakat: 'full', seconds: 35,
      };
      if (type === 'urutkan') {
        q.prompt = 'Fixture susun kata: dengarkan bunyi, lalu susun angka Arab sebelum frasa “bunyi terdengar”.';
        q.options = [{ id: 'number', text: number }, { id: 'sound', text: 'صَوْتٌ' }, { id: 'heard', text: 'مَسْمُوعٌ' }];
        q.accepted = [['number', 'sound', 'heard']];
      } else if (type === 'dikte') {
        q.prompt = 'Fixture input Arab: tulis jumlah bunyi, satu = وَاحِدٌ atau dua = اثْنَانِ. Salin harakat, tanpa titik/spasi tambahan.';
        q.options = []; q.accepted = [number];
      } else if (type === 'beda_bunyi') {
        q.prompt = 'Fixture dua klip: klip mana yang berisi dua bunyi?';
        q.audio = [audio(1), audio(2)];
        q.options = [{ id: '1', text: 'Klip pertama' }, { id: '2', text: 'Klip kedua' }];
        q.accepted = ['2'];
        q.transcript = 'Klip pertama: satu bunyi. Klip kedua: dua bunyi.';
        q.explanation = 'Klip kedua memuat dua bunyi sintetis. Ini memeriksa pemutaran kedua klip berurutan.';
      } else if (type === 'pilih_gambar') {
        q.prompt = 'Fixture gambar: pilih gambar dengan jumlah lingkaran yang sama dengan jumlah bunyi.';
        q.options = [{ id: '1', text: 'Satu lingkaran', image: assets.imageOne, license: 'Gambar asli proyek' },
          { id: '2', text: 'Dua lingkaran', image: assets.imageTwo, license: 'Gambar asli proyek' }];
      }
      output.push(questionSchema.parse(q));
    }
  }
  return output;
}
