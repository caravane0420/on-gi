/* ================================================================
 * Pusher Server SDK — for API Routes (Node.js runtime)
 *
 * Used to:
 * 1. Trigger events to channels (broadcast)
 * 2. Authorize presence channel subscriptions
 * ================================================================ */

import Pusher from 'pusher';

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});
