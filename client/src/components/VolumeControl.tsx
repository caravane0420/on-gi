/* ================================================================
 * VolumeControl — personal volume (each person, independent)
 *
 * Viewers have no native YouTube controls (controls:0), so this is
 * their volume control. It only affects the LOCAL player and is
 * saved per-browser — it is NOT synced to anyone else.
 * ================================================================ */

import { useState, type MutableRefObject } from 'react';
import {
  getSavedVolume,
  setSavedVolume,
  getSavedMuted,
  setSavedMuted,
} from '../lib/volume';

export default function VolumeControl({
  playerRef,
}: {
  playerRef: MutableRefObject<YT.Player | null>;
}) {
  const [volume, setVolume] = useState<number>(() => getSavedVolume());
  const [muted, setMuted] = useState<boolean>(() => getSavedMuted());

  function apply(v: number) {
    setVolume(v);
    setSavedVolume(v);
    try {
      playerRef.current?.setVolume(v);
      if (v > 0 && muted) {
        playerRef.current?.unMute();
        setMuted(false);
        setSavedMuted(false);
      }
    } catch { /* ignore */ }
  }

  function toggleMute() {
    const next = !muted;
    setMuted(next);
    setSavedMuted(next);
    try {
      if (next) {
        playerRef.current?.mute();
      } else {
        playerRef.current?.unMute();
        if (volume === 0) apply(30);
      }
    } catch { /* ignore */ }
  }

  const shown = muted ? 0 : volume;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleMute}
        title={muted ? '음소거 해제' : '음소거'}
        className="text-warm-500 dark:text-warm-400 hover:text-brand-500 transition-colors"
      >
        {shown === 0 ? <MuteIcon /> : <VolIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={100}
        value={shown}
        onChange={(e) => apply(Number(e.target.value))}
        title={`볼륨 ${shown}%`}
        className="w-24 accent-brand-500 cursor-pointer"
        aria-label="내 볼륨"
      />
    </div>
  );
}

function VolIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
  );
}
