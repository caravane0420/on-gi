/* ================================================================
 * Socket.io Event Handlers  (v3 — persistent userId identity)
 *
 * ─ Identity = socket.data.userId (survives browser refresh)
 * ─ Grace period on disconnect for EVERYONE (fixes clone / 분신술)
 * ─ room:rejoin restores a member onto a fresh socket
 * ─ Chat history persisted in Redis + replayed on join/rejoin
 * ─ Late-joiner sync: server asks host for live time → forces seek
 * ─ Host-Centric Sync (play/pause/seek broadcast + 3s heartbeat)
 * ─ FIFO Host Delegation, Kick, live Room Settings
 * ================================================================ */

import type { Server, Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from './types.js';
import { RoomService } from '../services/roomService.js';
import { config } from '../config.js';
import { nanoid } from 'nanoid';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

/**
 * Active grace-period timers keyed by **userId** (not socketId), so a
 * reconnecting socket for the same user can cancel its own removal.
 */
const disconnectTimers = new Map<string, NodeJS.Timeout>();

/** Called from the connection handler when a user's socket reconnects. */
export function cancelGraceTimer(userId: string): void {
  const timer = disconnectTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(userId);
    console.log(`[grace] Cancelled pending removal for user ${userId} (reconnected)`);
  }
}

// ── Public API ──────────────────────────────────────────────────

export function registerHandlers(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  handleRoomCreate(io, socket, roomService);
  handleRoomJoin(io, socket, roomService);
  handleRoomRejoin(io, socket, roomService);
  handleRoomLeave(io, socket, roomService);
  handleRoomKick(io, socket, roomService);
  handleRoomUpdateSettings(io, socket, roomService);
  handleSyncStateChange(io, socket, roomService);
  handleSyncHeartbeat(io, socket, roomService);
  handleSyncProvideTime(io, socket, roomService);
  handleVideoChange(io, socket, roomService);
  handleChatMessage(io, socket, roomService);
  handlePlaylist(io, socket, roomService);
  handleReaction(io, socket, roomService);
  handleDisconnect(io, socket, roomService);
}

// ── YouTube title (server-side oEmbed, no API key, no CORS issue) ──

async function fetchYouTubeTitle(videoId: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return '';
    const data = (await res.json()) as { title?: string };
    return typeof data.title === 'string' ? data.title : '';
  } catch {
    return '';
  }
}

// ── Room: Create ────────────────────────────────────────────────

function handleRoomCreate(
  _io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:create', async (data, callback) => {
    try {
      const userId = data.userId || socket.data.userId;
      const roomId = nanoid(8);

      const room = await roomService.createRoom(roomId, userId, socket.id, data.nickname, {
        title: data.title,
        isPrivate: data.isPrivate,
        password: data.password,
      });

      socket.data.userId = userId;
      socket.data.nickname = data.nickname;
      socket.data.roomId = roomId;
      socket.join(roomId);

      console.log(`[room:create] ${data.nickname} (${userId}) created room ${roomId}`);
      callback({ roomId, room });
    } catch (err) {
      console.error('[room:create] Error:', err);
    }
  });
}

// ── Room: Join (fresh, password-gated) ──────────────────────────

function handleRoomJoin(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:join', async (data, callback) => {
    try {
      const userId = data.userId || socket.data.userId;

      if (!(await roomService.roomExists(data.roomId))) {
        callback({ success: false, error: '방을 찾을 수 없습니다.' });
        return;
      }

      // Password gate — skipped if the user is already a member (rejoin-ish)
      const alreadyMember = await roomService.isUserInRoom(data.roomId, userId);
      if (!alreadyMember && (await roomService.hasPassword(data.roomId))) {
        if (!data.password) {
          callback({ success: false, error: 'password_required' });
          return;
        }
        if (!(await roomService.verifyPassword(data.roomId, data.password))) {
          callback({ success: false, error: '비밀번호가 틀렸습니다.' });
          return;
        }
      }

      const room = await roomService.joinRoom(data.roomId, userId, socket.id, data.nickname);
      if (!room) {
        callback({ success: false, error: '방에 입장할 수 없습니다.' });
        return;
      }

      socket.data.userId = userId;
      socket.data.nickname = data.nickname;
      socket.data.roomId = data.roomId;
      socket.join(data.roomId);

      callback({ success: true, room });

      socket.to(data.roomId).emit('room:user-joined', {
        userId,
        nickname: data.nickname,
        users: room.users,
      });

      // Late-joiner sync — pull the live position from the host
      await requestHostTimeFor(socket, roomService, data.roomId, userId);

      console.log(`[room:join] ${data.nickname} (${userId}) joined room ${data.roomId}`);
    } catch (err) {
      console.error('[room:join] Error:', err);
      callback({ success: false, error: '서버 오류가 발생했습니다.' });
    }
  });
}

