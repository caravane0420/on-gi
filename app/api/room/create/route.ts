/* ================================================================
 * POST /api/room/create — Create a new room
 *
 * Generates roomId + userId, initializes Redis state,
 * returns room data for the client to navigate to.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import * as roomService from '@/lib/room-service';
import type { CreateRoomRequest, CreateRoomResponse } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: CreateRoomRequest = await req.json();

    if (!body.nickname?.trim()) {
      return NextResponse.json(
        { error: '닉네임을 입력해주세요.' },
        { status: 400 },
      );
    }

    const roomId = nanoid(8);
    const userId = nanoid(12);

    const room = await roomService.createRoom(
      roomId,
      userId,
      body.nickname.trim(),
      {
        title: body.title,
        isPrivate: body.isPrivate,
        password: body.password,
      },
    );

    const response: CreateRoomResponse = { roomId, userId, room };
    return NextResponse.json(response);
  } catch (error) {
    console.error('[room/create] Error:', error);
    return NextResponse.json(
      { error: '방 생성에 실패했습니다.' },
      { status: 500 },
    );
  }
}
