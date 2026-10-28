import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

/** Imperative API of a LecturePlayer. Times are float seconds (docs/CONTRACTS.md §1.3). */
export interface PlayerHandle {
  /** Jump to `seconds` and start playing if paused. */
  seekTo(seconds: number): void;
  pause(): void;
  getCurrentTime(): number;
}

export interface PlayerContextValue extends PlayerHandle {
  /** Latest playback position, updated ~4×/s while playing. */
  currentTime: number;
  /** True once a LecturePlayer inside this provider has mounted. */
  hasPlayer: boolean;
  /** @internal used by LecturePlayer to attach itself. */
  register(handle: PlayerHandle | null): void;
  /** @internal used by LecturePlayer to publish its time. */
  reportTime(seconds: number): void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/**
 * Wrap a lecture page in this so any descendant (transcript row, citation card, summary evidence)
 * can call usePlayer().seekTo(…) without prop drilling. A seekTo issued before the player mounts
 * is applied as soon as it registers.
 */
export function PlayerProvider({ children }: { children: ReactNode }) {
  const handleRef = useRef<PlayerHandle | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasPlayer, setHasPlayer] = useState(false);

  const register = useCallback((handle: PlayerHandle | null) => {
    handleRef.current = handle;
    setHasPlayer(handle !== null);
    if (handle && pendingSeek.current !== null) {
      handle.seekTo(pendingSeek.current);
      pendingSeek.current = null;
    }
  }, []);

  const seekTo = useCallback((seconds: number) => {
    if (handleRef.current) handleRef.current.seekTo(seconds);
    else pendingSeek.current = seconds;
  }, []);
  const pause = useCallback(() => handleRef.current?.pause(), []);
  const getCurrentTime = useCallback(() => handleRef.current?.getCurrentTime() ?? 0, []);

  const value = useMemo<PlayerContextValue>(
    () => ({ seekTo, pause, getCurrentTime, currentTime, hasPlayer, register, reportTime: setCurrentTime }),
    [seekTo, pause, getCurrentTime, currentTime, hasPlayer, register],
  );
  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

/** Player controls for descendants of <PlayerProvider>. Throws outside one. */
export function usePlayer(): PlayerContextValue {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used inside <PlayerProvider>');
  return ctx;
}

/** Like usePlayer, but returns null outside a provider (e.g. a citation card on the Ask page). */
export function useOptionalPlayer(): PlayerContextValue | null {
  return useContext(PlayerContext);
}
