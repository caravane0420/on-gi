/* ================================================================
 * RoomSettings — Host modal: title, private toggle, password (온기)
 * ================================================================ */

import { useState, useEffect, type FormEvent } from 'react';
import { useRoomStore } from '../stores/useRoomStore';

interface RoomSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoomSettings({ isOpen, onClose }: RoomSettingsProps) {
  const storeTitle = useRoomStore((s) => s.title);
  const storeIsPrivate = useRoomStore((s) => s.isPrivate);
  const updateSettings = useRoomStore((s) => s.updateSettings);

  const [title, setTitle] = useState(storeTitle);
  const [isPrivate, setIsPrivate] = useState(storeIsPrivate);
  const [password, setPassword] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle(storeTitle);
      setIsPrivate(storeIsPrivate);
      setPassword('');
      setSaved(false);
    }
  }, [isOpen, storeTitle, storeIsPrivate]);

  if (!isOpen) return null;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    updateSettings({ title: title.trim(), isPrivate, password: isPrivate ? password : '' });
    setSaved(true);
    setTimeout(() => onClose(), 800);
  }

  const inputCls =
    'w-full px-4 py-2.5 bg-warm-50 dark:bg-warm-850 border border-warm-200 dark:border-warm-800 rounded-xl text-warm-900 dark:text-warm-100 placeholder-warm-400 dark:placeholder-warm-600 focus:outline-none focus:ring-2 focus:ring-brand-500/50 transition-all text-sm';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-warm-950/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      <div className="relative w-full max-w-md surface-raised rounded-2xl p-6 glow-brand animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <GearIcon />
            <h2 className="text-lg font-bold text-warm-900 dark:text-warm-50">방 설정</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-warm-500 hover:text-warm-800 dark:hover:text-warm-200 hover:bg-warm-200/60 dark:hover:bg-warm-800 transition-colors">
            <CloseIcon />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="room-title" className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
              방 제목
            </label>
            <input
              id="room-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="방 제목을 입력하세요 (선택)"
              maxLength={50}
              className={inputCls}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-warm-800 dark:text-warm-100">비밀 방</p>
              <p className="text-xs text-warm-500 dark:text-warm-500 mt-0.5">비밀번호가 있어야 입장할 수 있습니다</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isPrivate}
              onClick={() => setIsPrivate(!isPrivate)}
              className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/50 ${
                isPrivate ? 'bg-brand-500' : 'bg-warm-300 dark:bg-warm-700'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 ${isPrivate ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {isPrivate && (
            <div className="animate-fade-in">
              <label htmlFor="room-password" className="block text-xs font-semibold text-warm-500 dark:text-warm-400 mb-1.5 uppercase tracking-wider">
                비밀번호
              </label>
              <input
                id="room-password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 설정하세요"
                maxLength={30}
                className={`${inputCls} font-mono`}
              />
              <p className="text-[11px] text-warm-400 dark:text-warm-600 mt-1">비워두면 기존 비밀번호가 유지됩니다</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-warm-100 dark:bg-warm-850 hover:bg-warm-200 dark:hover:bg-warm-800 text-warm-700 dark:text-warm-200 text-sm font-medium rounded-xl transition-all">
              취소
            </button>
            <button type="submit" className="flex-1 py-2.5 bg-gradient-to-r from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-warm-950 text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand-500/25 active:scale-[0.98]">
              {saved ? '✓ 저장됨' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GearIcon() {
  return (
    <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
