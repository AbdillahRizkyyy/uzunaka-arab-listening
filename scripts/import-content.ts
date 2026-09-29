import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { questionSchema } from '../src/lib/contracts';
import { atomic, db, json } from '../src/lib/db';
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error('Pemakaian: npm run content:import -- path/file.csv [--dry-run]');
  const rows = parse(await readFile(file, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }) as Record<string, string>[];
  const questions = rows.map((r, i) => {
    try {
      return questionSchema.parse({
        id: r.id,
        unitId: r.unit_id,
        version: 1,
        level: Number(r.level),
        pool: r.pool,
        type: r.type,
        prompt: r.prompt,
        category: r.category,
        audio: JSON.parse(r.audio),
        options: JSON.parse(r.options),
        accepted: JSON.parse(r.accepted),
        transcript: r.transcript,
        explanation: r.explanation,
        harakat: r.harakat,
        seconds: Number(r.seconds),
      });
    } catch (e) {
      throw new Error(`Baris ${i + 2}: ${String(e)}`);
    }
  });
  if (new Set(questions.map((q) => q.id)).size !== questions.length)
    throw new Error('ID soal duplikat dalam CSV.');
  for (const q of questions) {
    const unit = await db.unit.findUnique({ where: { id: q.unitId } });
    if (!unit || unit.level !== q.level) throw new Error(`Unit/level tidak sesuai untuk ${q.id}`);
  }
  if (process.argv.includes('--dry-run')) {
    console.log(`${questions.length} soal valid; tidak ada perubahan.`);
    return;
  }
  await atomic(async (tx) => {
    for (const q of questions) {
      const old = await tx.question.findUnique({ where: { id: q.id } });
      q.version = (old?.version ?? 0) + 1;
      await tx.question.upsert({
        where: { id: q.id },
        create: {
          id: q.id,
          unitId: q.unitId,
          level: q.level,
          pool: q.pool,
          version: q.version,
          data: json(q),
        },
        update: {
          unitId: q.unitId,
          level: q.level,
          pool: q.pool,
          version: q.version,
          data: json(q),
          status: 'draft',
        },
      });
    }
  });
  console.log(
    `${questions.length} soal diimpor sebagai draft. Preview dan tinjau sebelum publish.`,
  );
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
