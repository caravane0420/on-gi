/* ================================================================
 * HostControls — custom player controls for the host
 *
 * The native YouTube bar is hidden (controls:0) so there's a single
 * volume UI. The host drives play/pause/seek here, which syncs to
 * everyone through the existing host-centric sync.
 * ================================================================ */

import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import { socket } from '../lib/socket';
import { useRoomStore } from '../stores/useRoomStore';
import { PlayerState } from '../types';
import VolumeControl from './VolumeControl';

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function HostControls({
  playerRef,
}: {
  playerRef: MutableRefObject<YT.Player | null>;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const draggingRef = useRef(false);

  // Poll the player for time/duration/state
  useEffect(() => {
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      try {
        setPlaying(p.getPlayerState() === PlayerState.PLAYING);
        setDuration(p.getDuration() || 0);
        if (!draggingRef.current) setCurrent(p.getCurrentTime() || 0);
      } catch { /* ignore */ }
    }, 500);
    return () => window.clearInterval(id);
  }, [playerRef]);

  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (p.getPlayerState() === PlayerState.PLAYING) p.pauseVideo();
      else p.playVideo();
    } catch { /* ignore */ }
  }

  function commitSeek(v: number) {
    draggingRef.current = false;
    const p = playerRef.current;
    if (!p) return;
    try {
      p.seekTo(v, true);
      setCurrent(v);
      // Push the new position to viewers immediately
      socket.emit('sync:state-change', {
        state: p.getPlayerState(),
        currentTime: v,
        videoId: useRoomStore.getState().videoId,
      });
    } catch { /* ignore */ }
  }

  function fullscreen() {
    try {
      playerRef.current?.getIframe()?.requestFullscreen?.();
    } catch { /* ignore */ }
  }

  const hasVideo = duration > 0;

  return (
    <div className="flex items-center gap-2 px-1 py-1">
      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        title={playing ? '일시정지' : '재생'}
        className="w-9 h-9 flex items-center justify-center rounded-lg bg-brand-500 hover:bg-brand-600 text-warm-950 transition-colors active:scale-95 flex-shrink-0"
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      {/* Seek bar */}
      <span className="text-[11px] tabular-nums text-warm-500 dark:text-warm-400 w-9 text-right flex-shrink-0">
        {fmt(current)}
      </span>
      <input
        type="range"
        min={0}
        max={hasVideo ? duration : 100}
        step={0.5}
        value={current}
        disabled={!hasVideo}
        onChange={(e) => { draggingRef.current = true; setCurrent(Number(e.target.value)); }}
        onMouseUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
        onTouchEnd={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => commitSeek(Number((e.target as HTMLInputElement).value))}
        className="flex-1 min-w-0 accent-brand-500 cursor-pointer disabled:opacity-40"
        aria-label="탐색"
      />
      <span className="text-[11px] tabular-nums text-warm-400 dark:text-warm-600 w-9 flex-shrink-0">
        {fmt(duration)}
      </span>

      {/* Personal volume */}
      <div className="flex-shrink-0">
        <VolumeControl playerRef={playerRef} />
      </div>

      {/* Fullscreen */}
      <button
        onClick={fullscreen}
        title="전체화면"
        className="p-1.5 rounded-lg text-warm-500 dark:text-warm-400 hover:text-brand-500 transition-colors flex-shrink-0"
      >
        <FullscreenIcon />
      </button>
    </div>
  );
}

/* ── Icons ────────────────────────────────────────────────────── */

function PlayIcon() {
  return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>;
}
function PauseIcon() {
  return <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>;
}
function FullscreenIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M20.25 3.75v4.5m0-4.5h-4.5m4.5 0L15 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 20.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
    </svg>
  );
}
