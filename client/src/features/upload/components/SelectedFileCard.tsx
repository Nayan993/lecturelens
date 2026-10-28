import { useEffect, useState, type SyntheticEvent } from 'react';
import { FileAudio, FileVideo, X } from 'lucide-react';
import { formatTimestamp } from '../../../lib/formatTime';
import { extensionOf, formatBytes, mediaKind } from '../../../lib/media';
import { Card, IconButton } from '../../../components/ui';

/**
 * The chosen file: name, size, type, and its duration read locally from the media metadata
 * (a <video>/<audio> with preload="metadata" on an object URL) before anything is uploaded.
 */
export function SelectedFileCard({
  file,
  onRemove,
  onDuration,
  disabled,
}: {
  file: File;
  onRemove: () => void;
  onDuration?: (seconds: number | null) => void;
  disabled?: boolean;
}) {
  const kind = mediaKind(file) ?? 'video';
  const [url, setUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [unreadable, setUnreadable] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    setDuration(null);
    setUnreadable(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const onLoaded = (e: SyntheticEvent<HTMLMediaElement>) => {
    const d = e.currentTarget.duration;
    const value = Number.isFinite(d) ? d : null;
    setDuration(value);
    onDuration?.(value);
  };
  const onError = () => {
    // e.g. .mkv in browsers without Matroska support — the upload itself still works.
    setUnreadable(true);
    onDuration?.(null);
  };

  const Icon = kind === 'audio' ? FileAudio : FileVideo;
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span aria-hidden className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand">
          <Icon className="h-5 w-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-sm font-medium text-ink-1">{file.name}</p>
          <p className="text-xs text-ink-2">
            {extensionOf(file.name).toUpperCase()} {kind} · {formatBytes(file.size)} ·{' '}
            <span data-testid="file-duration">
              {duration !== null ? `Duration ${formatTimestamp(duration)}` : unreadable ? 'Duration unavailable in this browser' : 'Reading duration…'}
            </span>
          </p>
        </div>
        <IconButton aria-label={`Remove ${file.name}`} icon={<X />} size="sm" onClick={onRemove} disabled={disabled} />
      </div>
      {url &&
        (kind === 'video' ? (
          <video
            src={url}
            preload="metadata"
            controls
            muted
            onLoadedMetadata={onLoaded}
            onError={onError}
            className="max-h-56 w-full rounded-control bg-black object-contain"
            aria-label={`Preview of ${file.name}`}
          />
        ) : (
          <audio src={url} preload="metadata" controls onLoadedMetadata={onLoaded} onError={onError} className="w-full" aria-label={`Preview of ${file.name}`} />
        ))}
    </Card>
  );
}