// ── Room: Rejoin (refresh / reconnect recovery) ─────────────────

function handleRoomRejoin(
  socketIo: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:rejoin', async (data, callback) => {
    try {
      const userId = data.userId || socket.data.userId;

      // Make sure no stale removal timer fires while we restore state
      cancelGraceTimer(userId);

      if (!(await roomService.roomExists(data.roomId))) {
        callback({ success: false, error: 'room_gone' });
        return;
      }

      const wasMember = await roomService.isUserInRoom(data.roomId, userId);

      const room = await roomService.reattachSocket(
        data.roomId,
        userId,
        socket.id,
        data.nickname,
      );
      if (!room) {
        callback({ success: false, error: 'room_gone' });
        return;
      }

      socket.data.userId = userId;
      socket.data.nickname = data.nickname;
      socket.data.roomId = data.roomId;
      socket.join(data.roomId);

      callback({ success: true, room });

      // Tell everyone the roster (nickname/host may be unchanged, but the
      // list is authoritative and cheap to broadcast)
      socketIo.to(data.roomId).emit('room:user-joined', {
        userId,
        nickname: data.nickname,
        users: room.users,
      });

      // Whether it's a true reconnect or a grace-expired re-entry, the
      // player needs to be re-synced to the host's live position.
      await requestHostTimeFor(socket, roomService, data.roomId, userId);

      console.log(
        `[room:rejoin] ${data.nickname} (${userId}) ${wasMember ? 'reconnected to' : 're-entered'} room ${data.roomId}`,
      );
    } catch (err) {
      console.error('[room:rejoin] Error:', err);
      callback({ success: false, error: 'server_error' });
    }
  });
}

// ── Room: Leave ─────────────────────────────────────────────────

function handleRoomLeave(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:leave', async () => {
    await processLeave(io, socket, roomService, { immediate: true });
  });
}

// ── Room: Kick (Host only) ──────────────────────────────────────

function handleRoomKick(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:kick', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;

      if (!(await roomService.isHost(roomId, socket.data.userId))) {
        socket.emit('room:error', { message: '방장만 강제퇴장을 할 수 있습니다.' });
        return;
      }
      if (data.targetUserId === socket.data.userId) return; // can't kick yourself

      const targetSocketId = await roomService.getSocketId(roomId, data.targetUserId);

      // Cancel any grace timer so the kicked user can't sneak back
      cancelGraceTimer(data.targetUserId);
      await roomService.kickUser(roomId, data.targetUserId);
      const room = await roomService.getRoom(roomId);

      if (targetSocketId) {
        const targetSocket = io.sockets.sockets.get(targetSocketId);
        if (targetSocket) {
          targetSocket.emit('room:kicked', { message: '방장에 의해 퇴장되었습니다.' });
          targetSocket.leave(roomId);
          targetSocket.data.roomId = null;
        }
      }

      io.to(roomId).emit('room:user-left', {
        userId: data.targetUserId,
        users: room.users,
      });

      console.log(`[room:kick] ${data.targetUserId} kicked from room ${roomId}`);
    } catch (err) {
      console.error('[room:kick] Error:', err);
    }
  });
}

// ── Room: Update Settings (Host only) ───────────────────────────

function handleRoomUpdateSettings(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('room:update-settings', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;

      if (!(await roomService.isHost(roomId, socket.data.userId))) {
        socket.emit('room:error', { message: '방장만 설정을 변경할 수 있습니다.' });
        return;
      }

      await roomService.updateSettings(roomId, data);
      const settings = await roomService.getRoomSettings(roomId);

      io.to(roomId).emit('room:settings-changed', settings);
      console.log(`[room:update-settings] ${roomId} → title="${settings.title}" private=${settings.isPrivate}`);
    } catch (err) {
      console.error('[room:update-settings] Error:', err);
    }
  });
}

// ── Sync: State Change (Host → Viewers) ─────────────────────────

