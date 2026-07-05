/* ================================================================
 * useYouTubePlayer — React hook wrapping the YouTube Iframe API
 *
 * Responsibilities:
 *  1. Load the YT Iframe API script once (idempotent)
 *  2. Create / destroy the YT.Player bound to a container element
 *     – Host   : controls: 1  (full seek/volume bar)   ← issue #9
 *     – Viewer : controls: 0, disablekb: 1 (no scrubbing)
 *  3. Host path : broadcast play/pause/seek + 3s heartbeat
 *  4. Viewer path: apply state-change / heartbeat with drift correction
 *  5. Late-joiner: answer sync:request-time (host) / apply sync:force
 * ================================================================ */

import { useEffect, useRef, useCallback } from 'react';
import { socket } from '../lib/socket';
import { useRoomStore } from '../stores/useRoomStore';
import { PlayerState } from '../types';
import { getSavedVolume, getSavedMuted } from '../lib/volume';

const HEARTBEAT_INTERVAL = 1_500; // authoritative snapshot every 1.5s
const SYNC_THRESHOLD = 0.75;      // max acceptable drift in seconds
const SYNC_GUARD_MS = 700;        // ignore echo events for this long

/** Load the YouTube Iframe API script (idempotent) */
function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }

    const existing = document.querySelector('script[src*="youtube.com/iframe_api"]');
    if (existing) {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();

    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  });
}

interface ForcePayload {
  videoId: string;
  currentTime: number;
  state: number;
}

