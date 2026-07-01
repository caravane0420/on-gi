/* ================================================================
 * Fastify Server — Entry Point
 * ================================================================ */

import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { initSocketServer } from './socket/index.js';

async function main(): Promise<void> {
  const isDev = process.env.NODE_ENV !== 'production';

  const fastify = Fastify({
    logger: isDev
      ? {
          level: 'info',
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : { level: 'info' },
  });

  // ── CORS ──────────────────────────────────────────────────────
  await fastify.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });

  // ── Health Check ──────────────────────────────────────────────
  fastify.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  // ── Socket.io (attaches to underlying HTTP server) ────────────
  await initSocketServer(fastify);

  // ── Start ─────────────────────────────────────────────────────
  try {
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`\n🚀 SyncPlay server running on http://localhost:${config.port}\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main();
