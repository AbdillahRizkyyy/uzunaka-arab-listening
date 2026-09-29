import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { atomic, json, Tx } from './db';
import { Question, CONFIG_VERSION, commandSchema } from './contracts';
import {
  assert,
  freshPlayback,
  Playback,
  publicQuestion,
  scoreAnswer,
  durationMs,
  placement,
  answerWindow,
} from './domain';

export type AttemptState = {
  questions: Question[];
  index: number;
  playback: Playback;
  answered: boolean;
  finished: boolean;
  result?: {
    correct: number;
    total: number;
    score: number;
    passed: boolean;
    level: number;
    weak: string[];
  };
};
export function shuffle<T>(items: T[]) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function prepare(q: Question): Question {
  return { ...q, options: shuffle(q.options) };
}
async function select(tx: Tx, level: number, count: number, seen: Set<string>) {
  const rows = await tx.question.findMany({
    where: {
      level,
      pool: 'assessment',
      status: 'published',
      unit: {
        archived: false,
        ...(process.env.NODE_ENV === 'production' ? { developmentOnly: false } : {}),
      },
    },
  });
  assert(rows.length >= count, 'Bank soal assessment belum cukup untuk tes ini.', 409);
  return shuffle(rows)
    .sort((a, b) => Number(seen.has(a.id)) - Number(seen.has(b.id)))
    .slice(0, count)
    .map((r) => prepare(r.data as Question));
}
export async function eligible(tx: Tx, userId: string, level: number) {
  const units = await tx.unit.findMany({
    where: {
      level,
      archived: false,
      ...(process.env.NODE_ENV === 'production' ? { developmentOnly: false } : {}),
      questions: { some: { pool: 'practice', status: 'published' } },
    },
  });
  const completed = await tx.attempt.findMany({
    where: { userId, kind: 'practice', level, completedAt: { not: null } },
  });
  const allUnits = units.length > 0 && units.every((u) => completed.some((a) => a.unitId === u.id));
  const questions = await tx.question.findMany({
    where: {
      level,
      pool: 'practice',
      status: 'published',
      unit: {
        archived: false,
        ...(process.env.NODE_ENV === 'production' ? { developmentOnly: false } : {}),
      },
    },
    select: { id: true },
  });
  const answers = await tx.answer.findMany({
    where: { attempt: { userId, kind: 'practice', level } },
    orderBy: { createdAt: 'asc' },
  });
  const first = new Map<string, boolean>();
  for (const a of answers) if (!first.has(a.questionId)) first.set(a.questionId, a.correct);
  const accuracy = questions.length
    ? questions.filter((q) => first.get(q.id) === true).length / questions.length
    : 0;
  return {
    allowed: allUnits || accuracy >= 0.75,
    accuracy,
    completedUnits: units.filter((u) => completed.some((a) => a.unitId === u.id)).length,
    totalUnits: units.length,
  };
}
export async function startAttempt(
  userId: string,
  kind: 'practice' | 'onboarding' | 'level_up',
  unitId?: string,
) {
  return atomic(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const existing = await tx.attempt.findFirst({
      where: { userId, kind, completedAt: null, ...(kind === 'practice' ? { unitId } : {}) },
    });
    if (existing) return existing.id;
    let questions: Question[] = [],
      level = user.level,
      targetLevel = user.level;
    if (kind === 'practice') {
      assert(user.onboarding, 'Selesaikan tes penempatan terlebih dahulu.', 403);
      const unit = await tx.unit.findUnique({ where: { id: unitId ?? '' } });
      assert(
        unit && !unit.archived && (process.env.NODE_ENV !== 'production' || !unit.developmentOnly),
        'Unit tidak tersedia atau telah diarsipkan.',
        404,
      );
      assert(unit.level <= user.level, 'Level ini belum terbuka.', 403);
      level = unit.level;
      targetLevel = level;
      const rows = await tx.question.findMany({
        where: { unitId: unit.id, pool: 'practice', status: 'published' },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      });
      questions = rows.map((r) => prepare(r.data as Question));
      assert(questions.length > 0, 'Materi unit ini belum tersedia.', 409);
    } else {
      const review = await tx.reviewConfig.findUnique({ where: { id: CONFIG_VERSION } });
      assert(review?.approved, 'Tes belum tersedia: menunggu validasi pengajar.', 409);
      const history = await tx.attempt.findMany({
        where: { userId, kind: { in: ['onboarding', 'level_up'] } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      const seen = new Set(
        history.flatMap((a) => (a.state as unknown as AttemptState).questions.map((q) => q.id)),
      );
      if (kind === 'onboarding') {
        assert(!user.onboarding, 'Tes penempatan sudah selesai.', 409);
        for (let l = 1; l <= 5; l++) questions.push(...(await select(tx, l, 3, seen)));
      } else {
        assert(user.onboarding && user.level < 5, 'Tes naik level tidak tersedia.', 403);
        assert(
          (await eligible(tx, userId, user.level)).allowed,
          'Selesaikan unit atau capai akurasi 75% terlebih dahulu.',
          403,
        );
        const last = await tx.attempt.findFirst({
          where: { userId, kind, targetLevel: user.level + 1, completedAt: { not: null } },
          orderBy: { completedAt: 'desc' },
        });
        assert(
          !last || Date.now() - last.completedAt!.getTime() >= 86400000,
          'Coba kembali 24 jam setelah tes sebelumnya.',
          409,
        );
        targetLevel = user.level + 1;
        questions = [
          ...(await select(tx, targetLevel, 7, seen)),
          ...(await select(tx, level, 3, seen)),
        ];
        questions = shuffle(questions);
      }
    }
    const state: AttemptState = {
      questions,
      index: 0,
      playback: freshPlayback(),
      answered: false,
      finished: false,
    };
    const attempt = await tx.attempt.create({
      data: {
        userId,
        kind,
        unitId,
        level,
        targetLevel,
        configVersion: CONFIG_VERSION,
        state: json(state),
      },
    });
    return attempt.id;
  }, 'user:' + userId);
}
async function finish(
  tx: Tx,
  a: { id: string; userId: string; kind: string; targetLevel: number },
  s: AttemptState,
) {
  const answers = await tx.answer.findMany({ where: { attemptId: a.id } }),
    correct = answers.filter((a) => a.correct).length;
  const passed = a.kind === 'onboarding' || (a.kind === 'level_up' && correct >= 7);
  let level = a.targetLevel;
  if (a.kind === 'onboarding') {
    level = placement(
      s.questions.map((q) => ({
        level: q.level,
        correct: answers.find((a) => a.questionId === q.id)?.correct ?? false,
      })),
    );
    await tx.user.update({ where: { id: a.userId }, data: { onboarding: true, level } });
  } else if (a.kind === 'level_up' && passed) {
    await tx.user.updateMany({
      where: { id: a.userId, level: { lt: a.targetLevel } },
      data: { level: a.targetLevel },
    });
    await tx.pointEntry.upsert({
      where: { key: `level:${a.userId}:${level}` },
      create: { key: `level:${a.userId}:${level}`, userId: a.userId, amount: 1000 },
      update: {},
    });
  }
  s.finished = true;
  s.result = {
    correct,
    total: s.questions.length,
    score: answers.reduce((sum, a) => sum + a.score, 0),
    passed,
    level,
    weak: [
      ...new Set(
        s.questions
          .filter((q) => !answers.find((a) => a.questionId === q.id)?.correct)
          .map((q) => q.category),
      ),
    ],
  };
  await tx.attempt.update({
    where: { id: a.id },
    data: { completedAt: new Date(), state: json(s) },
  });
}
async function timeout(tx: Tx, a: { id: string; kind: string }, s: AttemptState, now: number) {
  if (s.finished || s.answered || s.playback.startedAt === null) return;
  const q = s.questions[s.index];
  if (s.playback.completedAt == null && now < s.playback.startedAt + durationMs(q) + 300000) return;
  if (s.playback.completedAt != null && now <= answerWindow(q, s.playback).deadline) return;
  await tx.answer.upsert({
    where: { attemptId_questionId: { attemptId: a.id, questionId: q.id } },
    create: {
      attemptId: a.id,
      questionId: q.id,
      questionVersion: q.version,
      value: Prisma.JsonNull,
      correct: false,
      score: 0,
      elapsedMs: q.seconds * 1000,
      replayCount: s.playback.replayCount,
    },
    update: {},
  });
  s.answered = true;
}
export async function attemptAction(userId: string, id: string, raw?: unknown) {
  return atomic(async (tx) => {
    const a = await tx.attempt.findUnique({ where: { id } });
    assert(a && a.userId === userId, 'Latihan tidak ditemukan.', 404);
    const s = a.state as unknown as AttemptState,
      now = Date.now();
    await timeout(tx, a, s, now);
    if (raw && !s.finished) {
      const c = commandSchema.parse(raw),
        q = s.questions[s.index];
      if (c.action === 'play') {
        assert(!s.answered, 'Soal telah dijawab.');
        if (s.playback.startedAt === null)
          s.playback = { startedAt: now, lastPlayAt: now, replayCount: 0 };
      }
      if (c.action === 'heard' && s.playback.completedAt == null) {
        assert(
          s.playback.startedAt !== null && now >= s.playback.startedAt + durationMs(q),
          'Dengarkan seluruh audio sebelum menjawab.',
        );
        s.playback.completedAt = now;
      }
      if (c.action === 'replay') {
        assert(
          !s.answered &&
            s.playback.completedAt != null &&
            s.playback.lastPlayAt !== null &&
            now >= s.playback.lastPlayAt + durationMs(q),
          'Tunggu audio selesai.',
        );
        assert(s.playback.replayCount < 2, 'Replay sudah habis.');
        assert(now < answerWindow(q, s.playback).deadline, 'Waktu habis.');
        s.playback.replayCount++;
        s.playback.lastPlayAt = now;
      }
      if (c.action === 'answer' && !s.answered) {
        const result = scoreAnswer(
          q,
          c.value,
          s.playback,
          now,
          a.kind === 'practice',
          a.kind !== 'practice',
        );
        const answer = await tx.answer.create({
          data: {
            attemptId: id,
            questionId: q.id,
            questionVersion: q.version,
            value: json(c.value),
            ...result,
          },
        });
        if (result.score)
          await tx.pointEntry.create({
            data: { userId, key: 'answer:' + answer.id, amount: result.score },
          });
        s.answered = true;
      }
      if (c.action === 'next') {
        assert(s.answered, 'Jawab soal atau tunggu waktu habis.');
        if (s.index + 1 === s.questions.length) await finish(tx, a, s);
        else {
          s.index++;
          s.playback = freshPlayback();
          s.answered = false;
        }
      }
    }
    await tx.attempt.update({ where: { id }, data: { state: json(s) } });
    const q = s.questions[s.index],
      answer = s.answered
        ? await tx.answer.findUnique({
            where: { attemptId_questionId: { attemptId: id, questionId: q.id } },
          })
        : null;
    return {
      id,
      kind: a.kind,
      index: s.index,
      total: s.questions.length,
      finished: s.finished,
      result: s.result,
      question: s.finished ? null : publicQuestion(q),
      nextAudio: s.questions[s.index + 1]?.audio.map((a) => a.url) ?? [],
      playback: s.playback,
      answered: s.answered,
      serverNow: now,
      deadline: s.playback.completedAt == null ? null : answerWindow(q, s.playback).deadline,
      feedback:
        s.answered && a.kind === 'practice'
          ? {
              correct: answer?.correct,
              score: answer?.score,
              accepted: q.accepted,
              transcript: q.transcript,
              explanation: q.explanation,
            }
          : null,
    };
  }, 'user:' + userId);
}
