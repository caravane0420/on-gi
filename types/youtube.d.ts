/* ================================================================
 * YouTube Iframe API — Global Type Declarations
 * ================================================================ */

declare namespace YT {
  enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5,
  }

  interface PlayerOptions {
    height?: string | number;
    width?: string | number;
    videoId?: string;
    playerVars?: Record<string, unknown>;
    events?: {
      onReady?: (event: PlayerEvent) => void;
      onStateChange?: (event: OnStateChangeEvent) => void;
      onError?: (event: OnErrorEvent) => void;
    };
  }

  interface PlayerEvent {
    target: Player;
  }

  interface OnStateChangeEvent {
    target: Player;
    data: PlayerState;
  }

  interface OnErrorEvent {
    target: Player;
    data: number;
  }

  class Player {
    constructor(elementId: string | HTMLElement, options: PlayerOptions);
    playVideo(): void;
    pauseVideo(): void;
    seekTo(seconds: number, allowSeekAhead?: boolean): void;
    loadVideoById(videoId: string, startSeconds?: number): void;
    getCurrentTime(): number;
    getPlayerState(): PlayerState;
    getDuration(): number;
    destroy(): void;
  }
}

interface Window {
  onYouTubeIframeAPIReady?: () => void;
  YT?: typeof YT;
}
