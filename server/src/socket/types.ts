/* ================================================================
 * Socket.io Event & Data Type Definitions
 * Shared contract between server and client
 *
 * v3 — Identity is now a persistent `userId` (survives refresh),
 *       not the volatile socket.id. Added:
 *         • room:rejoin            (reconnect / refresh recovery)
 *         • chat history replay    (join / rejoin payload)
 *         • sync:request-time      (server → host, late joiner)
 *         • sync:provide-time      (host → server)
 *         • sync:force             (server → late joiner)
 * ================================================================ */

// ── Data Models ──────────────────────────────────────────────────

export interface UserInfo {
  /** Persistent user id (client-generated, stored in sessionStorage) */
  id: string;
  nickname: string;
  isHost: boolean;
}

export interface RoomSettings {
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
}

export interface ChatMessageData {
  userId: string;
  nickname: string;
  message: string;
  timestamp: number;
}

export interface RoomState {
  roomId: string;
  /** userId of the current host */
  hostId: string;
  videoId: string;
  videoState: number;
  currentTime: number;
  lastSyncAt: number;
  users: UserInfo[];
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
  /** Recent chat history replayed to a joining/rejoining client */
  chatHistory: ChatMessageData[];
}

// ── Server → Client Events ──────────────────────────────────────

export interface ServerToClientEvents {
  'room:user-joined': (data: {
    userId: string;
    nickname: string;
    users: UserInfo[];
  }) => void;

  'room:user-left': (data: {
    userId: string;
    users: UserInfo[];
  }) => void;

  'room:host-changed': (data: {
    hostId: string;
    users: UserInfo[];
  }) => void;

  /** Sent to the kicked user only */
  'room:kicked': (data: { message: string }) => void;

  /** Broadcast when host updates room settings */
  'room:settings-changed': (data: RoomSettings) => void;

  'sync:state-change': (data: {
    state: number;
    currentTime: number;
    videoId: string;
  }) => void;

  'sync:heartbeat': (data: { currentTime: number }) => void;

  'sync:buffering': () => void;

  'sync:buffering-end': (data: { currentTime: number }) => void;

  /**
   * Server → host: a late joiner needs the live position.
   * Host replies with `sync:provide-time`, echoing `requesterSocketId`.
   */
  'sync:request-time': (data: { requesterSocketId: string }) => void;

  /**
   * Server → late joiner: authoritative snapshot to jump to.
   * The client should seekTo(currentTime) and play if state === PLAYING.
   */
  'sync:force': (data: {
    videoId: string;
    currentTime: number;
    state: number;
  }) => void;

  'video:changed': (data: { videoId: string }) => void;

  'chat:message': (data: ChatMessageData) => void;

  'room:error': (data: { message: string }) => void;
}

// ── Client → Server Events ──────────────────────────────────────

export interface ClientToServerEvents {
  'room:create': (
    data: {
      userId: string;
      nickname: string;
      title?: string;
      isPrivate?: boolean;
      password?: string;
    },
    callback: (response: { roomId: string; room: RoomState }) => void,
  ) => void;

  'room:join': (
    data: {
      userId: string;
      roomId: string;
      nickname: string;
      password?: string;
    },
    callback: (response: { success: boolean; room?: RoomState; error?: string }) => void,
  ) => void;

  /** Reconnect after a refresh / dropped socket, keyed by userId */
  'room:rejoin': (
    data: {
      userId: string;
      roomId: string;
      nickname: string;
    },
    callback: (response: { success: boolean; room?: RoomState; error?: string }) => void,
  ) => void;

  'room:leave': () => void;

  /** Host kicks a specific participant (by userId) */
  'room:kick': (data: { targetUserId: string }) => void;

  /** Host changes room settings */
  'room:update-settings': (data: {
    title?: string;
    isPrivate?: boolean;
    password?: string;
  }) => void;

  'sync:state-change': (data: {
    state: number;
    currentTime: number;
    videoId: string;
  }) => void;

  'sync:heartbeat': (data: { currentTime: number }) => void;

  /** Host's reply to `sync:request-time` — relayed to the requester */
  'sync:provide-time': (data: {
    requesterSocketId: string;
    videoId: string;
    currentTime: number;
    state: number;
  }) => void;

  'chat:message': (data: { message: string }) => void;

  'video:change': (data: { videoId: string }) => void;
}

// ── Internal Server Types ────────────────────────────────────────

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  /** Persistent identity carried across reconnects */
  userId: string;
  nickname: string;
  roomId: string | null;
}
