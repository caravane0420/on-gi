/* ================================================================
 * ChatPanel — Real-time chat with auto-scroll
 * Uses Pusher Client Events (no API call per message)
 * ================================================================ */

'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const chatMessages = useRoomStore((s) => s.chatMessages);
  const sendChatMessage = useRoomStore((s) => s.sendChatMessage);
  const userId = useRoomStore((s) => s.userId);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [chatMessages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
        <svg className="w-4 h-4 text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <h3 className="text-sm font-semibold text-slate-300">채팅</h3>
        <span className="ml-auto text-xs text-slate-600">{chatMessages.length}</span>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 scrollbar-thin">
        {chatMessages.length === 0 && (
          <p className="text-center text-xs text-slate-600 mt-8">메시지가 아직 없습니다</p>
        )}
        {chatMessages.map((msg, i) => {
          const isMe = msg.userId === userId;
          return (
            <div key={`${msg.timestamp}-${i}`} className={`animate-fade-in ${isMe ? 'text-right' : 'text-left'}`}>
              {!isMe && (
                <span className="text-[10px] font-medium text-brand-400 block mb-0.5">{msg.nickname}</span>
              )}
              <div className={`inline-block max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words ${
                isMe ? 'bg-brand-600/80 text-white rounded-br-md' : 'bg-slate-800/80 text-slate-200 rounded-bl-md'
              }`}>
                {msg.message}
              </div>
              <div className="text-[10px] text-slate-600 mt-0.5">
                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-800/60">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요…"
            maxLength={500}
            className="flex-1 px-3 py-2 bg-slate-800/50 border border-slate-700/40 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-all text-sm font-medium active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
