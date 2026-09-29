import 'dotenv/config';
import { db } from '../src/lib/db';
import { questionSchema, CONFIG_VERSION, typeLabels } from '../src/lib/contracts';
import { canPublish } from '../src/lib/domain';
async function main() {
  const issues: string[] = [];
  for (const key of [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'APP_URL',
    'SOCKET_SECRET',
    'SMTP_HOST',
    'MAIL_FROM',
    'SUPPORT_EMAIL',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'NEXT_PUBLIC_SOCKET_URL',
  ])
    if (!process.env[key] || /example\.com|replace-with|localhost/.test(process.env[key]!))
      issues.push(`Konfigurasi produksi: ${key}`);
  const review = await db.reviewConfig.findUnique({ where: { id: CONFIG_VERSION } });
  if (!review?.approved) issues.push('Persetujuan pengajar belum dicatat.');
  const rows = await db.question.findMany({ where: { status: 'published', unit: { archived: false, developmentOnly: false } } }),
    questions = rows.map((r) => questionSchema.parse(r.data));
  for (let l = 1; l <= 5; l++) {
    if (questions.filter((q) => q.level === l && q.pool === 'practice').length < 20)
      issues.push(`Level ${l}: kurang dari 20 soal latihan.`);
    if (questions.filter((q) => q.level === l && q.pool === 'assessment').length < 30)
      issues.push(`Level ${l}: kurang dari 30 soal assessment.`);
    const units = await db.unit.findMany({ where: { level: l, archived: false, developmentOnly: false } });
    if (
      units.filter(
        (u) => questions.filter((q) => q.unitId === u.id && q.pool === 'practice').length >= 10,
      ).length < 2
    )
      issues.push(`Level ${l}: perlu dua unit dengan minimal 10 soal.`);
  }
  for (const type of Object.keys(typeLabels))
    if (!questions.some((q) => q.type === type)) issues.push(`Tipe ${type} belum tersedia.`);
  for (const q of questions) {
    if (!canPublish(q)) issues.push(`${q.id}: metadata tinjauan/aset tidak valid.`);
    for (const audio of q.audio) {
      try {
        const r = await fetch(audio.url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        if (!r.ok || !r.headers.get('content-type')?.startsWith('audio/'))
          issues.push(`${q.id}: audio tidak tersedia.`);
      } catch {
        issues.push(`${q.id}: audio tidak dapat diakses.`);
      }
    }
  }
  if (issues.length) {
    console.error(issues.join('\n'));
    process.exitCode = 1;
  } else
    console.log(
      'Gerbang otomatis lolos. Tetap wajib bukti uji perangkat, beban, restore, dan pilot kelas.',
    );
}
main()
  .catch((e) => {
    console.error('Pemeriksaan rilis gagal:', e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
