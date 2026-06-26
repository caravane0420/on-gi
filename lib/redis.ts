/* ================================================================
 * Upstash Redis Client (HTTP / Edge-compatible)
 *
 * Unlike ioredis which uses TCP, @upstash/redis uses HTTP (fetch),
 * making it compatible with both Serverless and Edge runtimes.
 * ================================================================ */

import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});
