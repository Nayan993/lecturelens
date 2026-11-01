/**
 * The one deep-link format (CONTRACTS.md §5.6): `/lectures/<lectureId>/play?t=<startSec>`, where `t`
 * is the JSON number serialisation of the float-second offset (e.g. `t=612.34`). Always built by
 * the server from stored offsets — never from model output.
 */
export function deepLinkFor(lectureId: string, startSec: number): string {
  return `/lectures/${lectureId}/play?t=${startSec}`;
}
