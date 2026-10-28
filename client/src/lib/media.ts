/**
 * Accepted lecture media — docs/CONTRACTS.md §5.3. Decided by extension first, because browsers
 * report MIME types inconsistently (often an empty type for .mkv).
 */
export const ACCEPTED_MEDIA: Record<string, { kind: 'video' | 'audio'; mimeTypes: string[] }> = {
  mp4: { kind: 'video', mimeTypes: ['video/mp4'] },
  mkv: { kind: 'video', mimeTypes: ['video/x-matroska', 'video/matroska'] },
  mov: { kind: 'video', mimeTypes: ['video/quicktime'] },
  webm: { kind: 'video', mimeTypes: ['video/webm'] },
  mp3: { kind: 'audio', mimeTypes: ['audio/mpeg', 'audio/mp3'] },
  wav: { kind: 'audio', mimeTypes: ['audio/wav', 'audio/x-wav', 'audio/wave'] },
  m4a: { kind: 'audio', mimeTypes: ['audio/mp4', 'audio/x-m4a'] },
};

export const ACCEPTED_EXTENSIONS = Object.keys(ACCEPTED_MEDIA);

/** For <input accept>: extensions plus the MIME types. */
export const ACCEPT_ATTRIBUTE = [
  ...ACCEPTED_EXTENSIONS.map((e) => `.${e}`),
  ...Object.values(ACCEPTED_MEDIA).flatMap((m) => m.mimeTypes),
].join(',');

export function extensionOf(filename: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(filename);
  return match ? match[1].toLowerCase() : '';
}

/** 'video' | 'audio' for an accepted file, null otherwise. */
export function mediaKind(file: { name: string; type: string }): 'video' | 'audio' | null {
  const byExt = ACCEPTED_MEDIA[extensionOf(file.name)];
  if (byExt) return byExt.kind;
  const byMime = Object.values(ACCEPTED_MEDIA).find((m) => m.mimeTypes.includes(file.type));
  return byMime?.kind ?? null;
}

/** Upload limit in MB; mirrors the server's MAX_UPLOAD_MB. */
export const MAX_UPLOAD_MB = Number(import.meta.env.VITE_MAX_UPLOAD_MB) > 0 ? Number(import.meta.env.VITE_MAX_UPLOAD_MB) : 512;

/** 412090368 → "393 MB"; 1536 → "1.5 KB". Binary units, as file managers show them. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${i === 0 || value >= 100 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

/** "cs3410-lec07_gd.backprop.mp4" → "cs3410 lec07 gd backprop". */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
