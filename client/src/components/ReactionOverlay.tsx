/* ================================================================
 * ReactionOverlay — floating emoji reactions over the video
 * ================================================================ */

import { useEffect } from 'react';
import { useRoomStore } from '../stores/useRoomStore';
import type { Reaction } from '../types';

export default function ReactionOverlay() {
  const reactions = useRoomStore((s) => s.reactions);
  const removeReaction = useRoomStore((s) => s.removeReaction);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden z-10">
      {reactions.map((r) => (
        <FloatingReaction key={r.id} reaction={r} onDone={() => removeReaction(r.id)} />
      ))}
    </div>
  );
}

function FloatingReaction({ reaction, onDone }: { reaction: Reaction; onDone: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 2400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="animate-reaction absolute bottom-3 flex flex-col items-center"
      style={{ left: `${reaction.left}%` }}
    >
      <span className="text-3xl sm:text-4xl drop-shadow-lg">{reaction.emoji}</span>
      {reaction.nickname && (
        <span className="mt-0.5 px-1.5 py-0.5 rounded-full bg-black/45 text-white text-[9px] font-medium max-w-[80px] truncate">
          {reaction.nickname}
        </span>
      )}
    </div>
  );
}
