/* ================================================================
 * ReactionBar — emoji reaction buttons (everyone can use)
 * ================================================================ */

import { useRoomStore } from '../stores/useRoomStore';

const EMOJIS = ['❤️', '😂', '👏', '🔥', '😮', '😢', '👍', '🎉'];

export default function ReactionBar() {
  const sendReaction = useRoomStore((s) => s.sendReaction);

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {EMOJIS.map((e) => (
        <button
          key={e}
          onClick={() => sendReaction(e)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-lg bg-warm-100 dark:bg-warm-850 hover:bg-warm-200 dark:hover:bg-warm-800 active:scale-90 transition-transform"
          title="반응 보내기"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
