/* ================================================================
 * LobbyView — Room create / join screen
 * Uses Next.js router for navigation to /room/[roomId]
 * ================================================================ */

'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useRoomStore } from '@/stores/useRoomStore';
import GoogleAds from './GoogleAds';

const AD_CLIENT = 'ca-pub-XXXXXXXXXXXXXXXX';
const AD_SLOT_LOBBY = '1234567890';

export default function LobbyView() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'join' | 'join-password'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { createRoom, joinRoom } = useRoomStore();
  const kickedMessage = useRoomStore((s) => s.kickedMessage);
  const clearKickedMessage = useRoomStore((s) => s.clearKickedMessage);

  useEffect(() => {
    if (!kickedMessage) return;
    const t = setTimeout(() => clearKickedMessage(), 5000);
    return () => clearTimeout(t);
  }, [kickedMessage, clearKickedMessage]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return setError('닉네임을 입력해주세요.');
    setLoading(true);
    setError('');
    try {
      const { roomId } = await createRoom(nickname.trim());
      router.push(`/room/${roomId}`);
    } catch {
      setError('방 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return setError('닉네임을 입력해주세요.');
    if (!roomCode.trim()) return setError('방 코드를 입력해주세요.');
    setLoading(true);
    setError('');
    try {
      const pw = mode === 'join-password' ? password : undefined;
      const result = await joinRoom(roomCode.trim(), nickname.trim(), pw);
      if (result.success) {
        router.push(`/room/${roomCode.trim()}`);
      } else if (result.error === 'password_required') {
        setMode('join-password');
        setError('이 방은 비밀번호가 필요합니다.');
      } else {
        setError(result.error || '방에 입장할 수 없습니다.');
      }
    } catch {
      setError('방 입장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setMode('idle');
    setError('');
    setPassword('');
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl" />
      </div>

      {kickedMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-3 bg-red-500/15 border border-red-500/30 rounded-xl shadow-lg backdrop-blur-xl">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm text-red-300">{kickedMessage}</span>
            <button onClick={clearKickedMessage} className="text-red-400/60 hover:text-red-300 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-brand-400 via-brand-300 to-purple-300 bg-clip-text text-transparent">SyncPlay</span>
          </h1>
          <p className="mt-2 text-sm text-slate-400">함께 영상을 시청하세요</p>
        </div>

        <div className="glass-dark rounded-2xl p-8 glow-brand">
          <div className="mb-6">
            <label htmlFor="nickname" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">닉네임</label>
            <input id="nickname" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임을 입력하세요" maxLength={20} disabled={loading}
              className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all" />
          </div>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 animate-fade-in">{error}</div>
          )}

          {mode === 'idle' && (
            <div className="space-y-3">
              <button onClick={handleCreate} disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20 active:scale-[0.98]">
                {loading ? <Spin text="생성 중…" /> : '새 방 만들기'}
              </button>
              <div className="relative flex items-center my-4">
                <div className="flex-1 border-t border-slate-700/50" /><span className="px-3 text-xs text-slate-500">또는</span><div className="flex-1 border-t border-slate-700/50" />
              </div>
              <button onClick={() => setMode('join')} disabled={loading}
                className="w-full py-3 px-4 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/50 text-slate-300 hover:text-white font-medium rounded-xl transition-all disabled:opacity-50 active:scale-[0.98]">
                방 코드로 참여하기
              </button>
            </div>
          )}

          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-3 animate-fade-in">
              <div>
                <label htmlFor="room-code" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">방 코드</label>
                <input id="room-code" type="text" value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="방 코드를 입력하세요" maxLength={20} autoFocus disabled={loading}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all font-mono tracking-widest text-center text-lg" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20 active:scale-[0.98]">
                {loading ? <Spin text="입장 중…" /> : '참여하기'}
              </button>
              <button type="button" onClick={handleBack} disabled={loading} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">← 뒤로가기</button>
            </form>
          )}

          {mode === 'join-password' && (
            <form onSubmit={handleJoin} className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">방 코드</label>
                <div className="w-full px-4 py-3 bg-slate-800/30 border border-slate-700/30 rounded-xl text-slate-400 font-mono tracking-widest text-center text-lg">{roomCode}</div>
              </div>
              <div>
                <label htmlFor="join-pw" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">비밀번호</label>
                <input id="join-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호를 입력하세요" maxLength={30} autoFocus disabled={loading}
                  className="w-full px-4 py-3 bg-slate-800/60 border border-slate-700/50 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-center" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-brand-600/20 active:scale-[0.98]">
                {loading ? <Spin text="입장 중…" /> : '참여하기'}
              </button>
              <button type="button" onClick={handleBack} disabled={loading} className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-200 transition-colors">← 뒤로가기</button>
            </form>
          )}
        </div>

        <div className="mt-6">
          <GoogleAds adClient={AD_CLIENT} adSlot={AD_SLOT_LOBBY} className="rounded-xl overflow-hidden" />
        </div>
        <p className="text-center text-xs text-slate-600 mt-4">YouTube Iframe API 기반 실시간 동기화 플랫폼</p>
      </div>
    </div>
  );
}

function Spin({ text }: { text: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      {text}
    </span>
  );
}
