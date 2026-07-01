/* ================================================================
 * Session identity & reconnection persistence
 *
 * A persistent `userId` lives in sessionStorage for the lifetime of the
 * browser tab. On refresh the tab keeps its sessionStorage, so the same
 * userId reconnects to the socket server and reclaims its seat — this is
 * what defeats the "clone / 분신술" bug (issue #5).
 *
 * We also stash the active roomId + nickname so App.tsx can auto-rejoin
 * after a reload without any user interaction.
 * ================================================================ */

const K_USER = 'ongi:userId';
const K_ROOM = 'ongi:roomId';
const K_NICK = 'ongi:nickname';

/** Small dependency-free unique id (crypto when available). */
function generateId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback for very old browsers
  return 'u_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Stable per-tab user id — created once, reused across refreshes. */
export function getUserId(): string {
  let id = sessionStorage.getItem(K_USER);
  if (!id) {
    id = generateId();
    sessionStorage.setItem(K_USER, id);
  }
  return id;
}

/* ── Reconnection breadcrumbs ─────────────────────────────────── */

export interface PersistedSession {
  roomId: string;
  nickname: string;
}

export function saveSession(roomId: string, nickname: string): void {
  sessionStorage.setItem(K_ROOM, roomId);
  sessionStorage.setItem(K_NICK, nickname);
}

export function loadSession(): PersistedSession | null {
  const roomId = sessionStorage.getItem(K_ROOM);
  const nickname = sessionStorage.getItem(K_NICK);
  if (!roomId || !nickname) return null;
  return { roomId, nickname };
}

export function clearSession(): void {
  sessionStorage.removeItem(K_ROOM);
  sessionStorage.removeItem(K_NICK);
}

/** Read the `?room=CODE` deep-link parameter (issue #8). */
export function getRoomFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    return room && room.trim() ? room.trim() : null;
  } catch {
    return null;
  }
}

/** Remove `?room=` from the address bar without reloading. */
export function stripRoomFromUrl(): void {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('room');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  } catch {
    /* ignore */
  }
}
