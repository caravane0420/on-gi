/* ================================================================
 * useYouTubePlayer — YouTube Iframe API hook (Client-only)
 *
 * - Host: sends sync events via Pusher (state-change → API, heartbeat → client event)
 * - Viewer: receives sync events and corrects drift (0.5s threshold)
 * - Uses isSyncingRef guard to prevent infinite event loops
 * ================================================================ */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRoomStore } from '@/stores/useRoomStore';
import { PlayerState } from '@/types';

const SYNC_THRESHOLD = 0.5; // seconds
const HEARTBEAT_INTERVAL = 3000; // ms

export function useYouTubePlayer(containerId: string) {
  const playerRef = useRef<YT.Player | null>(null);
  const isSyncingRef = useRef(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  const videoId = useRoomStore((s) => s.videoId);
  const videoState = useRoomStore((s) => s.videoState);
  const currentTime = useRoomStore((s) => s.currentTime);
  const isHost = useRoomStore((s) => s.isHost());
  const sendSyncEvent = useRoomStore((s) => s.sendSyncEvent);
  const sendHeartbeat = useRoomStore((s) => s.sendHeartbeat);
  const sendBuffering = useRoomStore((s) => s.sendBuffering);
  const sendBufferingEnd = useRoomStore((s) => s.sendBufferingEnd);

  /* ── Load YouTube Iframe API ──────────────────────────────────── */

  const loadYouTubeAPI = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return;

      if (window.YT?.Player) {
        resolve();
        return;
      }

      const existing = document.querySelector(
        'script[src="https://www.youtube.com/iframe_api"]',
      );

      if (!existing) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      window.onYouTubeIframeAPIReady = () => resolve();
    });
  }, []);

  /* ── Host: onStateChange handler ──────────────────────────────── */

  const handleStateChange = useCallback(
    (event: YT.OnStateChangeEvent) => {
      if (!isHost || isSyncingRef.current) return;

      const player = event.target;
      const state = event.data;
      const time = player.getCurrentTime();
      const vid =
        videoId || (playerRef.current as any)?.getVideoData?.()?.video_id || '';

      switch (state) {
        case PlayerState.PLAYING:
          sendSyncEvent(PlayerState.PLAYING, time, vid);
          sendBufferingEnd(time);
          break;
        case PlayerState.PAUSED:
          sendSyncEvent(PlayerState.PAUSED, time, vid);
          break;
        case PlayerState.BUFFERING:
          sendBuffering();
          break;
      }
    },
    [isHost, videoId, sendSyncEvent, sendBuffering, sendBufferingEnd],
  );

  /* ── Initialize Player ────────────────────────────────────────── */

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;

    async function init() {
      await loadYouTubeAPI();
      if (!mounted) return;

      const container = document.getElementById(containerId);
      if (!container) return;

      if (playerRef.current) {
        playerRef.current.destroy();
      }

      playerRef.current = new YT.Player(containerId, {
        width: '100%',
        height: '100%',
        videoId: videoId || undefined,
        playerVars: {
          autoplay: 0,
          controls: isHost ? 1 : 0,
          disablekb: isHost ? 0 : 1,
          modestbranding: 1,
          rel: 0,
          fs: 1,
        },
        events: {
          onStateChange: handleStateChange,
        },
      });
    }

    init();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, loadYouTubeAPI]);

  /* ── Rebind onStateChange when isHost changes ──────────────────── */

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const internal = player as any;
    if (internal.removeEventListener) {
      internal.removeEventListener('onStateChange', handleStateChange);
      internal.addEventListener('onStateChange', handleStateChange);
    }
  }, [handleStateChange]);

  /* ── Load video when videoId changes ──────────────────────────── */

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoId) return;

    try {
      const currentVid = (player as any)?.getVideoData?.()?.video_id;
      if (currentVid !== videoId) {
        isSyncingRef.current = true;
        player.loadVideoById(videoId, 0);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 1000);
      }
    } catch {
      /* player not ready yet */
    }
  }, [videoId]);

  /* ── Viewer: sync state from store ────────────────────────────── */

  useEffect(() => {
    if (isHost) return;
    const player = playerRef.current;
    if (!player) return;

    try {
      const playerState = player.getPlayerState();

      // Sync play/pause
      if (videoState === PlayerState.PLAYING && playerState !== PlayerState.PLAYING) {
        isSyncingRef.current = true;
        player.playVideo();
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      } else if (videoState === PlayerState.PAUSED && playerState !== PlayerState.PAUSED) {
        isSyncingRef.current = true;
        player.pauseVideo();
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    } catch {
      /* player not ready */
    }
  }, [isHost, videoState]);

  /* ── Viewer: drift correction on heartbeat ─────────────────────── */

  useEffect(() => {
    if (isHost) return;
    const player = playerRef.current;
    if (!player || !currentTime) return;

    try {
      const localTime = player.getCurrentTime();
      const drift = Math.abs(localTime - currentTime);

      if (drift > SYNC_THRESHOLD) {
        isSyncingRef.current = true;
        player.seekTo(currentTime, true);
        setTimeout(() => {
          isSyncingRef.current = false;
        }, 500);
      }
    } catch {
      /* player not ready */
    }
  }, [isHost, currentTime]);

  /* ── Host: heartbeat timer (every 3s) ──────────────────────────── */

  useEffect(() => {
    if (!isHost) {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
      return;
    }

    heartbeatRef.current = setInterval(() => {
      const player = playerRef.current;
      if (!player) return;

      try {
        const time = player.getCurrentTime();
        if (time > 0) sendHeartbeat(time);
      } catch {
        /* player not ready */
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isHost, sendHeartbeat]);

  /* ── Cleanup ──────────────────────────────────────────────────── */

  useEffect(() => {
    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          /* ignore */
        }
        playerRef.current = null;
      }
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
    };
  }, []);
}
