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

/** An entry in the shared playlist (queue) */
export interface PlaylistItem {
  id: string;
  videoId: string;
  title: string;
  addedById: string;
  addedByName: string;
}

/** A viewer's pending request to add a video (host approves/rejects) */
export interface VideoRequest {
  id: string;
  videoId: string;
  title: string;
  byId: string;
  byName: string;
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
  /** Shared playlist + which item is playing + pending requests */
  playlist: PlaylistItem[];
  currentItemId: string | null;
  requests: VideoRequest[];
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

  'sync:heartbeat': (data: {
    currentTime: number;
    state?: number;
    volume?: number;
    muted?: boolean;
  }) => void;

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

  'video:changed': (data: { videoId: string; autoplay?: boolean }) => void;

  'chat:message': (data: ChatMessageData) => void;

  /** Full playlist state (list + which item is current) */
  'playlist:updated': (data: {
    playlist: PlaylistItem[];
    currentItemId: string | null;
  }) => void;

  /** Pending requests list (host sees approve/reject) */
  'requests:updated': (data: { requests: VideoRequest[] }) => void;

  /** A viewer's request outcome, sent to that requester */
  'request:result': (data: { approved: boolean; title: string }) => void;

  /** A floating reaction to render over the video for everyone */
  'reaction:broadcast': (data: { emoji: string; nickname: string; id: string }) => void;

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

  'sync:heartbeat': (data: {
    currentTime: number;
    state?: number;
    volume?: number;
    muted?: boolean;
  }) => void;

  /** Host's reply to `sync:request-time` — relayed to the requester */
  'sync:provide-time': (data: {
    requesterSocketId: string;
    videoId: string;
    currentTime: number;
    state: number;
  }) => void;

  'chat:message': (data: { message: string }) => void;

  'video:change': (data: { videoId: string }) => void;

  // ── Playlist ──
  /** Host adds a video straight to the playlist */
  'playlist:add': (data: { videoId: string }) => void;
  /** Viewer requests a video (host must approve) */
  'playlist:request': (data: { videoId: string }) => void;
  /** Host approves / rejects a pending request */
  'playlist:approve': (data: { requestId: string }) => void;
  'playlist:reject': (data: { requestId: string }) => void;
  /** Host removes a playlist item */
  'playlist:remove': (data: { itemId: string }) => void;
  /** Host jumps to a specific item */
  'playlist:play': (data: { itemId: string }) => void;
  /** Host skips to the next item */
  'playlist:next': () => void;

  // ── Reactions ──
  'reaction:send': (data: { emoji: string }) => void;
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
