/* ================================================================
 * POST /api/room/join — Join an existing room
 *
 * Validates room existence + password, adds user to Redis,
 * broadcasts user-joined via Pusher.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { JoinRoomRequest, JoinRoomResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: JoinRoomRequest = await req.json();

    if (!body.roomId?.trim() || !body.nickname?.trim()) {
      return NextResponse.json(
        { success: false, error: '방 코드와 닉네임을 입력해주세요.' },
        { status: 400 },
      );
    }

    const exists = await roomService.roomExists(body.roomId);
    if (!exists) {
      const res: JoinRoomResponse = { success: false, error: '방을 찾을 수 없습니다.' };
      return NextResponse.json(res);
    }

    // Password gate
    const needsPassword = await roomService.hasPassword(body.roomId);
    if (needsPassword) {
      if (!body.password) {
        const res: JoinRoomResponse = { success: false, error: 'password_required' };
        return NextResponse.json(res);
      }
      const valid = await roomService.verifyPassword(body.roomId, body.password);
      if (!valid) {
        const res: JoinRoomResponse = { success: false, error: '비밀번호가 틀렸습니다.' };
        return NextResponse.json(res);
      }
    }

    const userId = nanoid(12);
    const room = await roomService.joinRoom(body.roomId, userId, body.nickname.trim());

    if (!room) {
      const res: JoinRoomResponse = { success: false, error: '방에 입장할 수 없습니다.' };
      return NextResponse.json(res);
    }

    // Broadcast to room via Pusher
    await pusherServer.trigger(`presence-room-${body.roomId}`, 'user-joined', {
      userId,
      nickname: body.nickname.trim(),
      users: room.users,
    });

    const res: JoinRoomResponse = { success: true, userId, room };
    return NextResponse.json(res);
  } catch (error) {
    console.error('[room/join] Error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
