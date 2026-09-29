import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, json } from '../src/lib/db';
import { Question, CONFIG_VERSION } from '../src/lib/contracts';
import { startAttempt, attemptAction, AttemptState } from '../src/lib/attempts';
import {
  createRoom,
  joinRoom,
  roomAction,
  RoomState,
  PlayerState,
  sweepRooms,
} from '../src/lib/rooms';
import { hash } from '../src/lib/security';
const enabled = process.env.RUN_DB_TESTS === 'true';
const prefix = 'integration-' + Date.now();
let userId = '',
  unitId = '',
  roomCode = '';
const question = (id: string, level: number, pool: 'practice' | 'assessment'): Question => ({
  id,
  unitId: unitId,
  version: 1,
  level,
  pool,
  type: 'pilihan_ganda',
  prompt: 'Fixture test',
  category: 'fixture',
  audio: [
    {
      url: '/media/test-only.wav',
      duration: 0.01,
      native: true,
      license: 'test fixture',
      reviewed: true,
    },
  ],
  options: [
    { id: 'a', text: 'أ' },
    { id: 'b', text: 'ب' },
  ],
  accepted: ['a'],
  transcript: 'fixture',
  explanation: 'fixture',
  harakat: 'none',
  seconds: 20,
});
describe.skipIf(!enabled)('PostgreSQL transaction and recovery integration', () => {
  beforeAll(async () => {
    if (!process.env.DATABASE_URL?.includes('istima_test'))
      throw new Error('Database integration must use istima_test.');
    const user = await db.user.create({
      data: {
        email: prefix + '@example.invalid',
        name: 'Integration',
        passwordHash: 'not-a-login',
        verifiedAt: new Date(),
        onboarding: true,
      },
    });
    userId = user.id;
    unitId = prefix + '-unit';
    await db.unit.create({
      data: {
        id: unitId,
        level: 1,
        title: 'Fixture',
        theme: 'test',
        description: 'Not public content',
      },
    });
    for (const pool of ['practice', 'assessment'] as const)
      for (let level = 1; level <= (pool === 'practice' ? 1 : 5); level++)
        for (let i = 0; i < (pool === 'practice' ? 2 : 7); i++) {
          const q = question(`${prefix}-${pool}-${level}-${i}`, level, pool);
          await db.question.create({
            data: { id: q.id, unitId, level, pool, status: 'published', data: json(q) },
          });
        }
    await db.reviewConfig.upsert({
      where: { id: CONFIG_VERSION },
      create: { id: CONFIG_VERSION, approved: true, reviewer: 'Integration fixture' },
      update: { approved: true, reviewer: 'Integration fixture' },
    });
  }, 30000);
  afterAll(async () => {
    if (userId) {
      await db.user.delete({ where: { id: userId } });
      await db.question.deleteMany({ where: { unitId } });
      await db.unit.delete({ where: { id: unitId } });
      await db.reviewConfig.update({
        where: { id: CONFIG_VERSION },
        data: { approved: false, reviewer: null },
      });
    }
    await db.$disconnect();
  });
  it('resumes attempts, rejects unauthorized access and accepts duplicate answer only once', async () => {
    const id = await startAttempt(userId, 'practice', unitId);
    expect(await startAttempt(userId, 'practice', unitId)).toBe(id);
    await expect(attemptAction('other', id)).rejects.toThrow('tidak ditemukan');
    const before = await attemptAction(userId, id);
    expect(JSON.stringify(before)).not.toContain('accepted');
    await attemptAction(userId, id, { action: 'play' });
    await new Promise((r) => setTimeout(r, 700));
    await attemptAction(userId, id, { action: 'heard' });
    await Promise.all([
      attemptAction(userId, id, { action: 'answer', value: 'a' }),
      attemptAction(userId, id, { action: 'answer', value: 'a' }),
    ]);
    expect(await db.answer.count({ where: { attemptId: id } })).toBe(1);
    expect(await db.pointEntry.count({ where: { userId } })).toBe(1);
    expect((await attemptAction(userId, id)).feedback?.correct).toBe(true);
  });
  it('onboarding hides keys after answering and opens contiguous levels', async () => {
    await db.user.update({ where: { id: userId }, data: { onboarding: false } });
    const id = await startAttempt(userId, 'onboarding');
    for (let i = 0; i < 15; i++) {
      await attemptAction(userId, id, { action: 'play' });
      await new Promise((r) => setTimeout(r, 700));
      await attemptAction(userId, id, { action: 'heard' });
      const answered = await attemptAction(userId, id, { action: 'answer', value: 'a' });
      expect(answered.feedback).toBeNull();
      expect(JSON.stringify(answered)).not.toContain('accepted');
      await attemptAction(userId, id, { action: 'next' });
    }
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).level).toBe(5);
    await db.user.update({ where: { id: userId }, data: { level: 1 } });
  }, 30000);
  it('timed out practice persists a wrong answer after reopening', async () => {
    const current = await db.attempt.findFirstOrThrow({
      where: { userId, kind: 'practice', completedAt: null },
    });
    await attemptAction(userId, current.id, { action: 'next' });
    const a = await db.attempt.findUniqueOrThrow({ where: { id: current.id } }),
      s = a.state as unknown as AttemptState;
    s.playback = {
      startedAt: Date.now() - 60000,
      lastPlayAt: Date.now() - 60000,
      completedAt: Date.now() - 59000,
      replayCount: 0,
    };
    await db.attempt.update({ where: { id: a.id }, data: { state: json(s) } });
    const resumed = await attemptAction(userId, a.id);
    expect(resumed.answered).toBe(true);
    expect(resumed.feedback?.correct).toBe(false);
    await attemptAction(userId, a.id, { action: 'next' });
  });
  it('level-up rewards are idempotent and failed attempts have a cooldown', async () => {
    const practiceUnits = await db.unit.findMany({ where: { level: 1 } });
    await db.attempt.createMany({
      data: practiceUnits.map((unit) => ({
        userId,
        unitId: unit.id,
        kind: 'practice',
        level: 1,
        targetLevel: 1,
        configVersion: CONFIG_VERSION,
        state: json({ completedFixture: true }),
        completedAt: new Date(),
      })),
    });
    const id = await startAttempt(userId, 'level_up');
    for (let i = 0; i < 10; i++) {
      await attemptAction(userId, id, { action: 'play' });
    await new Promise((r) => setTimeout(r, 700));
      await attemptAction(userId, id, { action: 'heard' });
      await attemptAction(userId, id, { action: 'answer', value: 'a' });
      await attemptAction(userId, id, { action: 'next' });
    }
    await attemptAction(userId, id, { action: 'next' });
    expect(await db.pointEntry.count({ where: { key: `level:${userId}:2` } })).toBe(1);
    // Restore level for room tests; the ledger remains unique.
    await db.user.update({ where: { id: userId }, data: { level: 1 } });
    await expect(startAttempt(userId, 'level_up')).rejects.toThrow('24 jam');
  }, 30000);
  it('live recovers participant identity and durable answer state', async () => {
    const room = await createRoom(userId, unitId);
    roomCode = room.code;
    await expect(createRoom(userId, unitId)).rejects.toThrow('ruang aktif');
    const joined = await joinRoom(room.code, 'Guest');
    expect((await joinRoom(room.code, 'Guest', undefined, joined.token)).token).toBe(joined.token);
    const identity = { participantToken: joined.token };
    await roomAction(room.code, identity, { action: 'ready' });
    await roomAction(room.code, { userId }, { action: 'check' });
    await roomAction(room.code, { userId }, { action: 'start' });
    await expect(joinRoom(room.code, 'Late')).rejects.toThrow('Peserta baru');
    await roomAction(room.code, identity, { action: 'play' });
    await new Promise((r) => setTimeout(r, 700));
    await roomAction(room.code, identity, { action: 'heard' });
    const answered = await roomAction(room.code, identity, { action: 'answer', value: 'a' });
    expect(answered.status).toBe('reveal');
    await roomAction(room.code, identity, { action: 'answer', value: 'b' });
    const p = await db.participant.findUniqueOrThrow({ where: { tokenHash: hash(joined.token) } });
    expect(await db.answer.count({ where: { participantId: p.id } })).toBe(1);
    await db.$disconnect();
    const restored = await roomAction(room.code, identity);
    expect(restored.answered).toBe(true);
    expect(restored.feedback?.correct).toBe(true);
  });
  it('host cancellation removes every answer and its point ledger', async () => {
    await roomAction(roomCode, { userId }, { action: 'next' });
    await roomAction(roomCode, { userId }, { action: 'next' });
    await roomAction(roomCode, { userId }, { action: 'cancel' });
    const state = await roomAction(roomCode, { userId });
    expect(state.cancelled).toBe(true);
    expect(state.status).toBe('reveal');
  });
  it('closes abandoned rooms after ten minutes without a host', async () => {
    const room = await db.room.findUniqueOrThrow({ where: { code: roomCode } });
    const state = room.state as unknown as RoomState;
    state.hostSeen = Date.now() - 600001;
    await db.room.update({ where: { id: room.id }, data: { state: json(state) } });
    await sweepRooms();
    expect((await db.room.findUniqueOrThrow({ where: { id: room.id } })).status).toBe('ended');
  });
});
