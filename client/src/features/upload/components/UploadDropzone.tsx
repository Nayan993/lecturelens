import { useId, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import { CircleAlert, UploadCloud } from 'lucide-react';
import { cn } from '../../../lib/cn';
import { ACCEPT_ATTRIBUTE, ACCEPTED_EXTENSIONS, formatBytes, MAX_UPLOAD_MB, mediaKind } from '../../../lib/media';

/** Why a file can't be uploaded, naming the limit and the actual size. null = acceptable. */
export function validateLectureFile(file: File): string | null {
  if (!mediaKind(file)) {
    return `“${file.name}” isn’t a supported format. Use ${ACCEPTED_EXTENSIONS.map((e) => `.${e}`).join(', ')}.`;
  }
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
    return `“${file.name}” is ${formatBytes(file.size)}; the limit is ${MAX_UPLOAD_MB} MB.`;
  }
  return null;
}

const carriesFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files');

/**
 * Drop a lecture file here, or press Enter/Space (or click) to browse. A drag-depth counter keeps the
 * highlight steady while the pointer crosses child elements (each child fires its own enter/leave).
 */
export function UploadDropzone({ onFile, disabled = false }: { onFile: (file: File) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  const accept = (file: File | undefined) => {
    if (!file) return;
    const problem = validateLectureFile(file);
    setError(problem);
    if (!problem) onFile(file);
  };

  const onDragEnter = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    if (depth.current === 1) setActive(true);
  };
  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(e)) return;
    e.preventDefault(); // required for drop to fire
    e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    if (disabled || !carriesFiles(e)) return;
    e.preventDefault();
    depth.current = 0;
    setActive(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 1) setError('Drop one lecture at a time.');
    else accept(files[0]);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputRef.current?.click();
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        aria-describedby={[hintId, error ? errorId : ''].filter(Boolean).join(' ')}
        aria-label="Choose a lecture file to upload"
        data-active={active || undefined}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={onKeyDown}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-12 text-center transition-colors',
          active ? 'border-brand bg-brand-soft' : error ? 'border-danger/50 bg-surface' : 'border-border bg-surface hover:border-ink-3',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span aria-hidden className={cn('inline-flex h-12 w-12 items-center justify-center rounded-full', active ? 'bg-surface text-brand' : 'bg-brand-soft text-brand')}>
          <UploadCloud className="h-6 w-6" />
        </span>
        <p className="text-base font-medium text-ink-1">
          {active ? 'Drop to add this lecture' : (
            <>
              Drag a lecture here or <span className="text-brand underline underline-offset-4">browse</span>
            </>
          )}
        </p>
        <p id={hintId} className="text-sm text-ink-2">
          {ACCEPTED_EXTENSIONS.map((e) => e.toUpperCase()).join(', ')} · up to {MAX_UPLOAD_MB} MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="lecture-file-input"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = ''; // allow re-selecting the same file after removing it
        }}
      />
      {error && (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
