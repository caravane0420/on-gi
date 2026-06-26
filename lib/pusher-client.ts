/* ================================================================
 * Pusher Client Factory (Browser-only)
 *
 * Creates a Pusher client configured for presence channel auth.
 * Custom params (userId, nickname) are sent to /api/pusher/auth
 * alongside the standard socket_id and channel_name.
 * ================================================================ */

import PusherClient from 'pusher-js';

export function createPusherClient(
  userId: string,
  nickname: string,
): PusherClient {
  return new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    channelAuthorization: {
      endpoint: '/api/pusher/auth',
      transport: 'ajax',
      params: { userId, nickname },
    },
  });
}
