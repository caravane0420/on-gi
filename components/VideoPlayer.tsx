/* ================================================================
 * VideoPlayer — YouTube Iframe wrapper
 * ================================================================ */

'use client';

import { useYouTubePlayer } from '@/hooks/useYouTubePlayer';
import { useRoomStore } from '@/stores/useRoomStore';

const PLAYER_ID = 'yt-player';

export default function VideoPlayer() {
  useYouTubePlayer(PLAYER_ID);

  const videoId = useRoomStore((s) => s.videoId);
  const isHost = useRoomStore((s) => s.isHost());

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="relative w-full aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-800/50 shadow-2xl">
        {!videoId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-500 z-10">
            <svg className="w-16 h-16 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
            </svg>
            <p className="text-sm">
              {isHost ? '아래에서 영상 URL을 입력하세요' : '방장이 영상을 선택할 때까지 대기 중…'}
            </p>
          </div>
        )}
        <div id={PLAYER_ID} className="absolute inset-0" />
      </div>
      <div className="flex items-center gap-2 px-1">
        <div className={`w-2 h-2 rounded-full ${isHost ? 'bg-emerald-400' : 'bg-brand-400'} animate-pulse`} />
        <span className="text-xs text-slate-500">
          {isHost ? '방장 — 컨트롤 활성화' : '시청자 — 자동 동기화 중'}
        </span>
      </div>
    </div>
  );
}
