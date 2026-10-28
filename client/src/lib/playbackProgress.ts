import type { Id } from '../types';

/**
 * Per-user, per-device "where did I stop" store for Continue / Resume. A viewer convenience only:
 * it lives in localStorage, never reaches the server, and is keyed by user so a shared device
 * doesn't mix people up. There is no playback-progress endpoint in the contract.
 */
export interface PlaybackEntry {
  lectureId: Id;
  /** Float seconds. */
  position: number;
  /** Float seconds; 0 if unknown. */
  duration: number;
  updatedAt: string;
}

const keyFor = (userId: Id) => `ll.progress.${userId}`;

function readAll(userId: Id): Record<Id, PlaybackEntry> {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Record<Id, PlaybackEntry>) : {};
  } catch {
    return {};
  }
}

export function savePlayback(userId: Id, lectureId: Id, position: number, duration: number): void {
  try {
    const all = readAll(userId);
    all[lectureId] = {
      lectureId,
      position: Math.round(position * 1000) / 1000,
      duration: Math.round(duration * 1000) / 1000,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(keyFor(userId), JSON.stringify(all));
  } catch {
    // storage unavailable: resume simply isn't remembered
  }
}

/** Most recently watched lecture, optionally limited to ids that still exist / are visible. */
export function lastWatched(userId: Id, visibleIds?: ReadonlySet<Id>): PlaybackEntry | null {
  const entries = Object.values(readAll(userId)).filter((e) => !visibleIds || visibleIds.has(e.lectureId));
  entries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return entries[0] ?? null;
}
