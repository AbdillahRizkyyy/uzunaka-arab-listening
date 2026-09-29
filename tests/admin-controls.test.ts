import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db, json } from '../src/lib/db';
import { adminWrite, adminRead, saveRevision } from '../src/lib/admin-controls';
import { startAttempt, type AttemptState } from '../src/lib/attempts';
import { createRoom, type RoomState } from '../src/lib/rooms';
import type { Question } from '../src/lib/contracts';
const prefix = 'controls-' + Date.now();
let userId = '';
const unitId = prefix + '-unit', targetId = prefix + '-target';
const q: Question = { id: prefix + '-q', unitId, level: 1, version: 1, pool: 'practice', type: 'dikte', prompt: 'Dikte awal', category: 'test', audio: [{ url: '/media/test-tone.wav', duration: .2, native: false, reviewed: false, license: 'test' }], options: [], accepted: ['أَنا.'], transcript: 'أَنا.', explanation: 'Awal', harakat: 'full', seconds: 30 };
describe.skipIf(process.env.RUN_DB_TESTS !== 'true')('admin controls preserve history and access', () => {
  beforeAll(async () => {
    if (!new URL(process.env.DATABASE_URL!).pathname.endsWith('/istima_test')) throw new Error('Must use istima_test');
    userId = (await db.user.create({ data: { email: prefix + '@example.invalid', name: prefix, passwordHash: 'no-login', verifiedAt: new Date(), onboarding: true } })).id;
    for (const id of [unitId, targetId]) await db.unit.create({ data: { id, title: prefix, theme: 'test', description: 'test', level: 1 } });
    await db.question.create({ data: { id: q.id, unitId, level: 1, pool: 'practice', status: 'published', data: json(q) } });
  });
  afterAll(async () => {
    await db.user.deleteMany({ where: { email: prefix + '@example.invalid' } });
    const units = await db.unit.findMany({ where: { title: { startsWith: prefix } } });
    const questions = await db.question.findMany({ where: { unitId: { in: units.map(u => u.id) } } });
    await db.questionRevision.deleteMany({ where: { questionId: { in: questions.map(q => q.id) } } });
    await db.question.deleteMany({ where: { id: { in: questions.map(q => q.id) } } });
    await db.unit.deleteMany({ where: { id: { in: units.map(u => u.id) } } });
    await db.$disconnect();
  });
  it('restores as new draft without altering active attempt or room snapshots', async () => {
    const attempt = await startAttempt(userId, 'practice', unitId);
    const room = await createRoom(userId, unitId);
    await db.$transaction(async tx => { await saveRevision(tx, { id: q.id, version: 1, data: q }, userId); await tx.question.update({ where: { id: q.id }, data: { version: 2, data: json({ ...q, version: 2, explanation: 'Berubah' }) } }); });
    await adminWrite('restore-question', { id: q.id, version: 1, expectedVersion: 2 }, userId);
    const restored = await db.question.findUniqueOrThrow({ where: { id: q.id } });
    expect(restored.version).toBe(3); expect(restored.status).toBe('draft'); expect((restored.data as Question).explanation).toBe('Awal');
    expect(((await db.attempt.findUniqueOrThrow({ where: { id: attempt } })).state as unknown as AttemptState).questions[0].version).toBe(1);
    expect(((await db.room.findUniqueOrThrow({ where: { id: room.id } })).state as unknown as RoomState).questions[0].version).toBe(1);
    await expect(adminWrite('restore-question', { id: q.id, version: 1, expectedVersion: 2 }, userId)).rejects.toThrow('berubah');
    await db.room.update({ where: { id: room.id }, data: { status: 'ended' } });
    await db.attempt.update({ where: { id: attempt }, data: { completedAt: new Date() } });
  });
  it('copies to draft, moves atomically, and respects question order', async () => {
    await adminWrite('duplicate-unit', { id: unitId }, userId);
    const copy = await db.unit.findFirstOrThrow({ where: { title: prefix + ' (salinan)' }, include: { questions: true } });
    expect(copy.questions).toHaveLength(1); expect(copy.questions[0].status).toBe('draft'); expect(copy.questions[0].id).not.toBe(q.id);
    await expect(adminWrite('move-questions', { unitId: targetId, ids: [q.id, 'missing'] }, userId)).rejects.toThrow();
    expect((await db.question.findUniqueOrThrow({ where: { id: q.id } })).unitId).toBe(unitId);
    await adminWrite('move-questions', { unitId: targetId, ids: [q.id] }, userId);
    const other = { ...q, id: prefix + '-other', unitId: targetId };
    await db.question.create({ data: { id: other.id, unitId: targetId, level: 1, pool: 'practice', status: 'published', data: json(other) } });
    await db.question.update({ where: { id: q.id }, data: { status: 'published' } });
    await adminWrite('order-questions', { unitId: targetId, ids: [other.id, q.id] }, userId);
    const attempt = await startAttempt(userId, 'practice', targetId);
    expect(((await db.attempt.findUniqueOrThrow({ where: { id: attempt } })).state as unknown as AttemptState).questions.map(q => q.id)).toEqual([other.id, q.id]);
    await db.attempt.update({ where: { id: attempt }, data: { completedAt: new Date() } });
    await adminWrite('archive-unit', { id: targetId, archived: true }, userId);
    await expect(startAttempt(userId, 'practice', targetId)).rejects.toThrow('diarsipkan');
    await expect(createRoom(userId, targetId)).rejects.toThrow('materi');
  });
  it('deactivates other accounts with session invalidation, protects self, searches all users', async () => {
    await expect(adminWrite('user-status', { id: userId, disabled: true }, userId)).rejects.toThrow('sendiri');
    await adminWrite('user-status', { id: userId, disabled: true }, 'test-admin');
    const disabled = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(disabled.disabledAt).not.toBeNull(); expect(disabled.authVersion).toBe(1);
    const result = await adminRead('users', new URLSearchParams({ search: prefix })) as {rows: {id: string}[];total: number};
    expect(result.total).toBe(1); expect(result.rows[0].id).toBe(userId); expect(result.rows[0]).not.toHaveProperty('passwordHash');
    await adminWrite('user-status', { id: userId, disabled: false }, 'test-admin');
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).disabledAt).toBeNull();
  });
});
