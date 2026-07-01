/* ================================================================
 * ChatPanel — Real-time chat with auto-scroll (온기)
 *
 * • overflow-y-auto message list + useRef/useEffect auto-scroll (#1)
 * • Identity via persistent userId (survives refresh) so "내 메시지"
 *   stays right-aligned after a reconnect
 * ================================================================ */

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useRoomStore } from '../stores/useRoomStore';
import { getUserId } from '../lib/session';

export default function ChatPanel() {
  const [input, setInput] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  const chatMessages = useRoomStore((s) => s.chatMessages);
  const sendChatMessage = useRoomStore((s) => s.sendChatMessage);
  const myId = getUserId();

  // Auto-scroll to the bottom whenever messages change (#1)
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    sendChatMessage(input);
    setInput('');
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-warm-200 dark:border-warm-800">
        <ChatIcon />
        <h3 className="text-sm font-semibold text-warm-700 dark:text-warm-200">채팅</h3>
        <span className="ml-auto text-xs text-warm-400 dark:text-warm-600">{chatMessages.length}</span>
      </div>

      {/* Messages */}
      <div ref={listRef} className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {chatMessages.length === 0 && (
          <p className="text-center text-xs text-warm-400 dark:text-warm-600 mt-8">
            메시지가 아직 없습니다
          </p>
        )}
        {chatMessages.map((msg, i) => {
          const isMe = msg.userId === myId;
          return (
            <div key={`${msg.timestamp}-${i}`} className={`animate-fade-in ${isMe ? 'text-right' : 'text-left'}`}>
              {!isMe && (
                <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 block mb-0.5">
                  {msg.nickname}
                </span>
              )}
              <div
                className={`inline-block max-w-[85%] px-3 py-1.5 rounded-2xl text-sm break-words ${
                  isMe
                    ? 'bg-brand-500 text-warm-950 rounded-br-md'
                    : 'bg-warm-200/80 dark:bg-warm-800 text-warm-800 dark:text-warm-100 rounded-bl-md'
                }`}
              >
                {msg.message}
              </div>
              <div className="text-[10px] text-warm-400 dark:text-warm-600 mt-0.5">
                {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-warm-200 dark:border-warm-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="메시지를 입력하세요…"
            maxLength={500}
            className="flex-1 px-3 py-2 bg-white dark:bg-warm-850 border border-warm-200 dark:border-warm-800 rounded-lg text-sm text-warm-900 dark:text-warm-100 placeholder-warm-400 dark:placeholder-warm-600 focus:outline-none focus:ring-1 focus:ring-brand-500/50 transition-all"
          />
          <button
            type="submit"
            disabled={!input.trim()}
            className="px-3 py-2 bg-brand-500 hover:bg-brand-400 disabled:bg-warm-200 dark:disabled:bg-warm-800 disabled:text-warm-400 text-warm-950 rounded-lg transition-all text-sm font-medium active:scale-95"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  );
}

function ChatIcon() {
  return (
    <svg className="w-4 h-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
    </svg>
  );
}