function handleSyncStateChange(
  _io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('sync:state-change', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;
      if (!(await roomService.isHost(roomId, socket.data.userId))) return;

      await roomService.updateSyncState(roomId, {
        videoState: data.state,
        currentTime: data.currentTime,
        videoId: data.videoId,
      });

      // Buffering (3) — pause everyone until the host resumes
      if (data.state === 3) {
        socket.to(roomId).emit('sync:buffering');
        return;
      }

      socket.to(roomId).emit('sync:state-change', {
        state: data.state,
        currentTime: data.currentTime,
        videoId: data.videoId,
      });

      if (data.state === 1) {
        socket.to(roomId).emit('sync:buffering-end', { currentTime: data.currentTime });
      }
    } catch (err) {
      console.error('[sync:state-change] Error:', err);
    }
  });
}

// ── Sync: Heartbeat (Host → Server → Viewers, every 3s) ────────

function handleSyncHeartbeat(
  _io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('sync:heartbeat', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;
      if (!(await roomService.isHost(roomId, socket.data.userId))) return;

      await roomService.updateSyncState(roomId, {
        currentTime: data.currentTime,
        ...(data.state !== undefined ? { videoState: data.state } : {}),
      });
      socket.to(roomId).emit('sync:heartbeat', {
        currentTime: data.currentTime,
        state: data.state,
        volume: data.volume,
        muted: data.muted,
      });
    } catch (err) {
      console.error('[sync:heartbeat] Error:', err);
    }
  });
}

// ── Sync: Host provides live time → relay to the late joiner ────

function handleSyncProvideTime(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('sync:provide-time', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;
      // Only the host is authoritative
      if (!(await roomService.isHost(roomId, socket.data.userId))) return;

      // Persist so future joiners get an accurate baseline too
      await roomService.updateSyncState(roomId, {
        currentTime: data.currentTime,
        videoState: data.state,
        videoId: data.videoId,
      });

      io.to(data.requesterSocketId).emit('sync:force', {
        videoId: data.videoId,
        currentTime: data.currentTime,
        state: data.state,
      });
    } catch (err) {
      console.error('[sync:provide-time] Error:', err);
    }
  });
}

// ── Video: Change (Host only) ───────────────────────────────────

function handleVideoChange(
  _io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('video:change', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;
      if (!(await roomService.isHost(roomId, socket.data.userId))) return;

      await roomService.updateSyncState(roomId, {
        videoId: data.videoId,
        currentTime: 0,
        videoState: 2,
      });

      socket.to(roomId).emit('video:changed', { videoId: data.videoId });
      console.log(`[video:change] Room ${roomId} → ${data.videoId}`);
    } catch (err) {
      console.error('[video:change] Error:', err);
    }
  });
}

// ── Chat: Message (persisted + broadcast) ───────────────────────

function handleChatMessage(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('chat:message', async (data) => {
    try {
      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(socket.data.userId));
      if (!roomId) return;

      const message = (data.message ?? '').toString().slice(0, 500).trim();
      if (!message) return;

      const nickname = await roomService.getNickname(roomId, socket.data.userId);

      const payload = {
        userId: socket.data.userId,
        nickname,
        message,
        timestamp: Date.now(),
      };

      // Persist BEFORE broadcast so late joiners never miss a beat
      await roomService.appendChat(roomId, payload);
      io.to(roomId).emit('chat:message', payload);
    } catch (err) {
      console.error('[chat:message] Error:', err);
    }
  });
}

// ── Playlist (add / request / approve / reject / remove / play / next) ──

const ALLOWED_REACTIONS = new Set([
  '❤️', '😂', '👏', '🔥', '😮', '😢', '👍', '🎉', '🥵', '🖕', '💀',
]);

async function broadcastPlaylist(io: TypedServer, rs: RoomService, roomId: string): Promise<void> {
  const [playlist, currentItemId] = await Promise.all([
    rs.getPlaylist(roomId),
    rs.getCurrentItemId(roomId),
  ]);
  io.to(roomId).emit('playlist:updated', { playlist, currentItemId });
}

async function broadcastRequests(io: TypedServer, rs: RoomService, roomId: string): Promise<void> {
  const requests = await rs.getRequests(roomId);
  io.to(roomId).emit('requests:updated', { requests });
}

/** Switch the now-playing item, tell everyone to load it, refresh playlist. */
async function changeCurrent(
  io: TypedServer,
  rs: RoomService,
  roomId: string,
  itemId: string | null,
  autoplay: boolean,
): Promise<void> {
  const item = await rs.setCurrentItem(roomId, itemId);
  io.to(roomId).emit('video:changed', { videoId: item ? item.videoId : '', autoplay });
  await broadcastPlaylist(io, rs, roomId);
}