export function useYouTubePlayer(containerId: string) {
  const playerRef = useRef<YT.Player | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false); // guard: prevents echo loops
  const isReadyRef = useRef(false);
  /** A force-sync that arrived before the player was ready */
  const pendingForceRef = useRef<ForcePayload | null>(null);

  const {
    videoId,
    videoState,
    currentTime: hostTime,
    isHost: isHostFn,
  } = useRoomStore();

  const isHost = isHostFn();

  /* ── Guard helper ─────────────────────────────────────────────── */
  const guardSync = useCallback((fn: () => void) => {
    isSyncingRef.current = true;
    try {
      fn();
    } finally {
      window.setTimeout(() => {
        isSyncingRef.current = false;
      }, SYNC_GUARD_MS);
    }
  }, []);

  /** Jump the local player to an authoritative snapshot. */
  const applyForce = useCallback(
    (f: ForcePayload) => {
      const player = playerRef.current;
      if (!player || !isReadyRef.current) {
        pendingForceRef.current = f;
        return;
      }
      guardSync(() => {
        if (f.state === PlayerState.PLAYING) {
          // loadVideoById loads AND autoplays from the given second
          player.loadVideoById(f.videoId, Math.max(0, f.currentTime));
        } else {
          player.cueVideoById(f.videoId, Math.max(0, f.currentTime));
        }
      });
    },
    [guardSync],
  );

  // ── 1. Create / Destroy Player ────────────────────────────────

  useEffect(() => {
    let destroyed = false;

    async function init() {
      await loadYouTubeAPI();
      if (destroyed) return;

      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
      }

      playerRef.current = new YT.Player(containerId, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0,   // ← issue #9: host gets the full bar
          disablekb: isHost ? 0 : 1,  // viewers can't scrub with the keyboard
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          fs: 1,
        },
        events: {
          onReady: () => {
            isReadyRef.current = true;
            // Apply THIS person's saved volume (personal, not synced)
            try {
              playerRef.current?.setVolume(getSavedVolume());
              if (getSavedMuted()) playerRef.current?.mute();
            } catch { /* ignore */ }
            // Cue the current video AT the host's known position so a late
            // viewer starts synced instead of flashing at 0:00.
            const st = useRoomStore.getState();
            if (st.videoId) {
              const startAt = st.isHost() ? 0 : Math.max(0, st.currentTime);
              guardSync(() => {
                if (!st.isHost() && st.videoState === PlayerState.PLAYING) {
                  playerRef.current?.loadVideoById(st.videoId, startAt); // loads + plays
                } else {
                  playerRef.current?.cueVideoById(st.videoId, startAt);
                }
              });
            }
            // Apply any force-sync that raced ahead of readiness
            if (pendingForceRef.current) {
              const f = pendingForceRef.current;
              pendingForceRef.current = null;
              applyForce(f);
            }
          },
          onStateChange: handleStateChange,
        },
      });
    }

    init();

    return () => {
      destroyed = true;
      stopHeartbeat();
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch { /* ignore */ }
        playerRef.current = null;
      }
      isReadyRef.current = false;
    };
    // Re-create the player when host status changes (controls differ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, isHost]);

  // ── 2. Load video when videoId changes ────────────────────────

  useEffect(() => {
    if (!playerRef.current || !isReadyRef.current || !videoId) return;
    // If the item was queued with autoplay, the store marks it PLAYING.
    const autoplay = useRoomStore.getState().videoState === PlayerState.PLAYING;
    guardSync(() => {
      if (autoplay) playerRef.current?.loadVideoById(videoId, 0); // loads + plays
      else playerRef.current?.cueVideoById(videoId, 0);           // loads paused
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  // ── 3. Host: heartbeat (currentTime every 3s while playing) ──

  useEffect(() => {
    if (!isHost) {
      stopHeartbeat();
      return;
    }

    heartbeatRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player || !isReadyRef.current) return;
      const { videoId: vId } = useRoomStore.getState();
      if (!vId) return;
      // Authoritative snapshot: time + state (volume is personal, not synced)
      socket.emit('sync:heartbeat', {
        currentTime: player.getCurrentTime(),
        state: player.getPlayerState(),
      });
    }, HEARTBEAT_INTERVAL);

    return () => stopHeartbeat();
  }, [isHost]);

  // ── 4. Viewer: apply incoming state (play / pause + drift) ───

  useEffect(() => {
    if (isHost) return;
    if (!playerRef.current || !isReadyRef.current) return;

    const player = playerRef.current;

    const drift = Math.abs(player.getCurrentTime() - hostTime);

    if (videoState === PlayerState.PLAYING) {
      if (drift > SYNC_THRESHOLD) {
        guardSync(() => player.seekTo(hostTime, true));
      }
      if (player.getPlayerState() !== PlayerState.PLAYING) {
        player.playVideo();
      }
    } else if (videoState === PlayerState.PAUSED) {
      // Match the paused position too (issue: seek didn't sync while paused)
      if (drift > SYNC_THRESHOLD) {
        guardSync(() => player.seekTo(hostTime, true));
      }
      if (player.getPlayerState() !== PlayerState.PAUSED) {
        player.pauseVideo();
      }
    }
  }, [isHost, videoState, hostTime, guardSync]);

  // ── 5. Player-level socket events (host request / force-sync) ─

  useEffect(() => {
    // Host is asked for its live position by a late joiner
    function onRequestTime({ requesterSocketId }: { requesterSocketId: string }) {
      const player = playerRef.current;
      const store = useRoomStore.getState();
      const currentTime =
        player && isReadyRef.current ? player.getCurrentTime() : store.currentTime;
      const state =
        player && isReadyRef.current ? player.getPlayerState() : store.videoState;

      socket.emit('sync:provide-time', {
        requesterSocketId,
        videoId: store.videoId,
        currentTime,
        state,
      });
    }

    // Late joiner receives an authoritative snapshot to jump to
    function onForce(payload: ForcePayload) {
      applyForce(payload);
    }

    socket.on('sync:request-time', onRequestTime);
    socket.on('sync:force', onForce);

    return () => {
      socket.off('sync:request-time', onRequestTime);
      socket.off('sync:force', onForce);
    };
  }, [applyForce]);

  // ── State change handler (host broadcasts) ────────────────────

  const handleStateChange = useCallback((event: YT.OnStateChangeEvent) => {
    if (isSyncingRef.current) return; // ignore programmatic echoes

    const store = useRoomStore.getState();
    if (!store.isHost()) return; // only the host broadcasts

    socket.emit('sync:state-change', {
      state: event.data,
      currentTime: event.target.getCurrentTime(),
      videoId: store.videoId,
    });

    // Video finished → auto-advance to the next playlist item
    if (event.data === PlayerState.ENDED) {
      socket.emit('playlist:next');
    }
  }, []);

  // ── Helpers ───────────────────────────────────────────────────

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  return { playerRef, isReady: isReadyRef };
}
