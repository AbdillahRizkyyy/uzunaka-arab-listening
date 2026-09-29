import { describe, expect, it } from 'vitest';
import { canPublish, grade, placement, publicQuestion, rank, scoreAnswer } from '../src/lib/domain';
import { questionSchema, Question } from '../src/lib/contracts';
export const q: Question = {
  id: 'q1',
  unitId: 'u1',
  version: 1,
  level: 1,
  pool: 'practice',
  type: 'pilihan_ganda',
  prompt: 'Pilih',
  category: 'kampus',
  audio: [{ url: '/media/a.mp3', duration: 5, native: true, license: 'consent', reviewed: true }],
  options: [
    { id: 'a', text: 'أ' },
    { id: 'b', text: 'ب' },
  ],
  accepted: ['a'],
  transcript: 'أ',
  explanation: 'Penjelasan',
  harakat: 'full',
  seconds: 20,
};
describe('grading', () => {
  it('grades all choice types by ID', () => {
    for (const type of ['pilihan_ganda', 'beda_bunyi', 'pilih_gambar'] as const) {
      expect(grade({ ...q, type }, 'a')).toBe(true);
      expect(grade({ ...q, type }, 'أ')).toBe(false);
    }
  });
  it('orders duplicate words by unique tokens and permits explicit alternatives', () => {
    const ordered = {
      ...q,
      type: 'urutkan' as const,
      options: [
        { id: 'a', text: 'من' },
        { id: 'b', text: 'من' },
        { id: 'c', text: 'هو' },
      ],
      accepted: [
        ['a', 'b', 'c'],
        ['b', 'a', 'c'],
      ],
    };
    expect(grade(ordered, ['a', 'b', 'c'])).toBe(true);
    expect(grade(ordered, ['b', 'a', 'c'])).toBe(true);
    expect(grade(ordered, ['a', 'a', 'c'])).toBe(false);
  });
  it('dictation preserves marks, spaces and punctuation but normalizes NFC', () => {
    const dict = { ...q, type: 'dikte' as const, accepted: ['أَنا.'] };
    expect(grade(dict, 'أَنا.')).toBe(true);
    for (const text of ['أنا.', 'أَنا', ' أَنا.', 'أَنا. ']) expect(grade(dict, text)).toBe(false);
  });
});
describe('timing and score', () => {
  const playback = { startedAt: 1000, lastPlayAt: 1000, replayCount: 0, completedAt: 6000 };
  it('rejects before entire audio and after deadline', () => {
    expect(() => scoreAnswer(q, 'a', playback, 5999, false)).toThrow();
    expect(() => scoreAnswer(q, 'a', playback, 26001, false)).toThrow();
  });
  it('computes replay multipliers and solo rounding once', () => {
    expect(scoreAnswer(q, 'a', playback, 6000, false).score).toBe(150);
    expect(scoreAnswer(q, 'a', { ...playback, replayCount: 1 }, 6000, false).score).toBe(130);
    expect(scoreAnswer(q, 'a', { ...playback, replayCount: 2 }, 6000, true).score).toBe(56);
  });
  it('keeps timer running during replay and respects global deadline', () => {
    expect(
      scoreAnswer(q, 'a', { ...playback, lastPlayAt: 12000, replayCount: 1 }, 16000, false).score,
    ).toBe(115);
    expect(() => scoreAnswer(q, 'a', playback, 16000, false, false, 15000)).toThrow();
  });
  it('assessment and wrong answers give no score', () => {
    expect(scoreAnswer(q, 'a', playback, 6000, false, true).score).toBe(0);
    expect(scoreAnswer(q, 'b', playback, 6000, false).score).toBe(0);
  });
  it('adds durations for multiple clips', () => {
    expect(() =>
      scoreAnswer(
        { ...q, audio: [...q.audio, ...q.audio] },
        'a',
        { ...playback, completedAt: 11000 },
        10000,
        false,
      ),
    ).toThrow();
  });
});
describe('progress and privacy', () => {
  it('does not skip an insufficient earlier level', () => {
    const rows = [1, 2, 3, 4, 5].flatMap((level) =>
      [0, 1, 2].map((i) => ({ level, correct: level !== 2 && i < 2 })),
    );
    expect(placement(rows)).toBe(1);
    expect(placement(rows.map((r) => ({ ...r, correct: true })))).toBe(5);
    expect(placement([])).toBe(1);
  });
  it('redacts answers, transcripts, explanations and asset review metadata', () => {
    const dto = publicQuestion(q);
    expect(dto).not.toHaveProperty('accepted');
    expect(dto).not.toHaveProperty('transcript');
    expect(dto).not.toHaveProperty('explanation');
    expect(dto.audio[0]).not.toHaveProperty('license');
  });
  it('blocks synthetic and unreviewed content', () => {
    expect(canPublish(q)).toBe(true);
    expect(canPublish({ ...q, audio: [{ ...q.audio[0], native: false }] })).toBe(false);
    expect(canPublish({ ...q, audio: [{ ...q.audio[0], reviewed: false }] })).toBe(false);
  });
  it('ranks ties consistently', () => {
    expect(
      rank([
        { score: 100, correct: 1, elapsedMs: 20 },
        { score: 100, correct: 1, elapsedMs: 20 },
        { score: 100, correct: 1, elapsedMs: 30 },
      ]).map((r) => r.rank),
    ).toEqual([1, 1, 3]);
  });
  it('rejects ambiguous token IDs and missing image permissions', () => {
    expect(questionSchema.safeParse({ ...q, options: [q.options[0], q.options[0]] }).success).toBe(
      false,
    );
    expect(questionSchema.safeParse({ ...q, type: 'pilih_gambar' }).success).toBe(false);
  });
});
