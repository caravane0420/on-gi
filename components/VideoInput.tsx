/* ================================================================
 * VideoInput — YouTube URL input (Host-only)
 * ================================================================ */

'use client';

import { useState, type FormEvent } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';
import { extractVideoId } from '@/types';

export default function VideoInput() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const changeVideo = useRoomStore((s) => s.changeVideo);
  const isHost = useRoomStore((s) => s.isHost());

  if (!isHost) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('올바른 YouTube URL 또는 영상 ID를 입력하세요.');
      return;
    }
    changeVideo(videoId);
    setUrl('');
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError(''); }}
            placeholder="YouTube URL 또는 영상 ID를 입력하세요"
            className="w-full px-4 py-2.5 bg-slate-800/50 border border-slate-700/40 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40 transition-all pr-10"
          />
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-5.252a4.5 4.5 0 00-6.364 0l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-xl transition-all shadow-md shadow-brand-600/20 active:scale-95 flex-shrink-0"
        >
          변경
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-400 animate-fade-in">{error}</p>}
    </form>
  );
}
