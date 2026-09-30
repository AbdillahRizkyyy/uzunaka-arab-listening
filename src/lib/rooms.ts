import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { atomic, db, json, Tx } from './db';
import { Question, answerSchema, commandSchema, roomCommandSchema } from './contracts';
import {
  assert,
  durationMs,
  freshPlayback,
  Playback,
  publicQuestion,
  rank,
  scoreAnswer,
  answerWindow,
} from './domain';
import { hash, token } from './security';
import { shuffle } from './attempts';
import { allowsDemoContent } from './environment';
export type RoomState = {
  questions: Question[];
  index: number;
  openedAt: number | null;
  deadline: number | null;
  hostSeen: number;
  cancelled: boolean;
};
export type PlayerState = { ready: boolean; removed: boolean; playback: Playback; index: number };
export type Identity = { userId?: string; participantToken?: string; participantId?: string };
const initialPlayer = (): PlayerState => ({
  ready: false,
  removed: false,
  playback: freshPlayback(),
  index: 0,
});
async function identify(tx: Tx, room: { id: string; hostId: string }, identity: Identity) {
  if (identity.userId === room.hostId) return { host: true, participant: null };
  const participant = identity.participantId
    ? await tx.participant.findUnique({ where: { id: identity.participantId } })
    : identity.participantToken
      ? await tx.participant.findUnique({ where: { tokenHash: hash(identity.participantToken) } })
      : null;
  assert(
    participant &&
      participant.roomId === room.id &&
      !(participant.state as unknown as PlayerState).removed,
    'Akses ruang tidak valid.',
    403,
  );
  return { host: false, participant };
}
export async function createRoom(userId: string, unitId: string) {
  return atomic(async (tx) => {
    const active = await tx.room.findMany({ where: { status: { not: 'ended' } } });
    assert(
      active.length < 5,
      'Lima ruang sedang aktif. Coba kembali setelah salah satu selesai.',
      409,
    );
    assert(!active.some((r) => r.hostId === userId), 'Anda masih memiliki ruang aktif.', 409);
    const questions = (
      await tx.question.findMany({
        where: {
          unitId,
          pool: 'practice',
          status: 'published',
          unit: {
            archived: false,
            ...(!allowsDemoContent() ? { developmentOnly: false } : {}),
          },
        },
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
      })
    ).map((q) => ({ ...(q.data as Question), options: shuffle((q.data as Question).options) }));
    assert(questions.length, 'Unit belum memiliki materi terbit.', 409);
    let code = '';
    do {
      code = Array.from(
        { length: 6 },
        () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)],
      ).join('');
    } while (await tx.room.findUnique({ where: { code } }));
    const state: RoomState = {
      questions,
      index: 0,
      openedAt: null,
      deadline: null,
      hostSeen: Date.now(),
      cancelled: false,
    };
    return tx.room.create({
      data: { hostId: userId, code, state: json(state) },
      select: { id: true, code: true },
    });
  });
}
export async function joinRoom(code: string, name: string, userId?: string, oldToken?: string) {
  return atomic(async (tx) => {
    const room = await tx.room.findUnique({ where: { code } });
    assert(room, 'Kode ruang tidak ditemukan.', 404);
    if (oldToken) {
      const p = await tx.participant.findUnique({ where: { tokenHash: hash(oldToken) } });
      if (p && p.roomId === room.id && !(p.state as unknown as PlayerState).removed)
        return { id: room.id, code, token: oldToken };
    }
    assert(
      room.status === 'lobby' || room.status === 'check',
      'Sesi telah dimulai. Peserta baru tidak dapat bergabung.',
      409,
    );
    const all = await tx.participant.findMany({ where: { roomId: room.id } });
    assert(
      all.filter((p) => !(p.state as unknown as PlayerState).removed).length < 30,
      'Ruang sudah berisi 30 peserta.',
      409,
    );
    assert(
      !userId || !all.some((p) => p.userId === userId),
      'Akun ini sudah bergabung. Gunakan perangkat awal.',
      409,
    );
    const raw = token();
    await tx.participant.create({
      data: { roomId: room.id, userId, name, tokenHash: hash(raw), state: json(initialPlayer()) },
    });
    return { id: room.id, code, token: raw };
  }, 'room:' + code);
}
async function closeQuestion(tx: Tx, room: { id: string; status: string }, s: RoomState) {
  const players = await tx.participant.findMany({ where: { roomId: room.id } }),
    q = s.questions[s.index];
  if (!s.cancelled)
    await tx.answer.createMany({
      skipDuplicates: true,
      data: players
        .filter((p) => !(p.state as unknown as PlayerState).removed)
        .map((player) => ({
          participantId: player.id,
          questionId: q.id,
          questionVersion: q.version,
          value: Prisma.JsonNull,
          correct: false,
          score: 0,
          elapsedMs: q.seconds * 1000,
          replayCount: (player.state as unknown as PlayerState).playback.replayCount,
        })),
    });
  room.status = 'reveal';
}
async function settle(tx: Tx, room: { id: string; status: string }, s: RoomState, now: number) {
  if (room.status === 'question') {
    const players = await tx.participant.findMany({ where: { roomId: room.id } }),
      active = players.filter((p) => !(p.state as unknown as PlayerState).removed);
    const q = s.questions[s.index];
    const expired = active.filter((p) => {
      const ps = p.state as unknown as PlayerState;
      return (
        ps.playback.completedAt != null && now > answerWindow(q, ps.playback, s.deadline!).deadline
      );
    });
    if (expired.length)
      await tx.answer.createMany({
        skipDuplicates: true,
        data: expired.map((p) => ({
          participantId: p.id,
          questionId: q.id,
          questionVersion: q.version,
          value: Prisma.JsonNull,
          correct: false,
          score: 0,
          elapsedMs: q.seconds * 1000,
          replayCount: (p.state as unknown as PlayerState).playback.replayCount,
        })),
      });
    const count = await tx.answer.count({
      where: {
        participantId: { in: active.map((p) => p.id) },
        questionId: s.questions[s.index].id,
      },
    });
    if (now >= (s.deadline ?? 0) || (active.length > 0 && count === active.length))
      await closeQuestion(tx, room, s);
  }
  if (room.status !== 'ended' && now - s.hostSeen > 600000) room.status = 'ended';
}
export async function roomAction(code: string, identity: Identity, raw?: unknown) {
  return atomic(async (tx) => {
    const room = await tx.room.findUnique({ where: { code } });
    assert(room, 'Ruang tidak ditemukan.', 404);
    const who = await identify(tx, room, identity),
      s = room.state as unknown as RoomState,
      now = Date.now();
    await settle(tx, room, s, now);
    if (who.host) s.hostSeen = now;
    if (raw && room.status !== 'ended') {
      const action = (raw as { action: string }).action;
      if (['check', 'ready', 'start', 'next', 'cancel', 'end', 'remove'].includes(action)) {
        const c = roomCommandSchema.parse(raw);
        if (c.action === 'ready') {
          assert(
            who.participant && (room.status === 'check' || room.status === 'lobby'),
            'Audio check tidak tersedia.',
          );
          const ps = who.participant.state as unknown as PlayerState;
          ps.ready = true;
          await tx.participant.update({
            where: { id: who.participant.id },
            data: { state: json(ps) },
          });
        } else {
          assert(who.host, 'Hanya host yang dapat mengatur sesi.', 403);
          if (c.action === 'check') {
            assert(room.status === 'lobby', 'Ruang sudah dimulai.');
            room.status = 'check';
          }
          if (c.action === 'remove') {
            const p = await tx.participant.findUnique({ where: { id: c.participantId ?? '' } });
            assert(p && p.roomId === room.id, 'Peserta tidak ditemukan.');
            const ps = p.state as unknown as PlayerState;
            ps.removed = true;
            await tx.participant.update({ where: { id: p.id }, data: { state: json(ps) } });
          }
          if (c.action === 'cancel') {
            assert(room.status === 'question', 'Tidak ada soal aktif.');
            s.cancelled = true;
            const answers = await tx.answer.findMany({
              where: { participant: { roomId: room.id }, questionId: s.questions[s.index].id },
            });
            await tx.pointEntry.deleteMany({
              where: { key: { in: answers.map((a) => 'answer:' + a.id) } },
            });
            await tx.answer.deleteMany({ where: { id: { in: answers.map((a) => a.id) } } });
            await closeQuestion(tx, room, s);
          }
          if (c.action === 'end') room.status = 'ended';
          if (c.action === 'start' || c.action === 'next') {
            if (c.action === 'start') {
              assert(room.status === 'check', 'Lakukan audio check terlebih dahulu.');
              const ps = await tx.participant.findMany({ where: { roomId: room.id } }),
                active = ps.filter((p) => !(p.state as unknown as PlayerState).removed);
              assert(
                active.length > 0 && active.every((p) => (p.state as unknown as PlayerState).ready),
                'Tunggu semua peserta menyelesaikan audio check.',
              );
            } else {
              assert(
                room.status === 'reveal' || room.status === 'leaderboard',
                'Tunggu fase menjawab selesai.',
              );
              if (room.status === 'reveal') {
                room.status = 'leaderboard';
              } else {
                s.index++;
                if (s.index >= s.questions.length) room.status = 'ended';
                else room.status = 'check';
              }
            }
            if (c.action === 'start' || room.status === 'check') {
              room.status = 'question';
              s.openedAt = now;
              s.deadline =
                now +
                15000 +
                durationMs(s.questions[s.index]) +
                s.questions[s.index].seconds * 1000;
              s.cancelled = false;
              const ps = await tx.participant.findMany({ where: { roomId: room.id } });
              for (const p of ps)
                await tx.participant.update({
                  where: { id: p.id },
                  data: {
                    state: json({
                      ...(p.state as unknown as PlayerState),
                      index: s.index,
                      playback: freshPlayback(),
                    }),
                  },
                });
            }
          }
        }
      } else {
        assert(who.participant, 'Host tidak dapat menjawab.', 403);
        const c = commandSchema.parse(raw);
        const q = s.questions[s.index],
          p = who.participant,
          ps = p.state as unknown as PlayerState;
        const existing = await tx.answer.findUnique({
          where: { participantId_questionId: { participantId: p.id, questionId: q.id } },
        });
        // Retries after an accepted answer return the persisted result, including after reveal.
        if (!(c.action === 'answer' && existing)) {
          assert(room.status === 'question', 'Fase menjawab sudah berakhir.', 409);
          assert(!existing, 'Jawaban sudah diterima.', 409);
          if (c.action === 'play' && ps.playback.startedAt === null)
            ps.playback = { startedAt: now, lastPlayAt: now, replayCount: 0 };
          if (c.action === 'heard' && ps.playback.completedAt == null) {
            assert(
              ps.playback.startedAt !== null && now >= ps.playback.startedAt + durationMs(q),
              'Dengarkan seluruh audio sebelum menjawab.',
            );
            ps.playback.completedAt = now;
          }
          if (c.action === 'replay') {
            assert(
              ps.playback.completedAt != null &&
                ps.playback.lastPlayAt !== null &&
                now >= ps.playback.lastPlayAt + durationMs(q),
              'Tunggu audio selesai.',
            );
            assert(ps.playback.replayCount < 2, 'Replay sudah habis.');
            assert(now < answerWindow(q, ps.playback, s.deadline!).deadline, 'Waktu habis.');
            ps.playback.replayCount++;
            ps.playback.lastPlayAt = now;
          }
          if (c.action === 'answer') {
            const result = scoreAnswer(q, c.value, ps.playback, now, false, false, s.deadline!);
            const a = await tx.answer.create({
              data: {
                participantId: p.id,
                questionId: q.id,
                questionVersion: q.version,
                value: json(c.value),
                ...result,
              },
            });
            if (p.userId && result.score)
              await tx.pointEntry.create({
                data: { userId: p.userId, key: 'answer:' + a.id, amount: result.score },
              });
          }
          await tx.participant.update({ where: { id: p.id }, data: { state: json(ps) } });
        }
      }
    }
    await settle(tx, room, s, now);
    await tx.room.update({ where: { id: room.id }, data: { status: room.status, state: json(s) } });
    return projectRoom(tx, room, who, s, now);
  }, 'room:' + code);
}
export async function sweepRooms() {
  const rooms = await db.room.findMany({
    where: { status: { not: 'ended' } },
    select: { code: true },
  });
  await Promise.all(
    rooms.map(({ code }) =>
      atomic(async (tx) => {
        const room = await tx.room.findUnique({ where: { code } });
        if (!room || room.status === 'ended') return;
        const s = room.state as unknown as RoomState;
        await settle(tx, room, s, Date.now());
        await tx.room.update({
          where: { id: room.id },
          data: { status: room.status, state: json(s) },
        });
      }, 'room:' + code),
    ),
  );
}
export async function roomIdentity(code: string, identity: Identity) {
  return atomic(async (tx) => {
    const room = await tx.room.findUnique({ where: { code } });
    assert(room, 'Ruang tidak ditemukan.', 404);
    const who = await identify(tx, room, identity);
    return {
      roomId: room.id,
      ...(who.host ? { userId: room.hostId } : { participantId: who.participant!.id }),
    };
  });
}