function handlePlaylist(io: TypedServer, socket: TypedSocket, rs: RoomService): void {
  const roomOf = async () =>
    socket.data.roomId ?? (await rs.getRoomByUser(socket.data.userId));
  const isHost = async (roomId: string) => rs.isHost(roomId, socket.data.userId);

  // Host adds directly to the playlist
  socket.on('playlist:add', async ({ videoId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId || !videoId) return;
      if (!(await isHost(roomId))) return;

      const title = await fetchYouTubeTitle(videoId);
      const item = {
        id: nanoid(10),
        videoId,
        title,
        addedById: socket.data.userId,
        addedByName: socket.data.nickname || 'Unknown',
      };
      await rs.addPlaylistItem(roomId, item);

      const currentId = await rs.getCurrentItemId(roomId);
      if (!currentId) {
        // Nothing playing → make this current (cued, host presses play)
        await changeCurrent(io, rs, roomId, item.id, false);
      } else {
        await broadcastPlaylist(io, rs, roomId);
      }
    } catch (err) { console.error('[playlist:add]', err); }
  });

  // Viewer requests a video → goes to the pending list for host approval
  socket.on('playlist:request', async ({ videoId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId || !videoId) return;

      const title = await fetchYouTubeTitle(videoId);
      await rs.addRequest(roomId, {
        id: nanoid(10),
        videoId,
        title,
        byId: socket.data.userId,
        byName: socket.data.nickname || 'Unknown',
      });
      await broadcastRequests(io, rs, roomId);
    } catch (err) { console.error('[playlist:request]', err); }
  });

  socket.on('playlist:approve', async ({ requestId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId) return;
      if (!(await isHost(roomId))) return;

      const req = await rs.removeRequest(roomId, requestId);
      if (!req) return;

      const item = {
        id: nanoid(10),
        videoId: req.videoId,
        title: req.title,
        addedById: req.byId,
        addedByName: req.byName,
      };
      await rs.addPlaylistItem(roomId, item);

      // Notify the requester
      const reqSocketId = await rs.getSocketId(roomId, req.byId);
      if (reqSocketId) {
        io.to(reqSocketId).emit('request:result', { approved: true, title: req.title || req.videoId });
      }

      const currentId = await rs.getCurrentItemId(roomId);
      if (!currentId) await changeCurrent(io, rs, roomId, item.id, false);
      else await broadcastPlaylist(io, rs, roomId);
      await broadcastRequests(io, rs, roomId);
    } catch (err) { console.error('[playlist:approve]', err); }
  });

  socket.on('playlist:reject', async ({ requestId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId) return;
      if (!(await isHost(roomId))) return;

      const req = await rs.removeRequest(roomId, requestId);
      if (req) {
        const reqSocketId = await rs.getSocketId(roomId, req.byId);
        if (reqSocketId) {
          io.to(reqSocketId).emit('request:result', { approved: false, title: req.title || req.videoId });
        }
      }
      await broadcastRequests(io, rs, roomId);
    } catch (err) { console.error('[playlist:reject]', err); }
  });

  socket.on('playlist:remove', async ({ itemId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId) return;
      if (!(await isHost(roomId))) return;

      const currentId = await rs.getCurrentItemId(roomId);
      if (itemId === currentId) {
        const next = await rs.getNextItem(roomId); // item after the one being removed
        await rs.removePlaylistItem(roomId, itemId);
        await changeCurrent(io, rs, roomId, next ? next.id : null, true);
      } else {
        await rs.removePlaylistItem(roomId, itemId);
        await broadcastPlaylist(io, rs, roomId);
      }
    } catch (err) { console.error('[playlist:remove]', err); }
  });

  socket.on('playlist:play', async ({ itemId }) => {
    try {
      const roomId = await roomOf();
      if (!roomId) return;
      if (!(await isHost(roomId))) return;
      await changeCurrent(io, rs, roomId, itemId, true);
    } catch (err) { console.error('[playlist:play]', err); }
  });

  socket.on('playlist:next', async () => {
    try {
      const roomId = await roomOf();
      if (!roomId) return;
      if (!(await isHost(roomId))) return;
      const next = await rs.getNextItem(roomId);
      if (next) await changeCurrent(io, rs, roomId, next.id, true);
    } catch (err) { console.error('[playlist:next]', err); }
  });
}

