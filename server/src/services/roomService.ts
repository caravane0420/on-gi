/* ================================================================
 * Room Service — Redis-backed room management
 *
 * v3 — Identity keyed by persistent `userId` (survives refresh).
 *       A separate `sockets` hash maps userId → live socketId so we
 *       can target emits (kick, force-sync) and relay host time.
 *       Adds chat history (Redis List, capped) + reconnection helpers.
 *
 * Redis schema:
 *   room:{id}            Hash   hostId(=userId), videoId, videoState,
 *                               currentTime, lastSyncAt, createdAt,
 *                               title, isPrivate, password
 *   room:{id}:users      List   FIFO of userId (index 0 = host candidate)
 *   room:{id}:nicknames  Hash   userId → nickname
 *   room:{id}:sockets    Hash   userId → socketId (current live socket)
 *   room:{id}:chat       List   JSON ChatMessageData (capped to N)
 *   user:{userId}:room   String userId → roomId (reverse lookup)
 *   socket:{socketId}    String socketId → userId (reverse lookup)
 * ================================================================ */

import Redis from 'ioredis';
import type {
  UserInfo,
  RoomState,
  RoomSettings,
  ChatMessageData,
} from '../socket/types.js';
import { config } from '../config.js';

export class RoomService {
  constructor(private readonly redis: Redis) {}

  /* ─────────────── Key helpers ─────────────── */

  private kRoom = (id: string) => `room:${id}`;
  private kUsers = (id: string) => `room:${id}:users`;
  private kNicks = (id: string) => `room:${id}:nicknames`;
  private kSockets = (id: string) => `room:${id}:sockets`;
  private kChat = (id: string) => `room:${id}:chat`;
  private kUserRoom = (userId: string) => `user:${userId}:room`;
  private kSocketUser = (socketId: string) => `socket:${socketId}`;

  /** Refresh TTLs so an active room never expires mid-session */
  private async touch(roomId: string): Promise<void> {
    const ttl = config.roomTtlSec;
    const p = this.redis.pipeline();
    p.expire(this.kRoom(roomId), ttl);
    p.expire(this.kUsers(roomId), ttl);
    p.expire(this.kNicks(roomId), ttl);
    p.expire(this.kSockets(roomId), ttl);
    p.expire(this.kChat(roomId), ttl);
    await p.exec();
  }

  /* ─────────────── Create ─────────────── */

  async createRoom(
    roomId: string,
    userId: string,
    socketId: string,
    nickname: string,
    settings?: { title?: string; isPrivate?: boolean; password?: string },
  ): Promise<RoomState> {
    const now = Date.now();
    const p = this.redis.pipeline();

    p.hset(this.kRoom(roomId), {
      hostId: userId,
      videoId: '',
      videoState: '2',
      currentTime: '0',
      lastSyncAt: String(now),
      createdAt: String(now),
      title: settings?.title || '',
      isPrivate: settings?.isPrivate ? '1' : '0',
      password: settings?.password || '',
    });
    p.rpush(this.kUsers(roomId), userId);
    p.hset(this.kNicks(roomId), userId, nickname);
    p.hset(this.kSockets(roomId), userId, socketId);
    p.set(this.kUserRoom(userId), roomId);
    p.set(this.kSocketUser(socketId), userId);

    await p.exec();
    await this.touch(roomId);
    return this.getRoom(roomId);
  }

  /* ─────────────── Join (fresh) ─────────────── */

  async joinRoom(
    roomId: string,
    userId: string,
    socketId: string,
    nickname: string,
  ): Promise<RoomState | null> {
    if (!(await this.roomExists(roomId))) return null;

    const alreadyIn = await this.isUserInRoom(roomId, userId);

    const p = this.redis.pipeline();
    if (!alreadyIn) p.rpush(this.kUsers(roomId), userId);
    p.hset(this.kNicks(roomId), userId, nickname);
    p.hset(this.kSockets(roomId), userId, socketId);
    p.set(this.kUserRoom(userId), roomId);
    p.set(this.kSocketUser(socketId), userId);
    await p.exec();

    await this.touch(roomId);
    return this.getRoom(roomId);
  }

