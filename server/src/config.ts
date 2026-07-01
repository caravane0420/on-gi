/* ================================================================
 * Server Configuration
 * ================================================================ */

export const config = {
  /** Server port */
  port: parseInt(process.env.PORT || '3001', 10),

  /** Redis connection URL */
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  /**
   * Allowed CORS origin(s) — comma separated for multiple.
   * e.g. "https://on-gi.com,https://www.on-gi.com"
   */
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  /**
   * Grace period (ms) before a disconnected user is actually removed.
   * A browser refresh drops the socket for ~1s; giving 5s lets the same
   * userId reconnect and reclaim its seat (fixes the "clone / 분신술" bug).
   */
  gracePeriodMs: 5_000,

  /** Host heartbeat interval — client sends currentTime every N ms */
  heartbeatIntervalMs: 3_000,

  /** Max acceptable drift (seconds) before forcing seekTo on a viewer */
  syncThresholdSec: 0.5,

  /** How many recent chat messages to persist / replay per room */
  chatHistoryLimit: 50,

  /** TTL (seconds) applied to room keys so abandoned rooms self-expire */
  roomTtlSec: 60 * 60 * 12, // 12 hours
} as const;
