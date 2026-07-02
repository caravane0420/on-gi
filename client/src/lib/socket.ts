/* ================================================================
 * Socket.io Client Instance (singleton)
 *
 * The persistent `userId` is sent in the handshake `auth` payload so the
 * server can recognise a refreshed tab as the same participant.
 * ================================================================ */

import { io, Socket } from 'socket.io-client';
import { getUserId } from './session';

// .trim() guards against a stray space/newline in the env var, which would
// otherwise become %20 in the socket URL and break the connection.
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001').trim();

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1_000,
  reconnectionDelayMax: 5_000,
  timeout: 10_000,
  transports: ['websocket', 'polling'],
  auth: { userId: getUserId() },
});
