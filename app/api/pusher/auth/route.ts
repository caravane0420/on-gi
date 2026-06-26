/* ================================================================
 * POST /api/pusher/auth — Presence Channel Authorization
 *
 * Called automatically by pusher-js when subscribing to
 * `presence-room-{roomId}`. Returns signed auth + presence data.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import { pusherServer } from '@/lib/pusher-server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);

    const socketId = params.get('socket_id');
    const channelName = params.get('channel_name');
    const userId = params.get('userId');
    const nickname = params.get('nickname');

    if (!socketId || !channelName || !userId || !nickname) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 },
      );
    }

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, {
      user_id: userId,
      user_info: { nickname },
    });

    return NextResponse.json(authResponse);
  } catch (error) {
    console.error('[pusher/auth] Error:', error);
    return NextResponse.json(
      { error: 'Authorization failed' },
      { status: 500 },
    );
  }
}
