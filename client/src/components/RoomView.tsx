/* ================================================================
 * RoomView — Main room layout (Player + Sidebar)  (온기)
 *
 * • Prominent, click-to-copy room code with '복사됨' tooltip (#7)
 * • overflow-hidden video column — no stray scrollbar (#4)
 * • Warm amber / warm-gray theme, light + dark (#6)
 * ================================================================ */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRoomStore } from '../stores/useRoomStore';
import VideoPlayer from './VideoPlayer';
import UserList from './UserList';
import ChatPanel from './ChatPanel';
import RoomSettings from './RoomSettings';
import PlaylistPanel from './PlaylistPanel';
import ReactionBar from './ReactionBar';
import ThemeToggle from './ThemeToggle';
import GoogleAds from './GoogleAds';

const AD_SLOT_ROOM = '0987654321'; // Replace with your AdSense slot ID

export default function RoomView() {
  const roomId = useRoomStore((s) => s.roomId);
  const title = useRoomStore((s) => s.title);
  const isPrivate = useRoomStore((s) => s.isPrivate);
  const leaveRoom = useRoomStore((s) => s.leaveRoom);
  const isHost = useRoomStore((s) => s.isHost());
  const playlist = useRoomStore((s) => s.playlist);
  const requests = useRoomStore((s) => s.requests);
  const nextVideo = useRoomStore((s) => s.nextVideo);
  const notice = useRoomStore((s) => s.notice);
  const clearNotice = useRoomStore((s) => s.clearNotice);

  const [showSettings, setShowSettings] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const handleLeave = useCallback(() => {
    if (window.confirm('방을 나가시겠습니까?')) leaveRoom();
  }, [leaveRoom]);

  // Auto-dismiss the request-result toast
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(clearNotice, 4000);
    return () => window.clearTimeout(t);
  }, [notice, clearNotice]);

  const pendingCount = isHost ? requests.length : 0;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden bg-warm-50 dark:bg-warm-950"
      style={{ height: '100dvh' }}
    >
      {/* ── Top Bar ──────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-warm-200 dark:border-warm-800 flex-shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <h1 className="text-base sm:text-lg font-extrabold flex-shrink-0 text-warm-900 dark:text-warm-50">
            온기
          </h1>
          <div className="hidden sm:block h-4 w-px bg-warm-200 dark:bg-warm-700 flex-shrink-0" />
          {title && (
            <span className="hidden md:inline-block text-sm font-medium text-warm-600 dark:text-warm-300 truncate max-w-[200px]">
              {isPrivate && <LockIcon />} {title}
            </span>
          )}
        </div>

        {/* Prominent, copyable room code */}
        <RoomCodeBadge roomId={roomId ?? ''} />

        <div className="flex items-center gap-0.5 sm:gap-1.5 flex-shrink-0">
          <ThemeToggle />
          {isHost && (
            <button
              onClick={() => setShowSettings(true)}
              title="방 설정"
              className="p-2 rounded-lg text-warm-500 hover:text-brand-500 hover:bg-brand-500/10 dark:text-warm-400 dark:hover:text-brand-400 transition-all"
            >
              <GearIcon />
            </button>
          )}
          <button
            onClick={handleLeave}
            title="나가기"
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-sm text-warm-500 dark:text-warm-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <ExitIcon />
            <span className="hidden sm:inline">나가기</span>
          </button>
        </div>
      </header>

      {/* ── Content ── mobile: stacked (video↑ / panel↓) · desktop: row ── */}
      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* Video Player — fixed height on mobile, flex on desktop */}
        <main className="flex flex-col p-3 lg:p-5 gap-3 flex-shrink-0 lg:flex-1 lg:overflow-hidden lg:min-w-0">
          <VideoPlayer />

          {/* Reactions + playlist / skip controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <ReactionBar />
            <div className="flex items-center gap-2">
              {isHost && (
                <button
                  onClick={nextVideo}
                  title="다음 곡"
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium bg-warm-100 dark:bg-warm-850 hover:bg-warm-200 dark:hover:bg-warm-800 text-warm-700 dark:text-warm-200 transition-colors active:scale-95"
                >
                  <SkipIcon /> 다음 곡
                </button>
              )}
              <button
                onClick={() => setShowPlaylist(true)}
                className="relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-warm-950 transition-colors active:scale-95"
              >
                <ListIcon /> 재생목록
                <span className="text-xs opacity-80">{playlist.length}</span>
                {pendingCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </main>

        {/* Sidebar — fills remaining height on mobile, fixed width on desktop */}
        <aside className="flex-1 min-h-0 flex flex-col border-t lg:border-t-0 lg:border-l border-warm-200 dark:border-warm-800 bg-warm-100/60 dark:bg-warm-900/40 lg:w-80 xl:w-96 lg:flex-none">
          <div className="border-b border-warm-200 dark:border-warm-800 flex-shrink-0 max-h-32 overflow-y-auto lg:max-h-none lg:overflow-visible">
            <UserList />
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <ChatPanel />
          </div>
          {/* Ads hidden on mobile to preserve chat space */}
          <div className="hidden lg:block border-t border-warm-200 dark:border-warm-800 p-3 flex-shrink-0">
            <GoogleAds adSlot={AD_SLOT_ROOM} adFormat="rectangle" className="rounded-lg overflow-hidden" />
          </div>
        </aside>
      </div>

      <RoomSettings isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <PlaylistPanel isOpen={showPlaylist} onClose={() => setShowPlaylist(false)} />

      {/* Request-result toast */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="px-4 py-2.5 rounded-xl bg-warm-900 dark:bg-warm-100 text-warm-50 dark:text-warm-900 text-sm font-medium shadow-lg max-w-[90vw] truncate">
            {notice}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Room Code Badge (click to copy + tooltip) ────────────────── */

function RoomCodeBadge({ roomId }: { roomId: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function copy() {
    const inviteBase = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    try {
      // Copy the full invite link so friends can deep-link straight in
      await navigator.clipboard.writeText(inviteBase);
    } catch {
      // Fallback for insecure contexts / older browsers
      const ta = document.createElement('textarea');
      ta.value = inviteBase;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="relative flex items-center gap-2 min-w-0">
      <span className="hidden sm:block text-[11px] font-semibold uppercase tracking-wider text-warm-400 dark:text-warm-500">
        방 코드
      </span>
      <button
        onClick={copy}
        title="클릭하면 초대 링크가 복사됩니다"
        className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/30 transition-all active:scale-[0.97]"
      >
        <code className="text-base sm:text-lg font-mono font-bold tracking-[0.18em] text-brand-600 dark:text-brand-300 select-all">
          {roomId}
        </code>
        <CopyIcon />
      </button>

      {/* '복사됨' tooltip */}
      <span
        className={`pointer-events-none absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2.5 py-1 rounded-md bg-warm-900 dark:bg-warm-100 text-warm-50 dark:text-warm-900 text-xs font-medium shadow-lg transition-all duration-200 ${
          copied ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
        }`}
      >
        복사됨!
      </span>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────── */

function CopyIcon() {
  return (
    <svg className="w-4 h-4 text-brand-500 dark:text-brand-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function ExitIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="inline w-3.5 h-3.5 text-brand-500 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function SkipIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M6 5v14l8-7zM16 5h2v14h-2z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
    </svg>
  );
}
