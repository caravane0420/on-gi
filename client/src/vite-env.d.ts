/// <reference types="vite/client" />

/* ================================================================
 * YouTube Iframe API — Global Type Declarations
 * ================================================================ */

declare namespace YT {
  const PlayerState: {
    UNSTARTED: -1;
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: PlayerVars;
    events?: Events;
  }

  interface PlayerVars {
    autoplay?: 0 | 1;
    controls?: 0 | 1 | 2;
    modestbranding?: 0 | 1;
    rel?: 0 | 1;
    playsinline?: 0 | 1;
    origin?: string;
    enablejsapi?: 0 | 1;
    fs?: 0 | 1;
    cc_load_policy?: 0 | 1;
    /** Disable keyboard controls (viewers can't scrub with arrow keys) */
    disablekb?: 0 | 1;
    iv_load_policy?: 1 | 3;
  }

  interface Events {
    onReady?: (event: PlayerEvent) => void;
    onStateChange?: (event: OnStateChangeEvent) => void;
    onError?: (event: OnErrorEvent) => void;
    onPlaybackQualityChange?: (event: PlayerEvent) => void;
    onPlaybackRateChange?: (event: PlayerEvent) => void;
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: number;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    stopVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    loadVideoById(videoId: string, startSeconds?: number): void;
    cueVideoById(videoId: string, startSeconds?: number): void;
    getCurrentTime(): number;
    getDuration(): number;
    getPlayerState(): number;
    getVideoUrl(): string;
    getVolume(): number;
    setVolume(volume: number): void;
    mute(): void;
    unMute(): void;
    isMuted(): boolean;
    destroy(): void;
    getIframe(): HTMLIFrameElement;
  }
}

interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
