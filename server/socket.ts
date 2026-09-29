import 'dotenv/config';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { db } from '../src/lib/db';
import { readTicket } from '../src/lib/security';
import { roomAction, sweepRooms } from '../src/lib/rooms';

const origin = process.env.APP_URL ?? 'http://localhost:3000';
const http = createServer(async (req, res) => {
  if (req.url !== '/health') {
    res.writeHead(404);
    return res.end();
  }
  try {
    await db.$queryRaw`SELECT 1`;
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('{"ok":true}');
  } catch {
    res.writeHead(503);
    res.end('{"ok":false}');
  }
});
const io = new Server(http, {
  cors: { origin, methods: ['GET', 'POST'] },
  maxHttpBufferSize: 16000,
  allowRequest: (req, done) => done(null, req.headers.origin === origin),
});
io.use(async (socket, next) => {
  try {
    socket.data.identity = readTicket(String(socket.handshake.auth.ticket ?? ''));
    next();
  } catch {
    next(new Error('Tiket tidak valid.'));
  }
});
io.on('connection', async (socket) => {
  const identity = socket.data.identity as ReturnType<typeof readTicket>;
  const room = await db.room.findUnique({ where: { id: identity.roomId } });
  if (!room) return socket.disconnect(true);
  try {
    await roomAction(room.code, identity);
    await socket.join(room.id);
  } catch {
    return socket.disconnect(true);
  }
  // Clients refetch their own authorized projection: never broadcast answer keys or private player state.
  socket.emit('snapshot:changed');
  let last = 0;
  socket.on('heartbeat', async () => {
    if (!identity.userId || Date.now() - last < 5000) return;
    last = Date.now();
    try {
      await roomAction(room.code, identity);
    } catch {
      socket.disconnect(true);
    }
  });
});
let sweeping = false;
const timer = setInterval(async () => {
  if (sweeping) return;
  sweeping = true;
  try {
    await sweepRooms();
    for (const room of await db.room.findMany({
      where: { status: { not: 'ended' } },
      select: { id: true },
    }))
      io.to(room.id).emit('snapshot:changed');
  } catch {
    console.error('{"event":"room_sweep_failed"}');
  } finally {
    sweeping = false;
  }
}, 1000);
http.listen(Number(process.env.PORT ?? process.env.SOCKET_PORT ?? 3001), '0.0.0.0', () =>
  console.log('Socket server ready'),
);
async function stop() {
  clearInterval(timer);
  await new Promise<void>((resolve) => io.close(() => resolve()));
  await db.$disconnect();
  process.exit(0);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
