import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { db, json } from '../src/lib/db';
import { createRoom, joinRoom, roomAction, roomAnswer, sweepRooms } from '../src/lib/rooms';
import { Question } from '../src/lib/contracts';
async function batch<T>(tasks: Promise<T>[]) {
  const settled = await Promise.allSettled(tasks);
  const failed = settled.find((r) => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}
async function main() {
  if (!process.env.DATABASE_URL?.includes('istima_test'))
    throw new Error('Load test hanya boleh menggunakan database istima_test.');
  if (process.argv.includes('--cleanup')) {
    await db.room.deleteMany({ where: { host: { email: { startsWith: 'load-' } } } });
    await db.user.deleteMany({ where: { email: { startsWith: 'load-' }, name: 'Load host' } });
    await db.question.deleteMany({ where: { unitId: { startsWith: 'load-' } } });
    await db.unit.deleteMany({ where: { id: { startsWith: 'load-' }, theme: 'test' } });
    console.log('Fixture load test dibersihkan.');
    return;
  }
  const prefix = 'load-' + Date.now(),
    unitId = prefix + '-unit',
    users: string[] = [],
    codes: string[] = [],
    latencies: number[] = [];
  await db.unit.create({
    data: { id: unitId, level: 1, title: 'Load fixture', theme: 'test', description: 'Test only' },
  });
  try {
    for (let i = 0; i < 5; i++) {
      const q: Question = {
        id: prefix + '-q' + i,
        unitId,
        version: 1,
        level: 1,
        pool: 'practice',
        type: 'pilihan_ganda',
        prompt: 'Load fixture',
        category: 'test',
        audio: [
          {
            url: '/media/test-only.wav',
            duration: 0.01,
            native: true,
            reviewed: true,
            license: 'test',
          },
        ],
        options: [
          { id: 'a', text: 'أ' },
          { id: 'b', text: 'ب' },
        ],
        accepted: ['a'],
        transcript: 'test',
        explanation: 'test',
        seconds: 30,
        harakat: 'none',
      };
      await db.question.create({
        data: { id: q.id, unitId, level: 1, pool: 'practice', status: 'published', data: json(q) },
      });
    }
    const sessions: { code: string; userId: string; tokens: string[] }[] = [];
    for (let i = 0; i < 5; i++) {
      const host = await db.user.create({
        data: {
          email: `${prefix}-${i}@example.invalid`,
          name: 'Load host',
          passwordHash: 'disabled',
          verifiedAt: new Date(),
        },
      });
      users.push(host.id);
      const room = await createRoom(host.id, unitId);
      codes.push(room.code);
      const tokens: string[] = [];
      for (let p = 0; p < 30; p++) {
        const joined = await joinRoom(room.code, 'Load ' + p);
        tokens.push(joined.token);
        await roomAction(room.code, { participantToken: joined.token }, { action: 'ready' });
      }
      await roomAction(room.code, { userId: host.id }, { action: 'check' });
      sessions.push({ code: room.code, userId: host.id, tokens });
      console.log(`Room ${i + 1}/5 ready`);
    }
    for (let question = 0; question < 5; question++) {
      for (const s of sessions) {
        if (!question) await roomAction(s.code, { userId: s.userId }, { action: 'start' });
        else {
          await roomAction(s.code, { userId: s.userId }, { action: 'next' });
          await roomAction(s.code, { userId: s.userId }, { action: 'next' });
        }
      }
      await batch(
        sessions.flatMap((s) =>
          s.tokens.map((t) => roomAction(s.code, { participantToken: t }, { action: 'play' })),
        ),
      );
      await new Promise((r) => setTimeout(r, 20));
      await batch(
        sessions.flatMap((s) =>
          s.tokens.map((t) => roomAction(s.code, { participantToken: t }, { action: 'heard' })),
        ),
      );
      await batch(
        sessions.flatMap((s) =>
          s.tokens.map(async (t) => {
            const start = performance.now();
            await roomAnswer(s.code, { participantToken: t }, 'a');
            latencies.push(performance.now() - start);
          }),
        ),
      );
      await sweepRooms();
      console.log(`Question ${question + 1}/5 complete`);
    }
    const count = await db.answer.count({
      where: { participant: { room: { code: { in: codes } } } },
    });
    latencies.sort((a, b) => a - b);
    const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1];
    console.log(
      JSON.stringify(
        {
          kind: 'service-database-load-not-network',
          rooms: 5,
          participants: 150,
          questions: 5,
          expectedAnswers: 750,
          persistedAnswers: count,
          p95Ms: Math.round(p95),
          node: process.version,
          platform: process.platform,
          passed: count === 750 && p95 < 1000,
        },
        null,
        2,
      ),
    );
    if (count !== 750 || p95 >= 1000) process.exitCode = 1;
  } finally {
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.question.deleteMany({ where: { unitId } });
    await db.unit.delete({ where: { id: unitId } });
  }
}
main()
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
