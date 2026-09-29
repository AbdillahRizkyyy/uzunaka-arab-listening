import { AnswerValue, Question, PublicQuestion, levels } from './contracts';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new AppError(message, status);
}
export function publicQuestion(q: Question): PublicQuestion {
  return {
    id: q.id,
    unitId: q.unitId,
    version: q.version,
    level: q.level,
    pool: q.pool,
    type: q.type,
    prompt: q.prompt,
    category: q.category,
    options: q.options,
    harakat: q.harakat,
    seconds: q.seconds,
    audio: q.audio.map((a) => ({ url: a.url, duration: a.duration })),
  };
}
export function grade(q: Question, value: AnswerValue) {
  return q.accepted.some((a) =>
    Array.isArray(a)
      ? Array.isArray(value) && a.length === value.length && a.every((id, i) => id === value[i])
      : typeof value === 'string' &&
        (q.type === 'dikte' ? a.normalize('NFC') === value.normalize('NFC') : a === value),
  );
}
export const durationMs = (q: Question) =>
  Math.ceil(q.audio.reduce((n, a) => n + a.duration, 0) * 1000);
export type Playback = {
  startedAt: number | null;
  replayCount: number;
  lastPlayAt: number | null;
  completedAt?: number | null;
};
export const freshPlayback = (): Playback => ({
  startedAt: null,
  replayCount: 0,
  lastPlayAt: null,
  completedAt: null,
});
export function answerWindow(q: Question, p: Playback, globalDeadline?: number) {
  assert(p.startedAt !== null, 'Putar audio terlebih dahulu.');
  const opensAt = p.completedAt ?? p.startedAt + durationMs(q);
  return { opensAt, deadline: Math.min(opensAt + q.seconds * 1000, globalDeadline ?? Infinity) };
}
export function scoreAnswer(
  q: Question,
  value: AnswerValue,
  p: Playback,
  now: number,
  practice: boolean,
  assessment = false,
  globalDeadline?: number,
) {
  assert(p.completedAt != null, 'Tunggu audio pertama selesai.');
  const { opensAt, deadline } = answerWindow(q, p, globalDeadline);
  assert(now >= opensAt, 'Dengarkan seluruh audio sebelum menjawab.');
  assert(now <= deadline, 'Waktu menjawab sudah habis.');
  const correct = grade(q, value),
    elapsedMs = Math.max(0, now - opensAt),
    base = levels[q.level - 1].points;
  const remaining = Math.max(0, Math.min(1, (deadline - now) / (q.seconds * 1000)));
  const bonus = base * remaining * 0.5 * [1, 0.6, 0.25][p.replayCount];
  return {
    correct,
    score: correct && !assessment ? Math.round((base + bonus) * (practice ? 0.5 : 1)) : 0,
    elapsedMs,
    replayCount: p.replayCount,
  };
}
export function placement(results: { level: number; correct: boolean }[]) {
  let placed = 1;
  for (let level = 1; level <= 5; level++) {
    if (results.filter((r) => r.level === level && r.correct).length < 2) break;
    placed = level;
  }
  return placed;
}
export function rank<T extends { score: number; correct: number; elapsedMs: number }>(rows: T[]) {
  const sorted = [...rows].sort(
    (a, b) => b.score - a.score || b.correct - a.correct || a.elapsedMs - b.elapsedMs,
  );
  let position = 1;
  return sorted.map((row, i) => {
    if (
      i &&
      (row.score !== sorted[i - 1].score ||
        row.correct !== sorted[i - 1].correct ||
        row.elapsedMs !== sorted[i - 1].elapsedMs)
    )
      position = i + 1;
    return { ...row, rank: position };
  });
}
export function canPublish(q: Question) {
  return (
    q.audio.every((a) => a.native && a.reviewed && a.license.trim().length > 0) &&
    (q.type !== 'pilih_gambar' || q.options.every((o) => !!o.license?.trim()))
  );
}
