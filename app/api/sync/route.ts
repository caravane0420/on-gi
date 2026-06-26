/* ================================================================
 * POST /api/sync — Handle sync events from Host
 *
 * Types:
 *   - state-change: Play/Pause/Seek → Redis update + Pusher broadcast
 *   - video-change: New video → Redis reset + Pusher broadcast
 *
 * NOTE: Heartbeats and buffering use Pusher Client Events
 * (client-to-client, no API invocation) to minimize Vercel costs.
 * ================================================================ */

import { NextRequest, NextResponse } from 'next/server';
import * as roomService from '@/lib/room-service';
import { pusherServer } from '@/lib/pusher-server';
import type { SyncEventRequest } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const body: SyncEventRequest = await req.json();

    if (!body.roomId || !body.userId || !body.type) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify host
    const hostCheck = await roomService.isHost(body.roomId, body.userId);
    if (!hostCheck) {
      return NextResponse.json({ error: 'Host only' }, { status: 403 });
    }

    const channel = `presence-room-${body.roomId}`;

    switch (body.type) {
      case 'state-change': {
        await roomService.updateSyncState(body.roomId, {
          videoState: body.state,
          currentTime: body.currentTime,
          videoId: body.videoId,
        });

        await pusherServer.trigger(channel, 'sync-state-change', {
          state: body.state,
          currentTime: body.currentTime,
          videoId: body.videoId,
        });
        break;
      }

      case 'video-change': {
        if (!body.videoId) {
          return NextResponse.json({ error: 'videoId required' }, { status: 400 });
        }

        await roomService.updateSyncState(body.roomId, {
          videoId: body.videoId,
          currentTime: 0,
          videoState: 2,
        });

        await pusherServer.trigger(channel, 'video-changed', {
          videoId: body.videoId,
        });

        console.log(`[sync] Room ${body.roomId} → video: ${body.videoId}`);
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown sync type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[sync] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
