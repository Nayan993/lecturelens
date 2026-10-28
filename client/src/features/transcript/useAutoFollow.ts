import { useCallback, useEffect, useRef, useState } from 'react';

/** How long a manual scroll pauses auto-follow. */
export const MANUAL_SCROLL_SUPPRESS_MS = 5000;
/** Safety net: stop treating scroll events as ours if a programmatic scroll never reports arrival. */
const PROGRAMMATIC_SCROLL_MAX_MS = 2000;
/** Jumps longer than this many viewport heights happen instantly instead of animating for seconds. */
const SMOOTH_MAX_VIEWPORTS = 1.5;
/** After a programmatic scroll arrives, trailing scroll events within this window are still ours. */
const ARRIVAL_GRACE_MS = 250;
const SCROLL_KEYS = new Set(['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ']);

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export interface ScrollOptions {
  /** Ignore manual-scroll suppression (explicit user request, e.g. clicking a topic chip). */
  force?: boolean;
  /** Where to put the target: near the top, or a third of the way down (default). */
  align?: 'start' | 'reading';
}

/**
 * Keeps a scroll container following playback without fighting the reader: any manual scroll
 * (wheel, touch, scrollbar drag, keyboard) pauses following for 5 s, and each new manual scroll
 * restarts that window. Our own scrolls are told apart by tracking their target: scroll events
 * count as ours until the container arrives there (or `scrollend` fires), however long it takes.
 *
 * Attach `containerRef` (a callback ref) to the scroll container. A callback ref matters: the
 * container usually mounts after this hook (once data has loaded), and listeners must attach then.
 */
export function useAutoFollow() {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  containerRef.current = container;
  const lastManualAt = useRef(Number.NEGATIVE_INFINITY);
  /** In-flight programmatic scroll: where it is heading and when we stop trusting it. */
  const programmatic = useRef<{ top: number; until: number } | null>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [suppressed, setSuppressed] = useState(false);

  /** Record a manual scroll / navigation by the reader. */
  const markManual = useCallback(() => {
    lastManualAt.current = Date.now();
    setSuppressed(true);
    clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setSuppressed(false), MANUAL_SCROLL_SUPPRESS_MS);
  }, []);

  useEffect(() => {
    const el = container;
    if (!el) return;
    const onScroll = () => {
      const p = programmatic.current;
      if (p && Date.now() < p.until) {
        const maxTop = el.scrollHeight - el.clientHeight;
        // Arrived: smooth scrolling still emits a trailing sub-pixel event or two, so keep a short
        // grace period rather than clearing now (scrollend clears it where supported).
        if (Math.abs(el.scrollTop - Math.min(p.top, maxTop)) <= 2) p.until = Math.min(p.until, Date.now() + ARRIVAL_GRACE_MS);
        return;
      }
      programmatic.current = null;
      markManual();
    };
    const onScrollEnd = () => {
      programmatic.current = null;
    };
    // A pointerdown on the container itself (not a child) is the scrollbar being grabbed.
    const onPointerDown = (e: PointerEvent) => {
      if (e.target === el) markManual();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.has(e.key) && e.target === el) markManual();
    };
    el.addEventListener('wheel', markManual, { passive: true });
    el.addEventListener('touchmove', markManual, { passive: true });
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('scrollend', onScrollEnd);
    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('keydown', onKeyDown);
    return () => {
      el.removeEventListener('wheel', markManual);
      el.removeEventListener('touchmove', markManual);
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('scrollend', onScrollEnd);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('keydown', onKeyDown);
    };
  }, [container, markManual]);

  useEffect(() => () => clearTimeout(resumeTimer.current), []);

  const isSuppressed = useCallback(() => Date.now() - lastManualAt.current < MANUAL_SCROLL_SUPPRESS_MS, []);

  /**
   * Scroll `target` into view inside the container. Unforced calls do nothing while the reader has
   * scrolled in the last 5 s, or when the target is already comfortably visible.
   * Returns true when it scrolled.
   */
  const scrollToElement = useCallback(
    (target: HTMLElement, { force = false, align = 'reading' }: ScrollOptions = {}) => {
      const el = containerRef.current;
      if (!el) return false;
      if (!force && isSuppressed()) return false;
      if (force) {
        lastManualAt.current = Number.NEGATIVE_INFINITY;
        clearTimeout(resumeTimer.current);
        setSuppressed(false);
      }
      const top = target.offsetTop;
      const bottom = top + target.offsetHeight;
      const visible = top >= el.scrollTop + 8 && bottom <= el.scrollTop + el.clientHeight - 8;
      if (visible && !force) return false;
      const next = Math.max(0, align === 'start' ? top - 8 : top - el.clientHeight / 3);
      const far = Math.abs(next - el.scrollTop) > el.clientHeight * SMOOTH_MAX_VIEWPORTS;
      programmatic.current = { top: next, until: Date.now() + PROGRAMMATIC_SCROLL_MAX_MS };
      if (typeof el.scrollTo === 'function') el.scrollTo({ top: next, behavior: far || prefersReducedMotion() ? 'auto' : 'smooth' });
      else el.scrollTop = next;
      return true;
    },
    [isSuppressed],
  );

  return { containerRef: setContainer, scrollToElement, markManual, isSuppressed, suppressed };
}