// Answer acknowledgements do not wait for a room-wide projection. Shared room
// locks allow independent players to commit concurrently while host transitions
// and cancellation take the exclusive room lock. Never return correctness here.
export async function roomAnswer(code: string, identity: Identity, value: unknown) {
  const parsed = answerSchema.parse(value);
  const participantKey = identity.participantId ?? hash(identity.participantToken ?? '');
  return atomic(
    async (tx) => {
      const room = await tx.room.findUnique({ where: { code } });
      assert(room, 'Ruang tidak ditemukan.', 404);
      const who = await identify(tx, room, identity);
      assert(who.participant, 'Host tidak dapat menjawab.', 403);
      const s = room.state as unknown as RoomState,
        p = who.participant,
        ps = p.state as unknown as PlayerState,
        q = s.questions[Math.min(s.index, s.questions.length - 1)];
      const existing = await tx.answer.findUnique({
        where: { participantId_questionId: { participantId: p.id, questionId: q.id } },
      });
      if (existing) return { ack: true as const, answered: true, serverNow: Date.now() };
      assert(room.status === 'question', 'Fase menjawab sudah berakhir.', 409);
      const result = scoreAnswer(q, parsed, ps.playback, Date.now(), false, false, s.deadline!);
      const answer = await tx.answer.create({
        data: {
          participantId: p.id,
          questionId: q.id,
          questionVersion: q.version,
          value: json(parsed),
          ...result,
        },
      });
      if (p.userId && result.score)
        await tx.pointEntry.create({
          data: { userId: p.userId, key: 'answer:' + answer.id, amount: result.score },
        });
      return { ack: true as const, answered: true, serverNow: Date.now() };
    },
    'answer:' + participantKey,
    ['room:' + code],
  );
}

