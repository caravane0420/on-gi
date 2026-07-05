/* ================================================================
 * Room State Store (Zustand)  —  v3
 *
 * Identity is the persistent `userId` (sessionStorage), NOT socket.id.
 * Adds: reconnection (rejoin), chat-history replay, session breadcrumbs.
 *
 * Player-specific socket events (sync:force, sync:request-time) are
 * handled inside useYouTubePlayer where the YT.Player instance lives.
 * ================================================================ */

import { create } from 'zustand';
import { socket } from '../lib/socket';
import {
  getUserId,
  saveSession,
  clearSession,
} from '../lib/session';
import type {
  UserInfo,
  RoomState,
  ChatMessage,
  RoomSettings,
  PlaylistItem,
  VideoRequest,
  Reaction,
} from '../types';

interface RoomStoreState {
  /* ── State ──────────────────────────────────────────────────── */
  roomId: string | null;
  users: UserInfo[];
  hostId: string | null;
  videoId: string;
  videoState: number;
  currentTime: number;
  chatMessages: ChatMessage[];
  nickname: string;
  title: string;
  isPrivate: boolean;
  hasPassword: boolean;
  /** Non-empty when the user was kicked — shown as alert on the lobby */
  kickedMessage: string;
  /** True while an automatic rejoin is being attempted after a refresh */
  reconnecting: boolean;

  /* ── Playlist / requests / reactions ────────────────────────── */
  playlist: PlaylistItem[];
  currentItemId: string | null;
  requests: VideoRequest[];
  /** Floating reactions currently animating over the video */
  reactions: Reaction[];
  /** Transient toast (e.g. request approved/rejected) */
  notice: string;

  /* ── Getters ────────────────────────────────────────────────── */
  isHost: () => boolean;
  myId: () => string;

  /* ── Actions ────────────────────────────────────────────────── */
  createRoom: (nickname: string) => Promise<void>;
  joinRoom: (
    roomId: string,
    nickname: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  rejoin: (
    roomId: string,
    nickname: string,
  ) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  sendChatMessage: (message: string) => void;
  changeVideo: (videoId: string) => void;
  /* Playlist actions */
  addToPlaylist: (videoId: string) => void;
  requestVideo: (videoId: string) => void;
  approveRequest: (requestId: string) => void;
  rejectRequest: (requestId: string) => void;
  removeFromPlaylist: (itemId: string) => void;
  playItem: (itemId: string) => void;
  nextVideo: () => void;
  /* Reactions */
  sendReaction: (emoji: string) => void;
  removeReaction: (id: string) => void;
  clearNotice: () => void;
  kickUser: (targetUserId: string) => void;
  updateSettings: (settings: { title?: string; isPrivate?: boolean; password?: string }) => void;
  clearKickedMessage: () => void;
  reset: () => void;

  /* ── Socket wiring ──────────────────────────────────────────── */
  bindSocketEvents: () => void;
  unbindSocketEvents: () => void;
}

const initialState = {
  roomId: null as string | null,
  users: [] as UserInfo[],
  hostId: null as string | null,
  videoId: '',
  videoState: 2,
  currentTime: 0,
  chatMessages: [] as ChatMessage[],
  nickname: '',
  title: '',
  isPrivate: false,
  hasPassword: false,
  kickedMessage: '',
  reconnecting: false,
  playlist: [] as PlaylistItem[],
  currentItemId: null as string | null,
  requests: [] as VideoRequest[],
  reactions: [] as Reaction[],
  notice: '',
};

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  ...initialState,

  /* ── Getters ────────────────────────────────────────────────── */

  isHost: () => {
    const { hostId } = get();
    return hostId != null && hostId === getUserId();
  },

  myId: () => getUserId(),

  /* ── Actions ────────────────────────────────────────────────── */

  createRoom: async (nickname) => {
    return new Promise<void>((resolve, reject) => {
      socket.emit(
        'room:create',
        { userId: getUserId(), nickname },
        (res: { roomId: string; room: RoomState }) => {
          try {
            applyRoomState(set, res.room, nickname);
            saveSession(res.room.roomId, nickname);
            resolve();
          } catch (err) {
            reject(err);
          }
        },
      );
    });
  },

  joinRoom: async (roomId, nickname, password) => {
    return new Promise((resolve) => {
      socket.emit(
        'room:join',
        { userId: getUserId(), roomId, nickname, password },
        (res: { success: boolean; room?: RoomState; error?: string }) => {
          if (res.success && res.room) {
            applyRoomState(set, res.room, nickname);
            saveSession(res.room.roomId, nickname);
            resolve({ success: true });
          } else {
            resolve({ success: false, error: res.error });
          }
        },
      );
    });
  },

  rejoin: async (roomId, nickname) => {
    set({ reconnecting: true });
    return new Promise((resolve) => {
      socket.emit(
        'room:rejoin',
        { userId: getUserId(), roomId, nickname },
        (res: { success: boolean; room?: RoomState; error?: string }) => {
          if (res.success && res.room) {
            applyRoomState(set, res.room, nickname);
            saveSession(res.room.roomId, nickname);
            get().bindSocketEvents();
            set({ reconnecting: false });
            resolve({ success: true });
          } else {
            // Room is gone / expired → drop breadcrumbs, back to lobby
            clearSession();
            set({ reconnecting: false });
            resolve({ success: false, error: res.error });
          }
        },
      );
    });
  },

  leaveRoom: () => {
    socket.emit('room:leave');
    get().unbindSocketEvents();
    clearSession();
    set({ ...initialState });
  },

  sendChatMessage: (message) => {
    if (!message.trim()) return;
    socket.emit('chat:message', { message: message.trim() });
  },

