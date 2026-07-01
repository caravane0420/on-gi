/* ================================================================
 * Socket.io Server Initialization + Redis Adapter
 * ================================================================ */

import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { nanoid } from 'nanoid';
import type { FastifyInstance } from 'fastify';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { registerHandlers, cancelGraceTimer } from './handlers.js';
import { RoomService } from '../services/roomService.js';
import { config } from '../config.js';

export async function initSocketServer(fastify: FastifyInstance): Promise<void> {
  // ── Redis clients (main + pub/sub duplicates for the adapter) ──
  const redisClient = new Redis(config.redisUrl, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis] Reconnecting in ${delay}ms… (attempt ${times})`);
      return delay;
    },
  });

  redisClient.on('connect', () => console.log('[Redis] Connected'));
  redisClient.on('error', (err) => console.error('[Redis] Error:', err.message));

  const pubClient = redisClient;
  const subClient = pubClient.duplicate();

  const roomService = new RoomService(redisClient);

  // ── Socket.io server ──────────────────────────────────────────
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    InterServerEvents,
    SocketData
  >(fastify.server, {
    cors: {
      origin: config.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10_000,
    pingTimeout: 5_000,
    transports: ['websocket', 'polling'],
    adapter: createAdapter(pubClient, subClient),
  });

  // ── Handshake: pin a persistent userId to every socket ────────
  io.use((socket, next) => {
    const authUserId = socket.handshake.auth?.userId;
    socket.data.userId =
      typeof authUserId === 'string' && authUserId.length > 0
        ? authUserId
        : `anon_${nanoid(10)}`;
    socket.data.roomId = null;
    socket.data.nickname = '';
    next();
  });

  // ── Connection handler ────────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId } = socket.data;
    console.log(`[Socket] Connected: ${socket.id} (userId=${userId})`);

    // A socket carrying a userId that is mid-grace-period is a refresh
    // coming back — cancel its pending removal immediately so the client
    // has time to emit room:rejoin without being delegated away.
    cancelGraceTimer(userId);

    registerHandlers(io, socket, roomService);
  });

  console.log('[Socket.io] Server initialized with Redis adapter');
}
