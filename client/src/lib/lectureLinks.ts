import type { Id } from '../types';

/** In-app URL of the reading view, optionally starting at `t` float seconds. */
export function lectureHref(id: Id, t?: number | null): string {
  return t !== undefined && t !== null && t > 0 ? `/app/lectures/${id}?t=${Math.round(t * 1000) / 1000}` : `/app/lectures/${id}`;
}

/**
 * Server-built deepLinks (CONTRACTS.md §5.6) look like "/lectures/<id>/play?t=612.34".
 * The router also redirects that path, but converting avoids a hop for in-app links.
 */
export function deepLinkToHref(deepLink: string): string {
  const match = /^\/lectures\/([^/?#]+)\/play(?:\?t=([^&#]*))?/.exec(deepLink);
  if (!match) return deepLink;
  const t = match[2] ? Number(match[2]) : null;
  return lectureHref(match[1], t !== null && Number.isFinite(t) ? t : null);
}