  /**
   * Reconnect an existing member to a new socket (refresh recovery).
   * Returns null if the room no longer exists.
   */
  async reattachSocket(
    roomId: string,
    userId: string,
    socketId: string,
    nickname: string,
  ): Promise<RoomState | null> {
    if (!(await this.roomExists(roomId))) return null;
    return this.joinRoom(roomId, userId, socketId, nickname);
  }

  /* ─────────────── Leave ─────────────── */

  async leaveRoom(
    roomId: string,
    userId: string,
  ): Promise<{ room: RoomState | null; hostChanged: boolean; isEmpty: boolean }> {
    const p = this.redis.pipeline();
    p.lrem(this.kUsers(roomId), 0, userId);
    p.hdel(this.kNicks(roomId), userId);
    p.hdel(this.kSockets(roomId), userId);
    p.del(this.kUserRoom(userId));
    await p.exec();

    const userCount = await this.redis.llen(this.kUsers(roomId));
    if (userCount === 0) {
      await this.deleteRoom(roomId);
      return { room: null, hostChanged: false, isEmpty: true };
    }

    const currentHost = await this.redis.hget(this.kRoom(roomId), 'hostId');
    let hostChanged = false;
    if (currentHost === userId) {
      hostChanged = await this.delegateHost(roomId);
    }

    await this.touch(roomId);
    const room = await this.getRoom(roomId);
    return { room, hostChanged, isEmpty: false };
  }

  /* ─────────────── Kick ─────────────── */

  async kickUser(roomId: string, userId: string): Promise<void> {
    const p = this.redis.pipeline();
    p.lrem(this.kUsers(roomId), 0, userId);
    p.hdel(this.kNicks(roomId), userId);
    p.hdel(this.kSockets(roomId), userId);
    p.del(this.kUserRoom(userId));
    await p.exec();
  }

  /* ─────────────── Host Delegation (FIFO) ─────────────── */

  async delegateHost(roomId: string): Promise<boolean> {
    const newHost = await this.redis.lindex(this.kUsers(roomId), 0);
    if (!newHost) return false;
    await this.redis.hset(this.kRoom(roomId), 'hostId', newHost);
    return true;
  }

  /* ─────────────── Read ─────────────── */

  async getRoom(roomId: string): Promise<RoomState> {
    const [meta, userIds, nicknames, chatRaw] = await Promise.all([
      this.redis.hgetall(this.kRoom(roomId)),
      this.redis.lrange(this.kUsers(roomId), 0, -1),
      this.redis.hgetall(this.kNicks(roomId)),
      this.redis.lrange(this.kChat(roomId), 0, -1),
    ]);

    const users: UserInfo[] = userIds.map((id) => ({
      id,
      nickname: nicknames[id] || 'Unknown',
      isHost: id === meta.hostId,
    }));

    const chatHistory: ChatMessageData[] = chatRaw
      .map((raw) => {
        try {
          return JSON.parse(raw) as ChatMessageData;
        } catch {
          return null;
        }
      })
      .filter((m): m is ChatMessageData => m !== null);

    return {
      roomId,
      hostId: meta.hostId || '',
      videoId: meta.videoId || '',
      videoState: parseInt(meta.videoState || '2', 10),
      currentTime: parseFloat(meta.currentTime || '0'),
      lastSyncAt: parseInt(meta.lastSyncAt || '0', 10),
      users,
      title: meta.title || '',
      isPrivate: meta.isPrivate === '1',
      hasPassword: !!meta.password && meta.password.length > 0,
      chatHistory,
    };
  }

  async roomExists(roomId: string): Promise<boolean> {
    return (await this.redis.exists(this.kRoom(roomId))) === 1;
  }

  async isUserInRoom(roomId: string, userId: string): Promise<boolean> {
    const ids = await this.redis.lrange(this.kUsers(roomId), 0, -1);
    return ids.includes(userId);
  }

  /** roomId for a given userId (reverse lookup) */
  async getRoomByUser(userId: string): Promise<string | null> {
    return this.redis.get(this.kUserRoom(userId));
  }

