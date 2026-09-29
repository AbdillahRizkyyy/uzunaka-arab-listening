import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, json, atomic } from '@/lib/db';
import { currentUser, requireUser, requireAdmin } from '@/lib/auth';
import { body, failure } from '@/lib/http';
import { assert, canPublish } from '@/lib/domain';
import { questionSchema, CONFIG_VERSION, levels } from '@/lib/contracts';
import { attemptAction, eligible, startAttempt } from '@/lib/attempts';
import {
  createRoom,
  joinRoom,
  roomAction,
  roomIdentity,
  roomAnswer,
  roomSnapshot,
  sweepRooms,
} from '@/lib/rooms';
import { issueTicket, limit } from '@/lib/security';
import { adminRead, adminWrite, saveRevision, settings } from '@/lib/admin-controls';
export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params;
    if (path[0] === 'site-settings') return NextResponse.json(await settings());
    if (path[0] === 'health') {
      await db.$queryRaw`SELECT 1`;
      return NextResponse.json({ ok: true });
    }
    if (path[0] === 'catalog') {
      const user = await currentUser();
      const units = await db.unit.findMany({
        where: {
          archived: false,
          ...(process.env.NODE_ENV === 'production' ? { developmentOnly: false } : {}),
        },
        include: {
          _count: { select: { questions: { where: { pool: 'practice', status: 'published' } } } },
        },
        orderBy: [{ level: 'asc' }, { id: 'asc' }],
      });
      const points = user
        ? await db.pointEntry.aggregate({ where: { userId: user.id }, _sum: { amount: true } })
        : null;
      const progress = user ? await atomic((tx) => eligible(tx, user.id, user.level)) : null;
      const activeRoom = user
        ? await db.room.findFirst({
            where: { hostId: user.id, status: { not: 'ended' } },
            select: { code: true },
          })
        : null;
      const attempts = user
        ? await db.attempt.findMany({
            where: { userId: user.id },
            select: { id: true, kind: true, unitId: true, completedAt: true },
            orderBy: { createdAt: 'desc' },
            take: 100,
          })
        : [];
      return NextResponse.json({
        settings: await settings(),
        levels,
        units: units.map((u) => ({ ...u, count: u._count.questions })),
        user: user
          ? {
              name: user.name,
              email: user.email,
              level: user.level,
              onboarding: user.onboarding,
              role: user.role,
              points: points?._sum.amount ?? 0,
            }
          : null,
        progress,
        activeRoom,
        attempts,
      });
    }
    if (path[0] === 'attempts') {
      const user = await requireUser();
      return NextResponse.json(await attemptAction(user.id, path[1]));
    }
    if (path[0] === 'rooms') {
      const user = await currentUser(),
        identity = {
          userId: user?.id,
          participantToken: request.headers.get('x-participant-token') ?? undefined,
        };
      return NextResponse.json(await roomSnapshot(path[1], identity));
    }
    if (path[0] === 'admin') {
      const admin = await requireAdmin();
      if (path[1]) {
        const result = await adminRead(path[1], request.nextUrl.searchParams);
        if (result !== undefined) return NextResponse.json(result);
      }
      const [questions, reports, review, units, users, rooms, userRows] = await Promise.all([
        db.question.findMany({ orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
        db.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
        db.reviewConfig.findUnique({ where: { id: CONFIG_VERSION } }),
        db.unit.findMany({
          include: { _count: { select: { questions: true } } },
          orderBy: [{ level: 'asc' }, { id: 'asc' }],
        }),
        db.user.count(),
        db.room.findMany({
          where: { status: { not: 'ended' } },
          select: {
            id: true,
            code: true,
            status: true,
            createdAt: true,
            host: { select: { name: true, email: true } },
            _count: { select: { participants: true } },
          },
          orderBy: { updatedAt: 'desc' },
        }),
        db.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            verifiedAt: true,
            level: true,
            onboarding: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      ]);
      return NextResponse.json({
        questions,
        reports,
        review,
        units,
        rooms,
        users: userRows,
        settings: await settings(),
        currentUserId: admin.id,
        stats: {
          users,
          questions: questions.length,
          published: questions.filter((q) => q.status === 'published').length,
          draft: questions.filter((q) => q.status !== 'published').length,
          activeRooms: rooms.length,
        },
      });
    }
    return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const { path } = await context.params,
      data = await body(request);
    if (path[0] === 'attempts') {
      const user = await requireUser();
      await limit('attempt:' + user.id, 120);
      if (path[1]) return NextResponse.json(await attemptAction(user.id, path[1], data));
      const input = z
        .object({
          kind: z.enum(['practice', 'onboarding', 'level_up']),
          unitId: z.string().optional(),
        })
        .parse(data);
      return NextResponse.json({ id: await startAttempt(user.id, input.kind, input.unitId) });
    }
    if (path[0] === 'rooms') {
      const user = await currentUser(),
        oldToken = request.headers.get('x-participant-token') ?? undefined;
      if (path[1] === 'join') {
        const input = z
          .object({
            code: z.string().regex(/^[A-Z2-9]{6}$/),
            name: z.string().trim().min(2).max(40),
          })
          .parse(data);
        await limit('join:' + input.code, 100);
        return NextResponse.json(await joinRoom(input.code, input.name, user?.id, oldToken));
      }
      if (!path[1]) {
        assert(user, 'Silakan masuk untuk menjadi host.', 401);
        await limit('host:' + user.id, 5, 3600);
        return NextResponse.json(
          await createRoom(user.id, z.object({ unitId: z.string() }).parse(data).unitId),
        );
      }
      const identity = { userId: user?.id, participantToken: oldToken };
      if (path[2] === 'ticket')
        return NextResponse.json({ ticket: issueTicket(await roomIdentity(path[1], identity)) });
      await limit('room:' + path[1] + ':' + (user?.id ?? oldToken ?? 'unknown'), 120);
      return NextResponse.json(
        data.action === 'answer'
          ? await roomAnswer(path[1], identity, data.value)
          : await roomAction(path[1], identity, data),
      );
    }
    if (path[0] === 'reports') {
      const user = await requireUser();
      await limit('report:' + user.id, 5, 3600);
      const input = z
        .object({ questionId: z.string().max(100), message: z.string().trim().min(10).max(2000) })
        .parse(data);
      assert(
        await db.question.findUnique({ where: { id: input.questionId } }),
        'Soal tidak ditemukan.',
        404,
      );
      await db.report.create({ data: input });
      return NextResponse.json({ message: 'Laporan diterima. Terima kasih.' });
    }
    if (path[0] === 'admin') {
      const admin = await requireAdmin();
      if (await adminWrite(path[1], data, admin.id)) return NextResponse.json({ ok: true });
      if (path[1] === 'review') {
        const input = z
          .object({ reviewer: z.string().trim().min(3), approved: z.boolean() })
          .parse(data);
        await db.reviewConfig.upsert({
          where: { id: CONFIG_VERSION },
          create: { id: CONFIG_VERSION, ...input, reviewedAt: new Date() },
          update: { ...input, reviewedAt: new Date() },
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'publish') {
        const input = z.object({ id: z.string(), publish: z.boolean() }).parse(data);
        await atomic(async (tx) => {
          const q = await tx.question.findUnique({ where: { id: input.id } });
          assert(q, 'Soal tidak ditemukan.', 404);
          const unit = await tx.unit.findUniqueOrThrow({ where: { id: q.unitId } });
          if (input.publish && !(unit.developmentOnly && process.env.NODE_ENV !== 'production'))
            assert(
              canPublish(questionSchema.parse(q.data)),
              'Audio native, tinjauan pengajar, dan izin penggunaan wajib sebelum publikasi.',
            );
          await tx.question.update({
            where: { id: q.id },
            data: { status: input.publish ? 'published' : 'draft' },
          });
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'question') {
        const q = questionSchema.parse(data);
        await atomic(async (tx) => {
          const unit = await tx.unit.findUnique({ where: { id: q.unitId } });
          assert(
            unit && unit.level === q.level,
            'Paket dan level soal tidak sesuai. Pilih paket kembali.',
          );
          const old = await tx.question.findUnique({ where: { id: q.id } });
          assert(
            !old || old.version === q.version,
            'Soal sudah diubah di tempat lain. Muat ulang halaman sebelum mengedit.',
            409,
          );
          if (old) await saveRevision(tx, old, admin.id);
          q.version = (old?.version ?? 0) + 1;
          const saved = await tx.question.upsert({
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
          await saveRevision(tx, saved, admin.id);
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'unit') {
        const input = z
          .object({
            id: z
              .string()
              .trim()
              .min(3)
              .max(100)
              .regex(/^[a-z0-9-]+$/),
            level: z.number().int().min(1).max(5),
            title: z.string().trim().min(2).max(120),
            theme: z.string().trim().min(2).max(120),
            description: z.string().trim().min(2).max(500),
          })
          .parse(data);
        await atomic(async (tx) => {
          const old = await tx.unit.findUnique({ where: { id: input.id } });
          const count = await tx.question.count({ where: { unitId: input.id } });
          assert(
            !old || !count || old.level === input.level,
            'Level paket yang sudah berisi soal tidak dapat diubah.',
          );
          await tx.unit.upsert({ where: { id: input.id }, create: input, update: input });
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'user-role') {
        const input = z
          .object({ userId: z.string().min(1), role: z.enum(['admin', 'student']) })
          .parse(data);
        assert(input.userId !== admin.id, 'Anda tidak dapat mengubah akses akun sendiri.');
        await db.user.update({
          where: { id: input.userId },
          data: { role: input.role, authVersion: { increment: 1 } },
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'delete-question') {
        const input = z.object({ id: z.string().min(1) }).parse(data);
        await atomic(async (tx) => {
          const question = await tx.question.findUnique({ where: { id: input.id } });
          assert(question?.status === 'draft', 'Hanya soal draft yang dapat dihapus.');
          await tx.question.delete({ where: { id: input.id } });
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'delete-unit') {
        const input = z.object({ id: z.string().min(1) }).parse(data);
        await atomic(async (tx) => {
          assert(
            (await tx.question.count({ where: { unitId: input.id } })) === 0,
            'Pindahkan atau hapus soal sebelum menghapus paket.',
          );
          await tx.unit.delete({ where: { id: input.id } });
        });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'resolve-report') {
        const input = z.object({ id: z.string().min(1) }).parse(data);
        await db.report.deleteMany({ where: { id: input.id } });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'end-room') {
        const input = z.object({ code: z.string() }).parse(data);
        const room = await db.room.findUnique({ where: { code: input.code } });
        assert(room, 'Ruang tidak ditemukan.', 404);
        await roomAction(room.code, { userId: room.hostId }, { action: 'end' });
        return NextResponse.json({ ok: true });
      }
      if (path[1] === 'refresh') {
        await sweepRooms();
        return NextResponse.json({ ok: true });
      }
    }
    return NextResponse.json({ error: 'Tidak ditemukan.' }, { status: 404 });
  } catch (e) {
    return failure(e);
  }
}
