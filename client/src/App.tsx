/* ================================================================
 * App — Root component
 *
 * • Connects the socket once on mount
 * • Auto-rejoins the last room after a refresh (issue #5)
 * • Renders LobbyView when no room is active, RoomView otherwise
 *
 * NOTE: we deliberately do NOT leaveRoom() on beforeunload — a refresh
 * must keep the seat so the same userId can reconnect within the grace
 * window. Real disconnects are handled server-side.
 * ================================================================ */

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from './stores/useRoomStore';
import { useSocketStore } from './stores/useSocketStore';
import { useThemeStore } from './stores/useThemeStore';
import { loadSession } from './lib/session';
import { socket } from './lib/socket';
import LobbyView from './components/LobbyView';
import RoomView from './components/RoomView';

export default function App() {
  const roomId = useRoomStore((s) => s.roomId);
  const rejoin = useRoomStore((s) => s.rejoin);
  const connect = useSocketStore((s) => s.connect);

  // Instantiate the theme store so the <html> class stays in sync
  useThemeStore((s) => s.theme);

  const [booting, setBooting] = useState(true);
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    connect();

    const saved = loadSession();
    if (!saved) {
      setBooting(false);
      return;
    }

    // Wait for the socket to be connected, then try to reclaim the seat
    const attempt = async () => {
      await rejoin(saved.roomId, saved.nickname);
      setBooting(false);
    };

    if (socket.connected) {
      attempt();
    } else {
      const onConnect = () => {
        socket.off('connect', onConnect);
        attempt();
      };
      socket.on('connect', onConnect);

      // Safety: don't hang on the splash forever if the server is down
      const t = window.setTimeout(() => {
        socket.off('connect', onConnect);
        setBooting(false);
      }, 8_000);
      return () => window.clearTimeout(t);
    }
  }, [connect, rejoin]);

  if (booting) return <BootSplash />;

  return roomId ? <RoomView /> : <LobbyView />;
}

/* ── Reconnect splash ─────────────────────────────────────────── */

function BootSplash() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-warm-50 dark:bg-warm-950 text-warm-500 dark:text-warm-400">
      <div className="h-10 w-10 rounded-full border-2 border-amber-400/40 border-t-amber-500 animate-spin" />
      <p className="text-sm">온기 연결 중…</p>
    </div>
  );
}