  /** userId for a given socketId (reverse lookup) */
  async getUserBySocket(socketId: string): Promise<string | null> {
    return this.redis.get(this.kSocketUser(socketId));
  }

  async isHost(roomId: string, userId: string): Promise<boolean> {
    const hostId = await this.redis.hget(this.kRoom(roomId), 'hostId');
    return hostId === userId;
  }

  async getHostSocketId(roomId: string): Promise<string | null> {
    const hostId = await this.redis.hget(this.kRoom(roomId), 'hostId');
    if (!hostId) return null;
    return this.redis.hget(this.kSockets(roomId), hostId);
  }

  async getSocketId(roomId: string, userId: string): Promise<string | null> {
    return this.redis.hget(this.kSockets(roomId), userId);
  }

  async getNickname(roomId: string, userId: string): Promise<string> {
    return (await this.redis.hget(this.kNicks(roomId), userId)) || 'Unknown';
  }

  /** Clears the reverse socket→user pointer when a socket dies for good */
  async clearSocket(socketId: string): Promise<void> {
    await this.redis.del(this.kSocketUser(socketId));
  }

  /* ─────────────── Chat history ─────────────── */

  async appendChat(roomId: string, message: ChatMessageData): Promise<void> {
    const key = this.kChat(roomId);
    const p = this.redis.pipeline();
    p.rpush(key, JSON.stringify(message));
    p.ltrim(key, -config.chatHistoryLimit, -1); // keep only the last N
    p.expire(key, config.roomTtlSec);
    await p.exec();
  }

  async getChatHistory(roomId: string): Promise<ChatMessageData[]> {
    const raw = await this.redis.lrange(this.kChat(roomId), 0, -1);
    return raw
      .map((r) => {
        try {
          return JSON.parse(r) as ChatMessageData;
        } catch {
          return null;
        }
      })
      .filter((m): m is ChatMessageData => m !== null);
  }

  /* ─────────────── Room Settings ─────────────── */

  async getRoomSettings(roomId: string): Promise<RoomSettings> {
    const [title, isPrivate, password] = await Promise.all([
      this.redis.hget(this.kRoom(roomId), 'title'),
      this.redis.hget(this.kRoom(roomId), 'isPrivate'),
      this.redis.hget(this.kRoom(roomId), 'password'),
    ]);
    return {
      title: title || '',
      isPrivate: isPrivate === '1',
      hasPassword: !!password && password.length > 0,
    };
  }

  async updateSettings(
    roomId: string,
    settings: { title?: string; isPrivate?: boolean; password?: string },
  ): Promise<void> {
    const updates: Record<string, string> = {};
    if (settings.title !== undefined) updates.title = settings.title;
    if (settings.isPrivate !== undefined) updates.isPrivate = settings.isPrivate ? '1' : '0';
    if (settings.password !== undefined) updates.password = settings.password;

    if (Object.keys(updates).length > 0) {
      await this.redis.hset(this.kRoom(roomId), updates);
    }
  }

  async hasPassword(roomId: string): Promise<boolean> {
    const password = await this.redis.hget(this.kRoom(roomId), 'password');
    return !!password && password.length > 0;
  }

  async verifyPassword(roomId: string, password: string): Promise<boolean> {
    const stored = await this.redis.hget(this.kRoom(roomId), 'password');
    return stored === password;
  }

  /* ─────────────── Sync State ─────────────── */

  async updateSyncState(
    roomId: string,
    state: Partial<{ videoState: number; currentTime: number; videoId: string }>,
  ): Promise<void> {
    const updates: Record<string, string> = { lastSyncAt: String(Date.now()) };
    if (state.videoState !== undefined) updates.videoState = String(state.videoState);
    if (state.currentTime !== undefined) updates.currentTime = String(state.currentTime);
    if (state.videoId !== undefined) updates.videoId = state.videoId;
    await this.redis.hset(this.kRoom(roomId), updates);
  }

  /* ─────────────── Delete ─────────────── */

  private async deleteRoom(roomId: string): Promise<void> {
    await this.redis.del(
      this.kRoom(roomId),
      this.kUsers(roomId),
      this.kNicks(roomId),
      this.kSockets(roomId),
      this.kChat(roomId),
    );
  }
}
