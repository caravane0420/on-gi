/* ================================================================
 * Room State Store (Zustand + Pusher)
 *
 * Replaces the old Socket.io store. Key differences:
 * - Actions call API Routes via fetch() instead of socket.emit()
 * - Real-time events come from Pusher channel.bind() instead of socket.on()
 * - Heartbeat/chat/buffering use Pusher Client Events (no API call)
 * ================================================================ */

'use client';

import { create } from 'zustand';
import { createPusherClient } from '@/lib/pusher-client';
import type {
  UserInfo,
  RoomState,
  ChatMessage,
  RoomSettings,
  CreateRoomResponse,
  JoinRoomResponse,
  PusherUserJoinedPayload,
  PusherUserLeftPayload,
  PusherHostChangedPayload,
  PusherKickedPayload,
  PusherSyncPayload,
  PusherVideoChangedPayload,
  ClientHeartbeatPayload,
  ClientChatPayload,
  ClientBufferingEndPayload,
} from '@/types';
import type PusherClient from 'pusher-js';
import type { Channel } from 'pusher-js';

/** Extended Channel type — presence channels support trigger() at runtime */
type PusherChannel = Channel & {
  trigger(eventName: string, data: unknown): boolean;
};

interface RoomStoreState {
  /* ── Connection ─────────────────────────────────────────────── */
  userId: string | null;
  pusherClient: PusherClient | null;
  channel: PusherChannel | null;

  /* ── Room State ─────────────────────────────────────────────── */
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
  kickedMessage: string;

  /* ── Getters ────────────────────────────────────────────────── */
  isHost: () => boolean;

