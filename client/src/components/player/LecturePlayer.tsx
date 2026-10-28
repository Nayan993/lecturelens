import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { Gauge, Headphones, Keyboard, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatTimestamp } from '../../lib/formatTime';
import { Button, IconButton, Menu, Tooltip } from '../ui';
import { useOptionalPlayer, type PlayerHandle } from './PlayerContext';

export interface PlayerMarker {
  /** Float seconds. */
  startSec: number;
  label: string;
}

export interface LecturePlayerProps {
  src: string;
  /** e.g. "video/mp4" or "audio/mpeg". When omitted, the file extension decides video vs audio. */
  mimeType?: string;
  /** Accessible name, usually the lecture title. */
  title: string;
  poster?: string;
  /** Small ochre ticks on the scrub bar (topic boundaries). */
  markers?: PlayerMarker[];
  /** Initial position in seconds, e.g. from a `?t=` deep link. Applied once metadata loads; does not autoplay. */
  startAt?: number | null;
  /** Called with the current time, throttled to ~4×/s, plus immediately after seeks and pauses. */
  onTimeUpdate?: (seconds: number) => void;
  className?: string;
}

export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
const EMIT_INTERVAL_MS = 250;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac|oga|ogg|opus|flac)(\?|#|$)/i;

export function isAudioSource(src: string, mimeType?: string): boolean {
  return mimeType ? mimeType.startsWith('audio/') : AUDIO_EXT.test(src);
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Play / pause'],
  ['← / →', 'Back / forward 5 s'],
  ['J / L', 'Back / forward 10 s'],
  ['M', 'Mute / unmute'],
];

/**
 * THE lecture player. Video (or audio) with a custom control bar, keyboard shortcuts while focused,
 * topic markers, an imperative handle (seekTo / pause / getCurrentTime) and automatic registration
 * with the nearest <PlayerProvider> so descendants can usePlayer().seekTo(…).
 */
export const LecturePlayer = forwardRef<PlayerHandle, LecturePlayerProps>(
  ({ src, mimeType, title, poster, markers = [], startAt, onTimeUpdate, className }, ref) => {
    const audio = isAudioSource(src, mimeType);
    const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
    const trackRef = useRef<HTMLDivElement>(null);
    const pendingSeek = useRef<number | null>(startAt ?? null);
    const lastEmit = useRef(0);
    const scrubbing = useRef(false);
    const player = useOptionalPlayer();

    const [playing, setPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(startAt ?? 0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);

    const onTimeUpdateRef = useRef(onTimeUpdate);
    onTimeUpdateRef.current = onTimeUpdate;
    const reportTimeRef = useRef(player?.reportTime);
    reportTimeRef.current = player?.reportTime;

    /** Update UI time and notify listeners, at most every 250 ms unless forced. */
    const report = useCallback((seconds: number, force = false) => {
      const now = performance.now();
      if (!force && now - lastEmit.current < EMIT_INTERVAL_MS) return;
      lastEmit.current = now;
      setCurrentTime(seconds);
      onTimeUpdateRef.current?.(seconds);
      reportTimeRef.current?.(seconds);
    }, []);

    /** Move the playhead without changing play/pause state. */
    const setTime = useCallback(
      (seconds: number) => {
        const media = mediaRef.current;
        if (!media) return;
        const max = Number.isFinite(media.duration) ? media.duration : Number.POSITIVE_INFINITY;
        const target = clamp(seconds, 0, max);
        if (media.readyState < 1) pendingSeek.current = target;
        else media.currentTime = target;
        report(target, true);
      },
      [report],
    );

    const play = useCallback(() => {
      // play() rejects if the browser blocks playback; the paused UI state stays correct.
      void mediaRef.current?.play()?.catch(() => undefined);
    }, []);

    const togglePlay = useCallback(() => {
      const media = mediaRef.current;
      if (!media) return;
      if (media.paused) play();
      else media.pause();
    }, [play]);

    const handle = useMemo<PlayerHandle>(
      () => ({
        seekTo: (seconds) => {
          setTime(seconds);
          if (mediaRef.current?.paused) play();
        },
        pause: () => mediaRef.current?.pause(),
        getCurrentTime: () => mediaRef.current?.currentTime ?? 0,
      }),
      [setTime, play],
    );
    useImperativeHandle(ref, () => handle, [handle]);

    const register = player?.register;
    useEffect(() => {
      if (!register) return;
      register(handle);
      return () => register(null);
    }, [register, handle]);

    // Media element events.
    useEffect(() => {
      const media = mediaRef.current;
      if (!media) return;
      const onLoaded = () => {
        setDuration(Number.isFinite(media.duration) ? media.duration : 0);
        if (pendingSeek.current !== null) {
          media.currentTime = clamp(pendingSeek.current, 0, media.duration || pendingSeek.current);
          pendingSeek.current = null;
        }
        report(media.currentTime, true);
      };
      const onTime = () => !scrubbing.current && report(media.currentTime);
      const onSeeked = () => report(media.currentTime, true);
      const onPlay = () => setPlaying(true);
      const onPause = () => {
        setPlaying(false);
        report(media.currentTime, true);
      };
      const onVolume = () => {
        setVolume(media.volume);
        setMuted(media.muted);
      };
      const onRate = () => setRate(media.playbackRate);
      const onDuration = () => setDuration(Number.isFinite(media.duration) ? media.duration : 0);

      media.addEventListener('loadedmetadata', onLoaded);
      media.addEventListener('durationchange', onDuration);
      media.addEventListener('timeupdate', onTime);
      media.addEventListener('seeked', onSeeked);
      media.addEventListener('play', onPlay);
      media.addEventListener('pause', onPause);
      media.addEventListener('ended', onPause);
      media.addEventListener('volumechange', onVolume);
      media.addEventListener('ratechange', onRate);
      if (media.readyState >= 1) onLoaded();
      return () => {
        media.removeEventListener('loadedmetadata', onLoaded);
        media.removeEventListener('durationchange', onDuration);
        media.removeEventListener('timeupdate', onTime);
        media.removeEventListener('seeked', onSeeked);
        media.removeEventListener('play', onPlay);
        media.removeEventListener('pause', onPause);
        media.removeEventListener('ended', onPause);
        media.removeEventListener('volumechange', onVolume);
        media.removeEventListener('ratechange', onRate);
      };
    }, [src, report]);

    const toggleMute = () => {
      const media = mediaRef.current;
      if (media) media.muted = !media.muted;
    };

    // Keyboard shortcuts, active only while focus is inside the player. Keys a focused control
    // already handles natively (Space/Enter on buttons, arrows on the volume slider) are left alone.
    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement;
      if (target.closest('[role="menu"]')) return;
      const onButton = target.tagName === 'BUTTON';
      const onRange = target instanceof HTMLInputElement && target.type === 'range';
      const now = mediaRef.current?.currentTime ?? 0;
      switch (event.key) {
        case ' ':
        case 'Spacebar':
          if (onButton) return;
          togglePlay();
          break;
        case 'ArrowLeft':
          if (onRange) return;
          setTime(now - 5);
          break;
        case 'ArrowRight':
          if (onRange) return;
          setTime(now + 5);
          break;
        case 'j':
        case 'J':
          setTime(now - 10);
          break;
        case 'l':
        case 'L':
          setTime(now + 10);
          break;
        case 'm':
        case 'M':
          toggleMute();
          break;
        default:
          return;
      }
      event.preventDefault();
    };

    // Scrub bar pointer handling.
    const timeAtPointer = (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0 || duration === 0) return 0;
      return clamp((clientX - rect.left) / rect.width, 0, 1) * duration;
    };
    const onScrubDown = (event: PointerEvent<HTMLDivElement>) => {
      if (duration === 0) return;
      scrubbing.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setTime(timeAtPointer(event.clientX));
    };
    const onScrubMove = (event: PointerEvent<HTMLDivElement>) => {
      if (scrubbing.current) setTime(timeAtPointer(event.clientX));
    };
    const onScrubUp = (event: PointerEvent<HTMLDivElement>) => {
      scrubbing.current = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    };
    const onScrubKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Home') setTime(0);
      else if (event.key === 'End') setTime(duration);
      else return;
      event.preventDefault();
    };

    const pct = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;
    const effectiveVolume = muted ? 0 : volume;

    return (
      <div
        role="region"
        aria-label={`${title} — media player`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className={cn('overflow-hidden rounded-card border border-border bg-surface shadow-sm', className)}
      >
        {audio ? (
          <div className="flex h-36 items-center justify-center gap-3 bg-brand-soft text-brand">
            <Headphones aria-hidden className="h-8 w-8" />
            <span className="max-w-[70%] truncate text-sm font-medium">{title}</span>
            <audio ref={mediaRef} src={src} preload="metadata" />
          </div>
        ) : (
          <video
            ref={mediaRef}
            src={src}
            poster={poster}
            preload="metadata"
            playsInline
            onClick={togglePlay}
            className="block aspect-video w-full cursor-pointer bg-black"
          />
        )}

        <div className="flex flex-col gap-1.5 px-3 pb-2 pt-2.5">
          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(currentTime)}
            aria-valuetext={`${formatTimestamp(currentTime)} of ${formatTimestamp(duration)}`}
            onPointerDown={onScrubDown}
            onPointerMove={onScrubMove}
            onPointerUp={onScrubUp}
            onPointerCancel={onScrubUp}
            onKeyDown={onScrubKeyDown}
            className="group relative flex h-4 cursor-pointer touch-none items-center rounded-full focus-visible:outline-offset-1"
          >
            <div className="relative h-1.5 w-full rounded-full bg-ink-1/15">
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${pct}%` }} />
              {duration > 0 &&
                markers.map((marker) => (
                  <span
                    key={`${marker.startSec}-${marker.label}`}
                    title={`${formatTimestamp(marker.startSec)} · ${marker.label}`}
                    data-testid="player-marker"
                    className="absolute -top-[3px] h-3 w-0.5 -translate-x-1/2 rounded-full bg-accent"
                    style={{ left: `${clamp((marker.startSec / duration) * 100, 0, 100)}%` }}
                  />
                ))}
            </div>
            <span
              aria-hidden
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand shadow-sm transition-transform group-hover:scale-110"
              style={{ left: `${pct}%` }}
            />
          </div>

          <div className="flex items-center gap-1">
            <IconButton
              aria-label={playing ? 'Pause' : 'Play'}
              icon={playing ? <Pause /> : <Play />}
              size="sm"
              onClick={togglePlay}
            />
            <IconButton
              aria-label={muted || volume === 0 ? 'Unmute' : 'Mute'}
              icon={muted || volume === 0 ? <VolumeX /> : <Volume2 />}
              size="sm"
              onClick={toggleMute}
            />
            <input
              type="range"
              aria-label="Volume"
              min={0}
              max={1}
              step={0.05}
              value={effectiveVolume}
              onChange={(e) => {
                const media = mediaRef.current;
                if (!media) return;
                media.volume = Number(e.target.value);
                media.muted = media.volume === 0;
              }}
              className="hidden h-1 w-20 cursor-pointer accent-brand sm:block"
            />
            <span className="ml-2 font-sans text-xs tabular-nums text-ink-2">
              <span aria-label="Current time">{formatTimestamp(currentTime)}</span>
              <span aria-hidden> / </span>
              <span aria-label="Duration">{formatTimestamp(duration)}</span>
            </span>

            <div className="ml-auto flex items-center gap-1">
              <Menu
                side="top"
                align="end"
                label="Playback speed"
                items={PLAYBACK_RATES.map((r) => ({
                  id: String(r),
                  label: `${r}×`,
                  checked: rate === r,
                  onSelect: () => {
                    if (mediaRef.current) mediaRef.current.playbackRate = r;
                  },
                }))}
                trigger={(props) => (
                  <Button {...props} variant="ghost" size="sm" leftIcon={<Gauge />} aria-label={`Playback speed, ${rate}×`}>
                    {rate}×
                  </Button>
                )}
              />
              <Tooltip
                side="top"
                className="left-auto right-0 w-56 translate-x-0 whitespace-normal p-2.5"
                content={
                  <span className="flex flex-col gap-1">
                    <span className="font-semibold">Keyboard shortcuts (player focused)</span>
                    {SHORTCUTS.map(([key, action]) => (
                      <span key={key} className="flex justify-between gap-3">
                        <kbd className="font-sans font-semibold">{key}</kbd>
                        <span>{action}</span>
                      </span>
                    ))}
                  </span>
                }
              >
                <IconButton aria-label="Keyboard shortcuts" icon={<Keyboard />} size="sm" />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    );
  },
);
LecturePlayer.displayName = 'LecturePlayer';
