/* ================================================================
 * SyncPlay — Shared Type Definitions
 *
 * Used by both API Routes (server) and React components (client).
 * ================================================================ */

// ── Data Models ──────────────────────────────────────────────────

export interface UserInfo {
  id: string;
  nickname: string;
  isHost: boolean;
}

export interface RoomSettings {
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
}

export interface RoomState {
  roomId: string;
  hostId: string;
  videoId: string;
  videoState: number;
  currentTime: number;
  lastSyncAt: number;
  users: UserInfo[];
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
}

export interface ChatMessage {
  userId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

// ── API Request/Response Types ───────────────────────────────────

export interface CreateRoomRequest {
  nickname: string;
  title?: string;
  isPrivate?: boolean;
  password?: string;
}

export interface CreateRoomResponse {
  roomId: string;
  userId: string;
  room: RoomState;
}

export interface JoinRoomRequest {
  roomId: string;
  nickname: string;
  password?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  userId?: string;
  room?: RoomState;
  error?: string;
}

export interface SyncEventRequest {
  roomId: string;
  userId: string;
  type: 'state-change' | 'video-change';
  state?: number;
  currentTime?: number;
  videoId?: string;
}

export interface LeaveRoomRequest {
  roomId: string;
  userId: string;
}

export interface KickUserRequest {
  roomId: string;
  userId: string;
  targetUserId: string;
}

export interface UpdateSettingsRequest {
  roomId: string;
  userId: string;
  title?: string;
  isPrivate?: boolean;
  password?: string;
}

export interface DelegateHostRequest {
  roomId: string;
  disconnectedUserId: string;
}

export interface ChatRequest {
  roomId: string;
  userId: string;
  message: string;
}

// ── Pusher Event Payloads ────────────────────────────────────────

export interface PusherUserJoinedPayload {
  userId: string;
  nickname: string;
  users: UserInfo[];
}

export interface PusherUserLeftPayload {
  userId: string;
  users: UserInfo[];
}

export interface PusherHostChangedPayload {
  hostId: string;
  users: UserInfo[];
}

export interface PusherKickedPayload {
  targetUserId: string;
  message: string;
}

export interface PusherSyncPayload {
  state: number;
  currentTime: number;
  videoId: string;
}

export interface PusherVideoChangedPayload {
  videoId: string;
}

// ── Client Event Payloads (Pusher client→client, no API) ─────────

export interface ClientHeartbeatPayload {
  currentTime: number;
}

export interface ClientChatPayload {
  userId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export interface ClientBufferingEndPayload {
  currentTime: number;
}

// ── YouTube ──────────────────────────────────────────────────────

export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** Extract a YouTube video ID from various URL formats or bare ID */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return v;
      if (url.pathname.startsWith('/embed/'))
        return url.pathname.split('/embed/')[1]?.split('?')[0] || null;
    }
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
  } catch {
    /* not a URL */
  }

  return null;
}
