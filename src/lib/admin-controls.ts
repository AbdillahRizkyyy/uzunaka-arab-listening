import { z } from 'zod';
import { db, atomic, json, type Tx } from './db';
import { assert } from './domain';
import { questionSchema, type Question } from './contracts';
import { BRAND_NAME, BRAND_TAGLINE } from './brand';

export const settingsSchema = z.object({
  name: z.string().trim().min(2).max(60),
  tagline: z.string().trim().min(2).max(180),
  supportEmail: z.union([z.literal(''), z.string().email().max(254)]),
});
export async function settings() {
  return (
    (await db.appSettings.findUnique({ where: { id: 'main' } })) ?? {
      name: BRAND_NAME,
      tagline: BRAND_TAGLINE,
      supportEmail: process.env.SUPPORT_EMAIL ?? '',
    }
  );
}
export async function saveRevision(
  tx: Tx,
  q: { id: string; version: number; data: unknown },
  editorId: string,
) {
  await tx.questionRevision.upsert({
    where: { questionId_version: { questionId: q.id, version: q.version } },
    create: { questionId: q.id, version: q.version, data: json(q.data), editorId },
    update: {},
  });
}
export async function adminRead(action: string, params: URLSearchParams) {
  if (action === 'history') {
    const id = z.string().min(1).parse(params.get('id'));
    return db.questionRevision.findMany({
      where: { questionId: id },
      orderBy: { version: 'desc' },
    });
  }
  if (action === 'users') {
    const search = (params.get('search') ?? '').slice(0, 120);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .parse(params.get('page') ?? 0);
    const where = {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
      ],
    };
    const [rows, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          level: true,
          onboarding: true,
          verifiedAt: true,
          disabledAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: page * 25,
        take: 25,
      }),
      db.user.count({ where }),
    ]);
    return { rows, total };
  }
  if (action === 'user-detail') {
    const userId = z.string().min(1).parse(params.get('id'));
    const attempts = await db.attempt.findMany({
      where: { userId },
      select: {
        id: true,
        kind: true,
        level: true,
        unitId: true,
        completedAt: true,
        createdAt: true,
        answers: { select: { correct: true, score: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return {
      attempts: attempts.map(({ answers, ...a }) => ({
        ...a,
        correct: answers.filter((x) => x.correct).length,
        answered: answers.length,
        score: answers.reduce((s, a) => s + a.score, 0),
      })),
    };
  }
  if (action === 'analytics') {
    const since = new Date(Date.now() - 90 * 86400000);
    const [answers, attempts, rooms, questions] = await Promise.all([
      db.answer.findMany({
        where: { createdAt: { gte: since } },
        select: { questionId: true, correct: true, score: true, attemptId: true },
      }),
      db.attempt.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, kind: true, unitId: true, completedAt: true },
      }),
      db.room.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: {
          code: true,
          status: true,
          createdAt: true,
          participants: {
            select: {
              name: true,
              answers: { select: { correct: true, score: true, elapsedMs: true } },
            },
          },
        },
      }),
      db.question.findMany({ select: { id: true, data: true } }),
    ]);
    const questionStats = new Map<
      string,
      { id: string; prompt: string; answered: number; correct: number }
    >();
    const prompts = new Map(questions.map((q) => [q.id, (q.data as Question).prompt]));
    for (const a of answers) {
      const row = questionStats.get(a.questionId) ?? {
        id: a.questionId,
        prompt: prompts.get(a.questionId) ?? 'Soal dihapus',
        answered: 0,
        correct: 0,
      };
      row.answered++;
      row.correct += Number(a.correct);
      questionStats.set(row.id, row);
    }
    const byAttempt = new Map(attempts.map((a) => [a.id, a]));
    const packages = new Map<
      string,
      { id: string; answered: number; correct: number; completed: number }
    >();
    for (const a of attempts)
      if (a.kind === 'practice' && a.unitId) {
        const row = packages.get(a.unitId) ?? {
          id: a.unitId,
          answered: 0,
          correct: 0,
          completed: 0,
        };
        row.completed += Number(!!a.completedAt);
        packages.set(row.id, row);
      }
    for (const a of answers) {
      const attempt = a.attemptId ? byAttempt.get(a.attemptId) : null;
      const row =
        attempt?.kind === 'practice' && attempt.unitId ? packages.get(attempt.unitId) : null;
      if (row) {
        row.answered++;
        row.correct += Number(a.correct);
      }
    }
    return {
      since,
      totalAnswers: answers.length,
      correctAnswers: answers.filter((a) => a.correct).length,
      completed: attempts.filter((a) => a.completedAt).length,
      questions: [...questionStats.values()].sort(
        (a, b) => a.correct / a.answered - b.correct / b.answered,
      ),
      packages: [...packages.values()],
      rooms: rooms.map((r) => ({
        code: r.code,
        status: r.status,
        createdAt: r.createdAt,
        participants: r.participants
          .map((p) => ({
            name: p.name,
            answered: p.answers.length,
            correct: p.answers.filter((a) => a.correct).length,
            score: p.answers.reduce((s, a) => s + a.score, 0),
            elapsedMs: p.answers.reduce((s, a) => s + a.elapsedMs, 0),
          }))
          .sort((a, b) => b.score - a.score || b.correct - a.correct || a.elapsedMs - b.elapsedMs),
      })),
    };
  }
  return undefined;
}
export async function adminWrite(action: string, data: unknown, adminId: string) {
  if (action === 'settings') {
    const input = settingsSchema.parse(data);
    await db.appSettings.upsert({
      where: { id: 'main' },
      create: { id: 'main', ...input },
      update: input,
    });
  } else if (action === 'user-status') {
    const input = z.object({ id: z.string(), disabled: z.boolean() }).parse(data);
    assert(input.id !== adminId, 'Akun sendiri tidak dapat dinonaktifkan.');
    await db.user.update({
      where: { id: input.id },
      data: { disabledAt: input.disabled ? new Date() : null, authVersion: { increment: 1 } },
    });
  } else if (action === 'archive-unit') {
    const input = z.object({ id: z.string(), archived: z.boolean() }).parse(data);
    await atomic((tx) =>
      tx.unit.update({ where: { id: input.id }, data: { archived: input.archived } }),
    );
  } else if (action === 'duplicate-unit') {
    const { id } = z.object({ id: z.string() }).parse(data);
    await atomic(async (tx) => {
      const unit = await tx.unit.findUniqueOrThrow({ where: { id }, include: { questions: true } });
      const targetId = 'paket-' + crypto.randomUUID();
      await tx.unit.create({
        data: {
          id: targetId,
          title: (unit.title + ' (salinan)').slice(0, 120),
          level: unit.level,
          theme: unit.theme,
          description: unit.description,
          developmentOnly: unit.developmentOnly,
        },
      });
      for (const old of unit.questions) {
        const q = questionSchema.parse({
          ...(old.data as Question),
          id: 'soal-' + crypto.randomUUID(),
          unitId: targetId,
          version: 1,
        });
        const row = await tx.question.create({
          data: {
            id: q.id,
            unitId: targetId,
            level: q.level,
            pool: q.pool,
            position: old.position,
            data: json(q),
          },
        });
        await saveRevision(tx, row, adminId);
      }
    });
  } else if (action === 'order-questions' || action === 'move-questions') {
    const input = z
      .object({ unitId: z.string(), ids: z.array(z.string()).min(1).max(500) })
      .parse(data);
    assert(new Set(input.ids).size === input.ids.length, 'Daftar soal berulang.');
    await atomic(async (tx) => {
      const unit = await tx.unit.findUniqueOrThrow({ where: { id: input.unitId } });
      const rows = await tx.question.findMany({ where: { id: { in: input.ids } } });
      assert(rows.length === input.ids.length, 'Sebagian soal tidak ditemukan.');
      if (action === 'order-questions') {
        assert(
          rows.every((q) => q.unitId === unit.id) &&
            (await tx.question.count({ where: { unitId: unit.id } })) === rows.length,
          'Muat ulang paket sebelum mengatur urutan.',
          409,
        );
        for (const [position, id] of input.ids.entries())
          await tx.question.update({ where: { id }, data: { position } });
      } else {
        assert(
          !unit.archived && rows.every((q) => q.level === unit.level),
          'Pindahkan ke paket aktif pada level yang sama.',
        );
        const sources = await tx.unit.findMany({
          where: { id: { in: rows.map((q) => q.unitId) } },
        });
        assert(
          unit.developmentOnly || sources.every((u) => !u.developmentOnly),
          'Soal demo hanya boleh dipindahkan ke paket development.',
        );
        const tail = await tx.question.aggregate({
          where: { unitId: unit.id },
          _max: { position: true },
        });
        let position = (tail._max.position ?? 0) + 1;
        for (const old of rows) {
          await saveRevision(tx, old, adminId);
          const q = questionSchema.parse({
            ...(old.data as Question),
            unitId: unit.id,
            version: old.version + 1,
          });
          const row = await tx.question.update({
            where: { id: old.id },
            data: {
              unitId: unit.id,
              data: json(q),
              version: q.version,
              status: 'draft',
              position: position++,
            },
          });
          await saveRevision(tx, row, adminId);
        }
      }
    });
  } else if (action === 'restore-question') {
    const input = z
      .object({ id: z.string(), version: z.number().int(), expectedVersion: z.number().int() })
      .parse(data);
    await atomic(async (tx) => {
      const old = await tx.question.findUniqueOrThrow({ where: { id: input.id } });
      assert(
        old.version === input.expectedVersion,
        'Soal telah berubah. Muat ulang sebelum memulihkan.',
        409,
      );
      const revision = await tx.questionRevision.findUniqueOrThrow({
        where: { questionId_version: { questionId: input.id, version: input.version } },
      });
      const q = questionSchema.parse({
        ...(revision.data as Question),
        unitId: old.unitId,
        level: old.level,
        version: old.version + 1,
      });
      await saveRevision(tx, old, adminId);
      const row = await tx.question.update({
        where: { id: old.id },
        data: { data: json(q), pool: q.pool, version: q.version, status: 'draft' },
      });
      await saveRevision(tx, row, adminId);
    });
  } else return false;
  return true;
}