  changeVideo: (videoId) => {
    socket.emit('video:change', { videoId });
    set({ videoId, currentTime: 0, videoState: 2 });
  },

  /* ── Playlist ──────────────────────────────────────────────── */
  addToPlaylist: (videoId) => socket.emit('playlist:add', { videoId }),
  requestVideo: (videoId) => socket.emit('playlist:request', { videoId }),
  approveRequest: (requestId) => socket.emit('playlist:approve', { requestId }),
  rejectRequest: (requestId) => socket.emit('playlist:reject', { requestId }),
  removeFromPlaylist: (itemId) => socket.emit('playlist:remove', { itemId }),
  playItem: (itemId) => socket.emit('playlist:play', { itemId }),
  nextVideo: () => socket.emit('playlist:next'),

  /* ── Reactions ─────────────────────────────────────────────── */
  sendReaction: (emoji) => socket.emit('reaction:send', { emoji }),
  removeReaction: (id) =>
    set((s) => ({ reactions: s.reactions.filter((r) => r.id !== id) })),
  clearNotice: () => set({ notice: '' }),

  kickUser: (targetUserId) => {
    socket.emit('room:kick', { targetUserId });
  },

  updateSettings: (settings) => {
    socket.emit('room:update-settings', settings);
  },

  clearKickedMessage: () => set({ kickedMessage: '' }),

  reset: () => {
    get().unbindSocketEvents();
    clearSession();
    set({ ...initialState });
  },

  /* ── Socket Event Wiring ────────────────────────────────────── */

  bindSocketEvents: () => {
    // Guard against double-binding on reconnect
    get().unbindSocketEvents();

    socket.on('room:user-joined', ({ users }) => set({ users }));
    socket.on('room:user-left', ({ users }) => set({ users }));

    socket.on('room:host-changed', ({ hostId, users }) => set({ hostId, users }));

    socket.on('room:kicked', ({ message }) => {
      get().unbindSocketEvents();
      clearSession();
      set({ ...initialState, kickedMessage: message });
    });

    socket.on('room:settings-changed', (settings: RoomSettings) => {
      set({
        title: settings.title,
        isPrivate: settings.isPrivate,
        hasPassword: settings.hasPassword,
      });
    });

    socket.on('sync:state-change', ({ state, currentTime, videoId }) => {
      set({ videoState: state, currentTime, videoId });
    });

    socket.on(
      'sync:heartbeat',
      ({ currentTime, state }: { currentTime: number; state?: number }) => {
        set((s) => ({
          currentTime,
          // Only PLAYING(1)/PAUSED(2) drive the viewer; ignore transient states
          videoState: state === 1 || state === 2 ? state : s.videoState,
        }));
      },
    );

    socket.on('sync:buffering', () => set({ videoState: 2 }));

    socket.on('sync:buffering-end', ({ currentTime }) => {
      set({ videoState: 1, currentTime });
    });

    socket.on('video:changed', ({ videoId, autoplay }: { videoId: string; autoplay?: boolean }) => {
      // autoplay → mark PLAYING so host & viewers auto-start the new item
      set({ videoId, currentTime: 0, videoState: autoplay ? 1 : 2 });
    });

    socket.on('chat:message', (msg: ChatMessage) => {
      set((s) => ({ chatMessages: [...s.chatMessages, msg] }));
    });

    socket.on(
      'playlist:updated',
      ({ playlist, currentItemId }: { playlist: PlaylistItem[]; currentItemId: string | null }) => {
        set({ playlist, currentItemId });
      },
    );

    socket.on('requests:updated', ({ requests }: { requests: VideoRequest[] }) => {
      set({ requests });
    });

    socket.on('request:result', ({ approved, title }: { approved: boolean; title: string }) => {
      set({
        notice: approved
          ? `신청한 영상이 추가되었어요: ${title}`
          : `신청이 거절되었어요: ${title}`,
      });
    });

    socket.on(
      'reaction:broadcast',
      ({ emoji, nickname, id }: { emoji: string; nickname: string; id: string }) => {
        // Random horizontal lane (10–85%) so reactions don't stack
        const left = 10 + Math.floor(Math.random() * 75);
        set((s) => ({ reactions: [...s.reactions, { id, emoji, nickname, left }] }));
      },
    );

    socket.on('room:error', ({ message }) => {
      console.error('[Room Error]', message);
    });
  },

  unbindSocketEvents: () => {
    socket.off('room:user-joined');
    socket.off('room:user-left');
    socket.off('room:host-changed');
    socket.off('room:kicked');
    socket.off('room:settings-changed');
    socket.off('sync:state-change');
    socket.off('sync:heartbeat');
    socket.off('sync:buffering');
    socket.off('sync:buffering-end');
    socket.off('video:changed');
    socket.off('chat:message');
    socket.off('playlist:updated');
    socket.off('requests:updated');
    socket.off('request:result');
    socket.off('reaction:broadcast');
    socket.off('room:error');
  },
}));

/* ── Helper ──────────────────────────────────────────────────── */

function applyRoomState(
  set: (partial: Partial<RoomStoreState>) => void,
  room: RoomState,
  nickname: string,
) {
  set({
    roomId: room.roomId,
    users: room.users,
    hostId: room.hostId,
    videoId: room.videoId,
    videoState: room.videoState,
    currentTime: room.currentTime,
    nickname,
    // Replay persisted chat history so mid-session joiners see the backlog
    chatMessages: room.chatHistory ?? [],
    title: room.title,
    isPrivate: room.isPrivate,
    hasPassword: room.hasPassword,
    kickedMessage: '',
    playlist: room.playlist ?? [],
    currentItemId: room.currentItemId ?? null,
    requests: room.requests ?? [],
  });
}
