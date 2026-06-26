/* ================================================================
 * POST /api/room/kick — Kick a user from a room (Host only)
 *
 * Removes target from Redis, broadcasts kicked + user-left.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { KickUserRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: KickUserRequest = await req.json();

    if (!body.roomId || !body.userId || !body.targetUserId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify host
    const hostCheck = await roomService.isHost(body.roomId, body.userId);
    if (!hostCheck) {
      return NextResponse.json(
        { error: '방장만 강제퇴장을 할 수 있습니다.' },
        { status: 403 },
      );
    }

    if (body.userId === body.targetUserId) {
      return NextResponse.json(
        { error: '자기 자신을 퇴장시킬 수 없습니다.' },
        { status: 400 },
      );
    }

    // Remove target from Redis
    await roomService.kickUser(body.roomId, body.targetUserId);
    const room = await roomService.getRoom(body.roomId);

    const channel = `presence-room-${body.roomId}`;

    // Notify kicked user
    await pusherServer.trigger(channel, 'user-kicked', {
      targetUserId: body.targetUserId,
      message: '방장에 의해 퇴장되었습니다.',
    });

    // Notify remaining users
    await pusherServer.trigger(channel, 'user-left', {
      userId: body.targetUserId,
      users: room.users,
    });

    console.log(`[room/kick] ${body.targetUserId} kicked from room ${body.roomId}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[room/kick] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