// ── Reactions (floating emoji overlay) ──────────────────────────

function handleReaction(io: TypedServer, socket: TypedSocket, rs: RoomService): void {
  socket.on('reaction:send', async ({ emoji }) => {
    try {
      if (!ALLOWED_REACTIONS.has(emoji)) return;
      const roomId = socket.data.roomId ?? (await rs.getRoomByUser(socket.data.userId));
      if (!roomId) return;
      io.to(roomId).emit('reaction:broadcast', {
        emoji,
        nickname: socket.data.nickname || '',
        id: nanoid(6),
      });
    } catch (err) { console.error('[reaction:send]', err); }
  });
}

// ── Disconnect (grace period for everyone) ──────────────────────

function handleDisconnect(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
): void {
  socket.on('disconnect', async (reason) => {
    try {
      const { userId } = socket.data;
      // Dead socket → drop its reverse pointer
      await roomService.clearSocket(socket.id);

      const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(userId));
      if (!roomId) return;

      console.log(
        `[disconnect] ${userId} (${socket.id}) dropped (${reason}). ` +
        `Grace ${config.gracePeriodMs}ms before removal…`,
      );

      // If a timer already exists for this user, keep the earliest one
      if (disconnectTimers.has(userId)) return;

      const timer = setTimeout(async () => {
        disconnectTimers.delete(userId);
        console.log(`[grace] Expired for ${userId} — removing from ${roomId}`);
        await finalizeLeave(io, roomService, roomId, userId);
      }, config.gracePeriodMs);

      disconnectTimers.set(userId, timer);
    } catch (err) {
      console.error('[disconnect] Error:', err);
    }
  });
}

// ── Late-joiner sync helper ─────────────────────────────────────

/**
 * Ask the room's host to report its live playback time and relay it to the
 * joining socket. If there is no video yet or the host is the joiner, this
 * is a no-op (the room snapshot already sent covers the empty case).
 */
async function requestHostTimeFor(
  socket: TypedSocket,
  roomService: RoomService,
  roomId: string,
  joinerUserId: string,
): Promise<void> {
  try {
    const room = await roomService.getRoom(roomId);
    if (!room.videoId) return; // nothing playing yet
    if (room.hostId === joinerUserId) return; // joiner is the host

    const hostSocketId = await roomService.getHostSocketId(roomId);
    if (!hostSocketId || hostSocketId === socket.id) return;

    // Give the joiner's YT player a moment to instantiate before the host
    // pushes the authoritative time.
    setTimeout(() => {
      socket.to(hostSocketId).emit('sync:request-time', {
        requesterSocketId: socket.id,
      });
    }, 800);
  } catch (err) {
    console.error('[requestHostTimeFor] Error:', err);
  }
}

// ── Shared leave logic ──────────────────────────────────────────

/** Explicit leave (button / tab close) — remove immediately, no grace. */
async function processLeave(
  io: TypedServer,
  socket: TypedSocket,
  roomService: RoomService,
  opts: { immediate: boolean },
): Promise<void> {
  try {
    const { userId } = socket.data;
    const roomId = socket.data.roomId ?? (await roomService.getRoomByUser(userId));
    if (!roomId) return;

    if (opts.immediate) cancelGraceTimer(userId);

    socket.leave(roomId);
    socket.data.roomId = null;

    await finalizeLeave(io, roomService, roomId, userId);
  } catch (err) {
    console.error('[processLeave] Error:', err);
  }
}

/** Removes a user from Redis and notifies the room (used by grace + leave). */
async function finalizeLeave(
  io: TypedServer,
  roomService: RoomService,
  roomId: string,
  userId: string,
): Promise<void> {
  try {
    const { room, hostChanged, isEmpty } = await roomService.leaveRoom(roomId, userId);

    if (isEmpty || !room) {
      console.log(`[leave] Room ${roomId} is now empty — deleted.`);
      return;
    }

    io.to(roomId).emit('room:user-left', { userId, users: room.users });

    if (hostChanged) {
      io.to(roomId).emit('room:host-changed', {
        hostId: room.hostId,
        users: room.users,
      });
      console.log(`[leave] Host delegated to ${room.hostId} in room ${roomId}`);
    }
  } catch (err) {
    console.error('[finalizeLeave] Error:', err);
  }
}
