/* ================================================================
 * RoomView — Main room layout (Player + Sidebar)
 *
 * Initializes Pusher on mount, cleans up on unmount.
 * If user has no userId (direct link access), shows inline join form.
 * ================================================================ */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/useRoomStore';
import VideoPlayer from './VideoPlayer';
import VideoInput from './VideoInput';
import UserList from './UserList';
import ChatPanel from './ChatPanel';
import RoomSettings from './RoomSettings';
import GoogleAds from './GoogleAds';

const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const AD_SLOT_ROOM = '0987654321';

interface RoomViewProps {
  roomId: string;
}

export default function RoomView({ roomId }: RoomViewProps) {
  const router = useRouter();
  const storeRoomId = useRoomStore((s) => s.roomId);
  const userId = useRoomStore((s) => s.userId);
  const title = useRoomStore((s) => s.title);
  const isPrivate = useRoomStore((s) => s.isPrivate);
  const isHost = useRoomStore((s) => s.isHost());
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const initPusher = useRoomStore((s) => s.initPusher);
  const cleanupPusher = useRoomStore((s) => s.cleanupPusher);
  const channel = useRoomStore((s) => s.channel);

  const [showSettings, setShowSettings] = useState(false);

  // ── Not yet joined? Redirect to lobby ──────────────────────────
  const isJoined = userId && storeRoomId === roomId;

  useEffect(() => {
    if (!isJoined) {
      // User accessed /room/xxx directly without joining — go to lobby
      router.replace('/');
      return;
    }

    // Initialize Pusher only once
    if (!channel) {
      initPusher();
    }

    return () => {
      // Cleanup happens in leaveRoom or page navigation
    };
  }, [isJoined, channel, initPusher, router]);

  const handleLeave = useCallback(() => {
    if (window.confirm('방을 나가시겠습니까?')) {
      cleanupPusher();
      leaveRoom();
      router.push('/');
    }
  }, [cleanupPusher, leaveRoom, router]);

  // Show nothing while redirecting
  if (!isJoined) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="text-center animate-fade-in">
          <div className="animate-spin h-8 w-8 border-2 border-brand-400 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-slate-400">로비로 이동 중…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-950">
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-800/60 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-lg font-bold flex-shrink-0">
            <span className="bg-gradient-to-r from-brand-400 to-purple-300 bg-clip-text text-transparent">SyncPlay</span>
          </h1>
          <div className="h-4 w-px bg-slate-700/50 flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            {title && <span className="text-sm font-medium text-slate-300 truncate max-w-[200px]">{title}</span>}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isPrivate && (
                <svg className="w-3.5 h-3.5 text-amber-400/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
              <code className="text-xs font-mono bg-slate-800/60 px-2 py-0.5 rounded text-brand-300 select-all cursor-pointer border border-slate-700/30">{roomId}</code>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isHost && (
            <button onClick={() => setShowSettings(true)} title="방 설정" className="p-2 rounded-lg text-slate-400 hover:text-brand-400 hover:bg-brand-500/10 transition-all">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          <button onClick={handleLeave} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            나가기
          </button>
        </div>
      </header>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col p-5 overflow-y-auto">
          <VideoPlayer />
          <VideoInput />
        </main>
        <aside className="w-80 xl:w-96 flex flex-col border-l border-slate-800/60 bg-slate-900/30 flex-shrink-0">
          <div className="border-b border-slate-800/60 flex-shrink-0"><UserList /></div>
          <div className="flex-1 min-h-0 flex flex-col"><ChatPanel /></div>
          <div className="border-t border-slate-800/60 p-3 flex-shrink-0">
            <GoogleAds adClient={AD_CLIENT} adSlot={AD_SLOT_ROOM} adFormat="rectangle" className="rounded-lg overflow-hidden" />
          </div>
        </aside>
      </div>

      <RoomSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
