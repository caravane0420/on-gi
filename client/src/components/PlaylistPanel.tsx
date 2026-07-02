/* ================================================================
 * PlaylistPanel — shared playlist + request/approve flow (modal)
 *
 * • Host: URL 입력 → 플레이리스트에 바로 추가, 항목 재생/삭제, 신청 승낙/거절
 * • Viewer: URL 입력 → 신청 (방장 승낙 시 추가)
 * ================================================================ */

import { useState, type FormEvent } from 'react';
import { useRoomStore } from '../stores/useRoomStore';
import { extractVideoId } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function PlaylistPanel({ isOpen, onClose }: Props) {
  const isHost = useRoomStore((s) => s.isHost());
  const playlist = useRoomStore((s) => s.playlist);
  const currentItemId = useRoomStore((s) => s.currentItemId);
  const requests = useRoomStore((s) => s.requests);

  const addToPlaylist = useRoomStore((s) => s.addToPlaylist);
  const requestVideo = useRoomStore((s) => s.requestVideo);
  const approveRequest = useRoomStore((s) => s.approveRequest);
  const rejectRequest = useRoomStore((s) => s.rejectRequest);
  const removeFromPlaylist = useRoomStore((s) => s.removeFromPlaylist);
  const playItem = useRoomStore((s) => s.playItem);

  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setDone('');
    const videoId = extractVideoId(url);
    if (!videoId) {
      setError('올바른 YouTube URL 또는 영상 ID를 입력하세요.');
      return;
    }
    if (isHost) {
      addToPlaylist(videoId);
      setDone('플레이리스트에 추가했어요.');
    } else {
      requestVideo(videoId);
      setDone('신청했어요! 방장이 승낙하면 추가됩니다.');
    }
    setUrl('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-warm-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col surface-raised rounded-2xl p-5 animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ListIcon />
            <h2 className="text-lg font-bold text-warm-900 dark:text-warm-50">재생목록</h2>
            <span className="text-xs px-2 py-0.5 bg-warm-100 dark:bg-warm-850 rounded-full text-warm-500">
              {playlist.length}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-warm-500 hover:bg-warm-100 dark:hover:bg-warm-800 transition-colors">
            <CloseIcon />
          </button>
        </div>

        {/* Add / Request input */}
        <form onSubmit={handleSubmit} className="flex-shrink-0 mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => { setUrl(e.target.value); setError(''); setDone(''); }}
              placeholder="YouTube URL 붙여넣기"
              className="flex-1 px-3 py-2.5 bg-warm-50 dark:bg-warm-850 border border-warm-200 dark:border-warm-800 rounded-xl text-sm text-warm-900 dark:text-warm-100 placeholder-warm-400 dark:placeholder-warm-600 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-warm-950 text-sm font-bold rounded-xl transition-colors active:scale-95 flex-shrink-0"
            >
              {isHost ? '추가' : '신청'}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
          {done && <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400">{done}</p>}
          {!isHost && (
            <p className="mt-1.5 text-[11px] text-warm-400 dark:text-warm-600">
              시청자는 신청만 가능해요. 방장이 승낙하면 목록에 추가됩니다.
            </p>
          )}
        </form>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {/* Pending requests (host only) */}
          {isHost && requests.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400 mb-2">
                신청 대기 {requests.length}
              </h3>
              <div className="space-y-1.5">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center gap-2 p-2 rounded-lg bg-brand-500/5 border border-brand-500/20">
                    <Thumb videoId={r.videoId} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-warm-800 dark:text-warm-100 truncate">{r.title || r.videoId}</p>
                      <p className="text-[11px] text-warm-400 dark:text-warm-600 truncate">{r.byName} 님 신청</p>
                    </div>
                    <button onClick={() => approveRequest(r.id)} title="승낙" className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10">
                      <CheckIcon />
                    </button>
                    <button onClick={() => rejectRequest(r.id)} title="거절" className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10">
                      <CloseIcon />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Playlist */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-warm-500 dark:text-warm-400 mb-2">
              다음 재생목록
            </h3>
            {playlist.length === 0 ? (
              <p className="text-center text-xs text-warm-400 dark:text-warm-600 py-6">
                아직 추가된 영상이 없어요
              </p>
            ) : (
              <div className="space-y-1.5">
                {playlist.map((item) => {
                  const isCurrent = item.id === currentItemId;
                  return (
                    <div
                      key={item.id}
                      className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-brand-500/10 border border-brand-500/30'
                          : 'hover:bg-warm-100 dark:hover:bg-warm-800/60 border border-transparent'
                      }`}
                    >
                      <Thumb videoId={item.videoId} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-warm-800 dark:text-warm-100 truncate">
                          {isCurrent && <span className="text-brand-600 dark:text-brand-400 font-bold">▶ </span>}
                          {item.title || item.videoId}
                        </p>
                        <p className="text-[11px] text-warm-400 dark:text-warm-600 truncate">{item.addedByName} 님</p>
                      </div>
                      {isHost && (
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {!isCurrent && (
                            <button onClick={() => playItem(item.id)} title="지금 재생" className="p-1.5 rounded-lg text-warm-500 hover:text-brand-500 hover:bg-brand-500/10">
                              <PlayIcon />
                            </button>
                          )}
                          <button onClick={() => removeFromPlaylist(item.id)} title="삭제" className="p-1.5 rounded-lg text-warm-400 hover:text-red-500 hover:bg-red-500/10">
                            <TrashIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Thumb({ videoId }: { videoId: string }) {
  return (
    <img
      src={`https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`}
      alt=""
      loading="lazy"
      className="w-16 h-10 object-cover rounded-md flex-shrink-0 bg-warm-200 dark:bg-warm-800"
    />
  );
}

/* ── Icons ────────────────────────────────────────────────────── */

function ListIcon() {
  return (
    <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 5.25h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5m-16.5 4.5h16.5" />
    </svg>
  );
}
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}
function PlayIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
