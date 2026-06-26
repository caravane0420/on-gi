/* ================================================================
 * POST /api/room/settings — Update room settings (Host only)
 *
 * Updates title, isPrivate, password in Redis,
 * broadcasts settings-changed via Pusher.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { UpdateSettingsRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: UpdateSettingsRequest = await req.json();

    if (!body.roomId || !body.userId) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const hostCheck = await roomService.isHost(body.roomId, body.userId);
    if (!hostCheck) {
      return NextResponse.json(
        { error: '방장만 설정을 변경할 수 있습니다.' },
        { status: 403 },
      );
    }

    await roomService.updateSettings(body.roomId, {
      title: body.title,
      isPrivate: body.isPrivate,
      password: body.password,
    });

    const settings = await roomService.getRoomSettings(body.roomId);

    await pusherServer.trigger(
      `presence-room-${body.roomId}`,
      'settings-changed',
      settings,
    );

    console.log(`[room/settings] Room ${body.roomId} settings updated`);
    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('[room/settings] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
