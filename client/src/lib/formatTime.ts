/**
 * THE single place media times are formatted or parsed in the client.
 * The API always sends float seconds (startSec / endSec, see docs/CONTRACTS.md §1.3);
 * hh:mm:ss only exists at render time, via these functions. Never format a time inline.
 */

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** Player-style timestamp: 612.34 → "10:12", 4212 → "1:10:12". Fractions are truncated. */
export function formatTimestamp(seconds: number): string {
  const total = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** Human length: 1234 → "20 min", 4212 → "1 h 10 min", 7200 → "2 h", 42 → "< 1 min". */
export function formatDuration(seconds: number): string {
  const totalMin = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds / 60) : 0;
  if (totalMin < 1) return '< 1 min';
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Parse the `?t=` deep-link parameter ("612.34") into float seconds for
 * `video.currentTime`. Returns null for anything that is not plain
 * non-negative decimal seconds — including "10:12", "", "-5" and "1e3".
 */
export function parseTimeParam(value: string | null): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : null;
}
