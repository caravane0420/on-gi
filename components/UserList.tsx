/* ================================================================
 * UserList — Participant list with host badge & kick button
 * ================================================================ */

'use client';

import { useRoomStore } from '@/stores/useRoomStore';

export default function UserList() {
  const users = useRoomStore((s) => s.users);
  const hostId = useRoomStore((s) => s.hostId);
  const userId = useRoomStore((s) => s.userId);
  const kickUser = useRoomStore((s) => s.kickUser);
  const amIHost = useRoomStore((s) => s.isHost());

  function handleKick(targetId: string, nickname: string) {
    if (window.confirm(`"${nickname}" 님을 퇴장시키겠습니까?`)) {
      kickUser(targetId);
    }
  }

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-300">참여자</h3>
        <span className="ml-auto text-xs px-2 py-0.5 bg-slate-800/60 rounded-full text-slate-400 font-mono">
          {users.length}
        </span>
      </div>
      <div className="space-y-1">
        {users.map((user) => {
          const isMe = user.id === userId;
          const isHost = user.id === hostId;
          const canKick = amIHost && !isMe && !isHost;
          return (
            <div
              key={user.id}
              className={`group flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                isMe ? 'bg-brand-600/10 border border-brand-500/20' : 'hover:bg-slate-800/40'
              }`}
            >
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isHost ? 'bg-amber-400 shadow-sm shadow-amber-400/50' : 'bg-emerald-400'
              }`} />
              <span className={`text-sm truncate flex-1 ${isMe ? 'text-brand-300 font-medium' : 'text-slate-300'}`}>
                {user.nickname}
              </span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isHost && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded font-semibold uppercase tracking-wider">
                    방장
                  </span>
                )}
                {isMe && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-brand-500/15 text-brand-400 rounded font-medium">나</span>
                )}
                {canKick && (
                  <button
                    onClick={() => handleKick(user.id, user.nickname)}
                    title={`${user.nickname} 님 퇴장`}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M22 10.5h-6m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
