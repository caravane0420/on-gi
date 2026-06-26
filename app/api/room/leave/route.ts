/* ================================================================
 * POST /api/room/leave — Leave a room
 *
 * Removes user from Redis, delegates host if needed,
 * broadcasts user-left (and host-changed) via Pusher.
 * Also used by navigator.sendBeacon on tab close.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { LeaveRoomRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: LeaveRoomRequest = await req.json();

    if (!body.roomId || !body.userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const { room, hostChanged, isEmpty } = await roomService.leaveRoom(
      body.roomId,
      body.userId,
    );

    if (isEmpty || !room) {
      console.log(`[room/leave] Room ${body.roomId} is now empty — deleted.`);
      return NextResponse.json({ success: true });
    }

    // Broadcast user-left
    await pusherServer.trigger(`presence-room-${body.roomId}`, 'user-left', {
      userId: body.userId,
      users: room.users,
    });

    // Broadcast host-changed if applicable
    if (hostChanged) {
      await pusherServer.trigger(
        `presence-room-${body.roomId}`,
        'host-changed',
        { hostId: room.hostId, users: room.users },
      );
      console.log(`[room/leave] Host delegated to ${room.hostId} in room ${body.roomId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[room/leave] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