  /* ── Actions (API calls) ────────────────────────────────────── */
  createRoom: (nickname: string) => Promise<{ roomId: string }>;
  joinRoom: (
    roomId: string,
    nickname: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  leaveRoom: () => void;
  kickUser: (targetUserId: string) => void;
  updateSettings: (settings: {
    title?: string;
    isPrivate?: boolean;
    password?: string;
  }) => void;
  changeVideo: (videoId: string) => void;

  /* ── Sync (API for state-change, Client Events for heartbeat) ── */
  sendSyncEvent: (state: number, currentTime: number, videoId: string) => void;
  sendHeartbeat: (currentTime: number) => void;
  sendBuffering: () => void;
  sendBufferingEnd: (currentTime: number) => void;

  /* ── Chat (Client Events — no API) ──────────────────────────── */
  sendChatMessage: (message: string) => void;

  /* ── Pusher Lifecycle ───────────────────────────────────────── */
  initPusher: () => void;
  cleanupPusher: () => void;
  clearKickedMessage: () => void;
  reset: () => void;
}

const initialState = {
  userId: null as string | null,
  pusherClient: null as PusherClient | null,
  channel: null as PusherChannel | null,
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
};

export const useRoomStore = create<RoomStoreState>((set, get) => ({
  ...initialState,

  /* ── Getters ────────────────────────────────────────────────── */

  isHost: () => {
    const { userId, hostId } = get();
    return userId != null && hostId === userId;
  },

  /* ── Actions ────────────────────────────────────────────────── */

  createRoom: async (nickname) => {
    const res = await fetch('/api/room/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname }),
    });
    const data: CreateRoomResponse = await res.json();

    set({
      roomId: data.roomId,
      userId: data.userId,
      nickname,
      users: data.room.users,
      hostId: data.room.hostId,
      videoId: data.room.videoId,
      videoState: data.room.videoState,
      currentTime: data.room.currentTime,
      title: data.room.title,
      isPrivate: data.room.isPrivate,
      hasPassword: data.room.hasPassword,
      chatMessages: [],
      kickedMessage: '',
    });

    return { roomId: data.roomId };
  },

  joinRoom: async (roomId, nickname, password?) => {
    const res = await fetch('/api/room/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, nickname, password }),
    });
    const data: JoinRoomResponse = await res.json();

    if (data.success && data.room && data.userId) {
      set({
        roomId,
        userId: data.userId,
        nickname,
        users: data.room.users,
        hostId: data.room.hostId,
        videoId: data.room.videoId,
        videoState: data.room.videoState,
        currentTime: data.room.currentTime,
        title: data.room.title,
        isPrivate: data.room.isPrivate,
        hasPassword: data.room.hasPassword,
        chatMessages: [],
        kickedMessage: '',
      });
      return { success: true };
    }
    return { success: false, error: data.error };
  },

  leaveRoom: () => {
    const { roomId, userId } = get();
    if (roomId && userId) {
      // Use sendBeacon for reliable delivery on tab close
      navigator.sendBeacon(
        '/api/room/leave',
        new Blob(
          [JSON.stringify({ roomId, userId })],
          { type: 'application/json' },
        ),
      );
    }
    get().cleanupPusher();
    set({ ...initialState });
  },

  kickUser: async (targetUserId) => {
    const { roomId, userId } = get();
    if (!roomId || !userId) return;

    await fetch('/api/room/kick', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId, targetUserId }),
    });
  },

  updateSettings: async (settings) => {
    const { roomId, userId } = get();
    if (!roomId || !userId) return;

    await fetch('/api/room/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomId, userId, ...settings }),
    });
  },

  changeVideo: async (videoId) => {
    const { roomId, userId } = get();
    if (!roomId || !userId) return;

    set({ videoId, currentTime: 0, videoState: 2 });

    await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        type: 'video-change',
        videoId,
      }),
    });
  },

  /* ── Sync ───────────────────────────────────────────────────── */

  sendSyncEvent: (state, currentTime, videoId) => {
    const { roomId, userId } = get();
    if (!roomId || !userId) return;

    // Fire-and-forget (no await)
    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId,
        userId,
        type: 'state-change',
        state,
        currentTime,
        videoId,
      }),
    });
  },

  sendHeartbeat: (currentTime) => {
    const { channel } = get();
    if (!channel) return;
    // Client Event — no API call, Pusher direct
    channel.trigger('client-heartbeat', { currentTime } as ClientHeartbeatPayload);
  },

  sendBuffering: () => {
    const { channel } = get();
    if (!channel) return;
    channel.trigger('client-buffering', {});
  },

  sendBufferingEnd: (currentTime) => {
    const { channel } = get();
    if (!channel) return;
    channel.trigger('client-buffering-end', {
      currentTime,
    } as ClientBufferingEndPayload);
  },

  /* ── Chat (Client Event) ────────────────────────────────────── */

  sendChatMessage: (message) => {
    const { channel, userId, nickname } = get();
    if (!channel || !userId || !message.trim()) return;

    const payload: ClientChatPayload = {
      userId,
      nickname,
      message: message.trim(),
      timestamp: Date.now(),
    };

    channel.trigger('client-chat-message', payload);

    // Add to local state immediately (sender sees their own message)
    set((s) => ({
      chatMessages: [...s.chatMessages, payload],
    }));
  },

  /* ── Pusher Lifecycle ───────────────────────────────────────── */

  initPusher: () => {
    const { userId, nickname, roomId } = get();
    if (!userId || !nickname || !roomId) return;

    const client = createPusherClient(userId, nickname);
    const channel = client.subscribe(`presence-room-${roomId}`) as PusherChannel;

    // Grace period timer for host disconnect
    let gracePeriodTimer: NodeJS.Timeout | null = null;

    // ── Pusher Presence Events ───────────────────────────────────

    channel.bind('pusher:member_removed', (member: { id: string }) => {
      const { hostId, roomId: rid } = get();
      if (member.id === hostId && rid) {
        // Host disconnected — start 5s grace period
        gracePeriodTimer = setTimeout(() => {
          gracePeriodTimer = null;
          fetch('/api/room/delegate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              roomId: rid,
              disconnectedUserId: member.id,
            }),
          });
        }, 5000);
      }
    });

    channel.bind('pusher:member_added', (member: { id: string }) => {
      const { hostId } = get();
      // If the host reconnected within grace period, cancel delegation
      if (member.id === hostId && gracePeriodTimer) {
        clearTimeout(gracePeriodTimer);
        gracePeriodTimer = null;
      }
    });

    // ── Custom Server Events (from API Routes via Pusher) ────────

    channel.bind('user-joined', (data: PusherUserJoinedPayload) => {
      set({ users: data.users });
    });

    channel.bind('user-left', (data: PusherUserLeftPayload) => {
      set({ users: data.users });
    });

    channel.bind('host-changed', (data: PusherHostChangedPayload) => {
      set({ hostId: data.hostId, users: data.users });
    });

    channel.bind('user-kicked', (data: PusherKickedPayload) => {
      const { userId: myId } = get();
      if (data.targetUserId === myId) {
        get().cleanupPusher();
        set({
          ...initialState,
          kickedMessage: data.message,
        });
      }
    });

    channel.bind('settings-changed', (data: RoomSettings) => {
      set({
        title: data.title,
        isPrivate: data.isPrivate,
        hasPassword: data.hasPassword,
      });
    });

    channel.bind('sync-state-change', (data: PusherSyncPayload) => {
      set({
        videoState: data.state,
        currentTime: data.currentTime,
        videoId: data.videoId,
      });
    });

    channel.bind('video-changed', (data: PusherVideoChangedPayload) => {
      set({ videoId: data.videoId, currentTime: 0, videoState: 2 });
    });

    // ── Client Events (direct client-to-client via Pusher) ───────

    channel.bind('client-heartbeat', (data: ClientHeartbeatPayload) => {
      set({ currentTime: data.currentTime });
    });

    channel.bind('client-buffering', () => {
      set({ videoState: 2 });
    });

    channel.bind('client-buffering-end', (data: ClientBufferingEndPayload) => {
      set({ videoState: 1, currentTime: data.currentTime });
    });

    channel.bind('client-chat-message', (data: ClientChatPayload) => {
      const { userId: myId } = get();
      // Don't duplicate own messages (already added in sendChatMessage)
      if (data.userId === myId) return;
      set((s) => ({
        chatMessages: [...s.chatMessages, data],
      }));
    });

    set({ pusherClient: client, channel });

    // Cleanup on tab close
    const handleBeforeUnload = () => {
      get().leaveRoom();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Store cleanup ref
    (channel as any).__cleanupBeforeUnload = handleBeforeUnload;
    (channel as any).__gracePeriodTimer = gracePeriodTimer;
  },

  cleanupPusher: () => {
    const { pusherClient, channel, roomId } = get();

    if (channel) {
      const handler = (channel as any).__cleanupBeforeUnload;
      if (handler) window.removeEventListener('beforeunload', handler);

      const timer = (channel as any).__gracePeriodTimer;
      if (timer) clearTimeout(timer);

      channel.unbind_all();
    }

    if (pusherClient && roomId) {
      pusherClient.unsubscribe(`presence-room-${roomId}`);
      pusherClient.disconnect();
    }

    set({ pusherClient: null, channel: null });
  },

  clearKickedMessage: () => set({ kickedMessage: '' }),

  reset: () => {
    get().cleanupPusher();
    set({ ...initialState });
  },
}));
