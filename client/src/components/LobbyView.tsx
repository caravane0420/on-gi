/* ================================================================
 * LobbyView — Room create / join screen (온기)
 *
 * • Deep-link: ?room=CODE auto-fills the code & opens join mode (#8)
 * • Warm amber / warm-gray theme with light+dark support (#6)
 * • Password-gated join, kicked notification, Google Ads
 * ================================================================ */

import { useState, useEffect, type FormEvent } from 'react';
import { useSocketStore } from '../stores/useSocketStore';
import { useRoomStore } from '../stores/useRoomStore';
import { getRoomFromUrl, stripRoomFromUrl } from '../lib/session';
import { socket } from '../lib/socket';
import GoogleAds from './GoogleAds';
import ThemeToggle from './ThemeToggle';

const AD_SLOT_LOBBY = '1234567890'; // Replace with your AdSense slot ID

export default function LobbyView() {
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'idle' | 'join' | 'join-password'>('idle');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { connect } = useSocketStore();
  const { createRoom, joinRoom, bindSocketEvents } = useRoomStore();
  const kickedMessage = useRoomStore((s) => s.kickedMessage);
  const clearKickedMessage = useRoomStore((s) => s.clearKickedMessage);

  // ── Deep-link: prefill room code from ?room= and open join mode ──
  useEffect(() => {
    const deepRoom = getRoomFromUrl();
    if (deepRoom) {
      setRoomCode(deepRoom);
      setMode('join');
      stripRoomFromUrl();
    }
  }, []);

  // Auto-dismiss kicked notification after 5 seconds
  useEffect(() => {
    if (!kickedMessage) return;
    const t = setTimeout(() => clearKickedMessage(), 5000);
    return () => clearTimeout(t);
  }, [kickedMessage, clearKickedMessage]);

  async function ensureConnected() {
    connect();
    await waitForConnection(socket);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!nickname.trim()) return setError('닉네임을 입력해주세요.');

    setLoading(true);
    setError('');
    try {
      await ensureConnected();
      await createRoom(nickname.trim());
      bindSocketEvents();
    } catch (err) {
      setError('방 생성에 실패했습니다. 다시 시도해주세요.');
      console.error(err);
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
      await ensureConnected();
      const pw = mode === 'join-password' ? password : undefined;
      const result = await joinRoom(roomCode.trim(), nickname.trim(), pw);

      if (result.success) {
        bindSocketEvents();
      } else if (result.error === 'password_required') {
        setMode('join-password');
        setError('이 방은 비밀번호가 필요합니다.');
      } else {
        setError(result.error || '방에 입장할 수 없습니다.');
      }
    } catch (err) {
      setError('방 입장에 실패했습니다. 다시 시도해주세요.');
      console.error(err);
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
      {/* Theme toggle — top right */}
      <div className="fixed top-4 right-4 z-40">
        <ThemeToggle />
      </div>

      {/* Warm background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-400/20 dark:bg-brand-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-brand-300/20 dark:bg-brand-600/10 rounded-full blur-3xl" />
      </div>

      {/* Kicked notification */}
      {kickedMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-3 bg-red-500/15 border border-red-500/30 rounded-xl shadow-lg backdrop-blur-xl">
            <WarningIcon />
            <span className="text-sm text-red-500 dark:text-red-300">{kickedMessage}</span>
            <button onClick={clearKickedMessage} className="text-red-400 hover:text-red-500 transition-colors">
              <CloseIcon />
            </button>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2">
            <WarmthMark />
            <h1 className="text-4xl font-extrabold tracking-tight text-warm-900 dark:text-warm-50">
              온기
            </h1>
          </div>
          <p className="mt-2 text-sm text-warm-500 dark:text-warm-400">
            함께 보는 따뜻한 시간
          </p>
        </div>

        {/* Card */}
        <div className="surface-raised rounded-2xl p-8 glow-brand">
          {/* Nickname */}
          <div className="mb-6">
            <label htmlFor="nickname" className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임을 입력하세요"
              maxLength={20}
              className={inputCls}
              disabled={loading}
            />
          </div>

          {error && (
            <div className="mb-4 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-500 dark:text-red-400 animate-fade-in">
              {error}
            </div>
          )}

          {/* Mode: idle */}
          {mode === 'idle' && (
            <div className="space-y-3">
              <button onClick={handleCreate} disabled={loading} className={primaryBtn}>
                {loading ? <LoadingText text="생성 중…" /> : '새 방 만들기'}
              </button>
              <Divider />
              <button onClick={() => setMode('join')} disabled={loading} className={secondaryBtn}>
                방 코드로 참여하기
              </button>
            </div>
          )}

          {/* Mode: join */}
          {mode === 'join' && (
            <form onSubmit={handleJoin} className="space-y-3 animate-fade-in">
              <div>
                <label htmlFor="room-code" className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
                  방 코드
                </label>
                <input
                  id="room-code"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  placeholder="방 코드를 입력하세요"
                  maxLength={20}
                  className={`${inputCls} font-mono tracking-widest text-center text-lg`}
                  autoFocus
                  disabled={loading}
                />
              </div>
              <JoinButton loading={loading} />
              <BackButton onClick={handleBack} disabled={loading} />
            </form>
          )}

          {/* Mode: join-password */}
          {mode === 'join-password' && (
            <form onSubmit={handleJoin} className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
                  방 코드
                </label>
                <div className="w-full px-4 py-3 bg-warm-100 dark:bg-warm-850 border border-warm-200 dark:border-warm-800 rounded-xl text-warm-500 dark:text-warm-400 font-mono tracking-widest text-center text-lg">
                  {roomCode}
                </div>
              </div>
              <div>
                <label htmlFor="join-password" className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
                  비밀번호
                </label>
                <input
                  id="join-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  maxLength={30}
                  className={`${inputCls} text-center`}
                  autoFocus
                  disabled={loading}
                />
              </div>
              <JoinButton loading={loading} />
              <BackButton onClick={handleBack} disabled={loading} />
            </form>
          )}
        </div>

        {/* Google Ads */}
        <div className="mt-6">
          <GoogleAds adSlot={AD_SLOT_LOBBY} className="rounded-xl overflow-hidden" />
        </div>

        <p className="text-center text-xs text-warm-400 dark:text-warm-600 mt-4">
          YouTube 실시간 동기화 · 온기와 함께
        </p>
      </div>
    </div>
  );
}

/* ── Shared class strings ─────────────────────────────────────── */

const inputCls =
  'w-full px-4 py-3 bg-warm-50 dark:bg-warm-850 border border-warm-200 dark:border-warm-800 rounded-xl text-warm-900 dark:text-warm-100 placeholder-warm-400 dark:placeholder-warm-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50 transition-all';

const primaryBtn =
  'w-full py-3 px-4 bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-warm-950 font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-brand-500/25 active:scale-[0.98]';

const secondaryBtn =
  'w-full py-3 px-4 bg-warm-100 dark:bg-warm-850 hover:bg-warm-200 dark:hover:bg-warm-800 border border-warm-200 dark:border-warm-800 text-warm-700 dark:text-warm-200 font-medium rounded-xl transition-all duration-200 disabled:opacity-50 active:scale-[0.98]';

/* ── Sub-components ───────────────────────────────────────────── */

function WarmthMark() {
  return (
    <svg className="w-8 h-8 text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.5 2.5 3.5 4.5 3.5 6.5A3.5 3.5 0 0112 13a3.5 3.5 0 01-3.5-3.5C8.5 7.5 9.5 5.5 12 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 13.5c0 3.6 2.7 6.5 6 6.5s6-2.9 6-6.5" opacity="0.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LoadingText({ text }: { text: string }) {
  return (
    <span className="flex items-center justify-center gap-2">
      <Spinner /> {text}
    </span>
  );
}

function Divider() {
  return (
    <div className="relative flex items-center my-4">
      <div className="flex-1 border-t border-warm-200 dark:border-warm-800" />
      <span className="px-3 text-xs text-warm-400 dark:text-warm-600">또는</span>
      <div className="flex-1 border-t border-warm-200 dark:border-warm-800" />
    </div>
  );
}

function JoinButton({ loading }: { loading: boolean }) {
  return (
    <button type="submit" disabled={loading} className={primaryBtn}>
      {loading ? <LoadingText text="입장 중…" /> : '참여하기'}
    </button>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-2.5 text-sm text-warm-500 dark:text-warm-400 hover:text-warm-700 dark:hover:text-warm-200 transition-colors"
    >
      ← 뒤로가기
    </button>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

/* ── Utility ──────────────────────────────────────────────────── */

function waitForConnection(sock: {
  connected: boolean;
  once: (event: string, cb: () => void) => void;
}): Promise<void> {
  return new Promise((resolve, reject) => {
    if (sock.connected) return resolve();
    const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10_000);
    sock.once('connect', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}