async function projectRoom(
  tx: Tx,
  room: { id: string; code: string; status: string },
  who: Awaited<ReturnType<typeof identify>>,
  s: RoomState,
  now: number,
) {
  const players = await tx.participant.findMany({
      where: { roomId: room.id },
      include: { answers: true },
    }),
    active = players.filter((p) => !(p.state as unknown as PlayerState).removed);
  const q = s.questions[Math.min(s.index, s.questions.length - 1)],
    mine = players.find((p) => p.id === who.participant?.id),
    ps = mine?.state as unknown as PlayerState | undefined;
  const answer = mine?.answers.find((a) => a.questionId === q.id);
  const revealed = ['reveal', 'leaderboard', 'ended'].includes(room.status);
  const personalDeadline =
    ps?.playback.completedAt != null
      ? answerWindow(q, ps.playback, s.deadline ?? undefined).deadline
      : s.deadline;
  return {
    id: room.id,
    code: room.code,
    host: who.host,
    status: room.status,
    index: s.index,
    total: s.questions.length,
    serverNow: now,
    openedAt: s.openedAt,
    deadline: who.host ? s.deadline : personalDeadline,
    hostOnline: now - s.hostSeen < 15000,
    cancelled: s.cancelled,
    question: room.status === 'question' || revealed ? publicQuestion(q) : null,
    nextAudio: s.questions[s.index + 1]?.audio.map((a) => a.url) ?? [],
    playback: ps?.playback ?? freshPlayback(),
    answered: !!answer,
    ready: ps?.ready ?? false,
    feedback: revealed
      ? {
          correct: answer?.correct,
          score: answer?.score,
          accepted: q.accepted,
          transcript: q.transcript,
          explanation: q.explanation,
        }
      : null,
    players: active.map((p) => ({
      id: p.id,
      name: p.name,
      ready: (p.state as unknown as PlayerState).ready,
    })),
    answeredCount: active.filter((p) => p.answers.some((a) => a.questionId === q.id)).length,
    leaderboard: revealed
      ? rank(
          active.map((p) => ({
            id: p.id,
            name: p.name,
            score: p.answers.reduce((n, a) => n + a.score, 0),
            correct: p.answers.filter((a) => a.correct).length,
            elapsedMs: p.answers.reduce((n, a) => n + a.elapsedMs, 0),
          })),
        )
      : [],
  };
}

export async function roomSnapshot(code: string, identity: Identity) {
  const room = await db.room.findUnique({ where: { code } });
  assert(room, 'Ruang tidak ditemukan.', 404);
  const state = room.state as unknown as RoomState;
  if (
    (room.status === 'question' && Date.now() >= (state.deadline ?? 0)) ||
    (room.status !== 'ended' && Date.now() - state.hostSeen > 600000)
  )
    return roomAction(code, identity);
  return db.$transaction(async (tx) => {
    const current = await tx.room.findUnique({ where: { code } });
    assert(current, 'Ruang tidak ditemukan.', 404);
    const who = await identify(tx, current, identity),
      s = current.state as unknown as RoomState,
      now = Date.now();
    if (who.host && current.status !== 'ended') {
      await tx.$executeRaw`UPDATE "Room" SET "state"=jsonb_set("state",'{hostSeen}',to_jsonb(${now}::bigint)) WHERE "id"=${current.id}`;
      s.hostSeen = now;
    }
    return projectRoom(tx, current, who, s, now);
  });
}
