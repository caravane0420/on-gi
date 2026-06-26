/* ================================================================
 * POST /api/room/delegate — Delegate host after disconnect
 *
 * Called by remaining clients when Pusher's presence channel
 * fires `member_removed` for the current host (after grace period).
 * Idempotent: multiple clients calling this produce the same result.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { DelegateHostRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: DelegateHostRequest = await req.json();

    if (!body.roomId || !body.disconnectedUserId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Remove the disconnected user from Redis
    await roomService.kickUser(body.roomId, body.disconnectedUserId);

    const room = await roomService.getRoom(body.roomId);

    // If room is empty, it should have been deleted by kickUser flow
    if (!room || room.users.length === 0) {
      return NextResponse.json({ success: true, empty: true });
    }

    // Delegate host to users[0] (FIFO)
    const delegated = await roomService.delegateHost(body.roomId);
    const updatedRoom = await roomService.getRoom(body.roomId);

    const channel = `presence-room-${body.roomId}`;

    // Broadcast user-left
    await pusherServer.trigger(channel, 'user-left', {
      userId: body.disconnectedUserId,
      users: updatedRoom.users,
    });

    // Broadcast host-changed if delegated
    if (delegated) {
      await pusherServer.trigger(channel, 'host-changed', {
        hostId: updatedRoom.hostId,
        users: updatedRoom.users,
      });
      console.log(`[room/delegate] Host delegated to ${updatedRoom.hostId} in room ${body.roomId}`);
    }

    return NextResponse.json({ success: true, newHostId: updatedRoom.hostId });
  } catch (error) {
    console.error('[room/delegate] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
