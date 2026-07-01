/* ================================================================
 * Shared Client Types (mirrors server/src/socket/types.ts)
 * v3 — Identity via persistent userId; RoomState carries chatHistory
 * ================================================================ */

export interface UserInfo {
  /** Persistent user id (from sessionStorage) */
  id: string;
  nickname: string;
  isHost: boolean;
}

export interface RoomSettings {
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
  /** Recent chat history replayed on join / rejoin */
  chatHistory: ChatMessage[];
}

/** YouTube Player State constants (same values as YT.PlayerState) */
export const PlayerState = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const;

/** Extract a YouTube video ID from various URL formats or a bare ID */
export function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    if (url.hostname.includes('youtube.com')) {
      const vParam = url.searchParams.get('v');
      if (vParam) return vParam;
      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.split('/embed/')[1]?.split('?')[0] || null;
      }
      if (url.pathname.startsWith('/shorts/')) {
        return url.pathname.split('/shorts/')[1]?.split('?')[0] || null;
      }
    }

    if (url.hostname === 'youtu.be') {
      return url.pathname.slice(1).split('?')[0] || null;
    }
  } catch {
    // Not a valid URL
  }

  return null;
}
