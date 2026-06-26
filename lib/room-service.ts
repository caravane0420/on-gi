/* ================================================================
 * Room Service — Upstash Redis room management
 *
 * Stateless functions for CRUD operations on rooms.
 * Uses @upstash/redis (HTTP) — compatible with Serverless & Edge.
 *
 * Redis Schema:
 *   room:{roomId}           → Hash  (hostId, videoId, videoState, currentTime,
 *                                     lastSyncAt, createdAt, title, isPrivate, password)
 *   room:{roomId}:users     → List  (FIFO queue — index 0 = host)
 *   room:{roomId}:nicknames → Hash  (userId → nickname)
 * ================================================================ */

import { redis } from './redis';
import type { UserInfo, RoomState, RoomSettings } from '@/types';

/* ──────────────── Create ──────────────── */

export async function createRoom(
  roomId: string,
  userId: string,
  nickname: string,
  settings?: { title?: string; isPrivate?: boolean; password?: string },
): Promise<RoomState> {
  const now = Date.now();
  const pipe = redis.pipeline();

  pipe.hset(`room:${roomId}`, {
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
  pipe.rpush(`room:${roomId}:users`, userId);
  pipe.hset(`room:${roomId}:nicknames`, { [userId]: nickname });

  await pipe.exec();
  return getRoom(roomId);
}

/* ──────────────── Join ──────────────── */

export async function joinRoom(
  roomId: string,
  userId: string,
  nickname: string,
): Promise<RoomState | null> {
  const exists = await roomExists(roomId);
  if (!exists) return null;

  const pipe = redis.pipeline();
  pipe.rpush(`room:${roomId}:users`, userId);
  pipe.hset(`room:${roomId}:nicknames`, { [userId]: nickname });

  await pipe.exec();
  return getRoom(roomId);
}

/* ──────────────── Leave ──────────────── */

export async function leaveRoom(
  roomId: string,
  userId: string,
): Promise<{ room: RoomState | null; hostChanged: boolean; isEmpty: boolean }> {
  const pipe = redis.pipeline();
  pipe.lrem(`room:${roomId}:users`, 0, userId);
  pipe.hdel(`room:${roomId}:nicknames`, userId);
  await pipe.exec();

  const userCount = await redis.llen(`room:${roomId}:users`);

  if (userCount === 0) {
    await deleteRoom(roomId);
    return { room: null, hostChanged: false, isEmpty: true };
  }

  const currentHost = await redis.hget<string>(`room:${roomId}`, 'hostId');
  let hostChanged = false;

  if (currentHost === userId) {
    hostChanged = await delegateHost(roomId);
  }

  const room = await getRoom(roomId);
  return { room, hostChanged, isEmpty: false };
}

/* ──────────────── Kick ──────────────── */

export async function kickUser(roomId: string, userId: string): Promise<void> {
  const pipe = redis.pipeline();
  pipe.lrem(`room:${roomId}:users`, 0, userId);
  pipe.hdel(`room:${roomId}:nicknames`, userId);
  await pipe.exec();
}

/* ──────────────── Host Delegation (FIFO) ──────────────── */

export async function delegateHost(roomId: string): Promise<boolean> {
  const newHost = await redis.lindex(`room:${roomId}:users`, 0);
  if (!newHost) return false;
  await redis.hset(`room:${roomId}`, { hostId: newHost });
  return true;
}

/* ──────────────── Read ──────────────── */

export async function getRoom(roomId: string): Promise<RoomState> {
  const [meta, userIds, nicknames] = await Promise.all([
    redis.hgetall<Record<string, string>>(`room:${roomId}`),
    redis.lrange<string>(`room:${roomId}:users`, 0, -1),
    redis.hgetall<Record<string, string>>(`room:${roomId}:nicknames`),
  ]);

  const m = meta || {};
  const n = nicknames || {};

  const users: UserInfo[] = (userIds || []).map((id) => ({
    id,
    nickname: n[id] || 'Unknown',
    isHost: id === m.hostId,
  }));

  return {
    roomId,
    hostId: m.hostId || '',
    videoId: m.videoId || '',
    videoState: parseInt(m.videoState || '2', 10),
    currentTime: parseFloat(m.currentTime || '0'),
    lastSyncAt: parseInt(m.lastSyncAt || '0', 10),
    users,
    title: m.title || '',
    isPrivate: m.isPrivate === '1',
    hasPassword: !!m.password && m.password.length > 0,
  };
}

export async function roomExists(roomId: string): Promise<boolean> {
  return (await redis.exists(`room:${roomId}`)) === 1;
}

export async function isHost(roomId: string, userId: string): Promise<boolean> {
  const hostId = await redis.hget<string>(`room:${roomId}`, 'hostId');
  return hostId === userId;
}

export async function getNickname(
  roomId: string,
  userId: string,
): Promise<string> {
  return (await redis.hget<string>(`room:${roomId}:nicknames`, userId)) || 'Unknown';
}

/* ──────────────── Room Settings ──────────────── */

export async function getRoomSettings(roomId: string): Promise<RoomSettings> {
  const [title, isPrivate, password] = await Promise.all([
    redis.hget<string>(`room:${roomId}`, 'title'),
    redis.hget<string>(`room:${roomId}`, 'isPrivate'),
    redis.hget<string>(`room:${roomId}`, 'password'),
  ]);
  return {
    title: title || '',
    isPrivate: isPrivate === '1',
    hasPassword: !!password && password.length > 0,
  };
}

export async function updateSettings(
  roomId: string,
  settings: { title?: string; isPrivate?: boolean; password?: string },
): Promise<void> {
  const updates: Record<string, string> = {};
  if (settings.title !== undefined) updates.title = settings.title;
  if (settings.isPrivate !== undefined) updates.isPrivate = settings.isPrivate ? '1' : '0';
  if (settings.password !== undefined) updates.password = settings.password;

  if (Object.keys(updates).length > 0) {
    await redis.hset(`room:${roomId}`, updates);
  }
}

export async function hasPassword(roomId: string): Promise<boolean> {
  const pw = await redis.hget<string>(`room:${roomId}`, 'password');
  return !!pw && pw.length > 0;
}

export async function verifyPassword(
  roomId: string,
  password: string,
): Promise<boolean> {
  const stored = await redis.hget<string>(`room:${roomId}`, 'password');
  return stored === password;
}

/* ──────────────── Sync State ──────────────── */

export async function updateSyncState(
  roomId: string,
  state: Partial<{ videoState: number; currentTime: number; videoId: string }>,
): Promise<void> {
  const updates: Record<string, string> = {
    lastSyncAt: String(Date.now()),
  };
  if (state.videoState !== undefined) updates.videoState = String(state.videoState);
  if (state.currentTime !== undefined) updates.currentTime = String(state.currentTime);
  if (state.videoId !== undefined) updates.videoId = state.videoId;

  await redis.hset(`room:${roomId}`, updates);
}

/* ──────────────── Delete ──────────────── */

async function deleteRoom(roomId: string): Promise<void> {
  await redis.del(
    `room:${roomId}`,
    `room:${roomId}:users`,
    `room:${roomId}:nicknames`,
  );
}
