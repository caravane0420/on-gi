/* ================================================================
 * VideoPlayer — YouTube Iframe wrapper (온기)
 * ================================================================ */

import { useYouTubePlayer } from '../hooks/useYouTubePlayer';
import { useRoomStore } from '../stores/useRoomStore';
import ReactionOverlay from './ReactionOverlay';
import VolumeControl from './VolumeControl';
import HostControls from './HostControls';

const PLAYER_CONTAINER_ID = 'yt-player';

export default function VideoPlayer() {
  const { playerRef } = useYouTubePlayer(PLAYER_CONTAINER_ID);

  const videoId = useRoomStore((s) => s.videoId);
  const isHost = useRoomStore((s) => s.isHost());

  return (
    <div className="w-full flex flex-col gap-3 min-h-0">
      {/* 16:9 player — overflow-hidden removes the stray scroll line (#4) */}
      <div className="relative w-full aspect-video bg-warm-900 dark:bg-black rounded-2xl overflow-hidden border border-warm-200 dark:border-warm-800 shadow-xl shadow-warm-900/10 dark:shadow-black/40">
        {!videoId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-warm-400 dark:text-warm-500">
            <PlayCircleIcon />
            <p className="text-sm">
              {isHost ? "'재생목록'에서 영상을 추가하세요" : '방장이 영상을 선택할 때까지 대기 중…'}
            </p>
          </div>
        )}
        <div id={PLAYER_CONTAINER_ID} className="absolute inset-0" />
        {/* Floating reactions layer */}
        <ReactionOverlay />
      </div>

      {/* Host: full custom controls · Viewer: status + personal volume */}
      {isHost ? (
        <HostControls playerRef={playerRef} />
      ) : (
        <div className="flex items-center gap-2 px-1">
          <div className="w-2 h-2 rounded-full animate-pulse bg-brand-500" />
          <span className="text-xs text-warm-500 dark:text-warm-400">시청자 — 자동 동기화 중</span>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="hidden sm:inline text-[11px] text-warm-400 dark:text-warm-600">내 볼륨</span>
            <VolumeControl playerRef={playerRef} />
          </div>
        </div>
      )}
    </div>
  );
}

function PlayCircleIcon() {
  return (
    <svg className="w-16 h-16 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
    </svg>
  );
}
