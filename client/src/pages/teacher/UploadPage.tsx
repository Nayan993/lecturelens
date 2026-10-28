import { useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, UploadCloud } from 'lucide-react';
import { isApiError } from '../../lib/apiClient';
import { apiFieldErrors, type FieldErrors } from '../../lib/forms';
import { formatBytes, titleFromFilename } from '../../lib/media';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Progress, Textarea, useToast } from '../../components/ui';
import { useCreateLecture } from '../../features/lectures/hooks';
import { SelectedFileCard } from '../../features/upload/components/SelectedFileCard';
import { UploadDropzone } from '../../features/upload/components/UploadDropzone';
import { FormError } from '../public/LoginPage';

/** Named on the form as the consent requires (CONTRACTS.md §4.2 consent.processorNamed). */
export const PROCESSORS = {
  transcription: 'AssemblyAI',
  llm: 'Groq (Llama 3.3 70B)',
};

type Field = 'title' | 'recordedOn' | 'description' | 'notes' | 'courseCode' | 'file';
const FIELDS: readonly Field[] = ['title', 'recordedOn', 'description', 'notes', 'courseCode', 'file'];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** /app/upload — choose a recording, describe it, confirm consent, upload with real progress. */
export function UploadPage() {
  useDocumentTitle('Upload lecture');
  const navigate = useNavigate();
  const { toast } = useToast();
  const create = useCreateLecture();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const titleTouched = useRef(false);
  const [recordedOn, setRecordedOn] = useState(today);
  const [courseCode, setCourseCode] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const uploading = create.isPending;

  const chooseFile = (f: File) => {
    setFile(f);
    setFormError(null);
    // Prefill the title from the filename unless the teacher has typed their own.
    if (!titleTouched.current || !title.trim()) setTitle(titleFromFilename(f.name));
  };

  const validate = (): FieldErrors<Field> => {
    const e: FieldErrors<Field> = {};
    if (!file) e.file = 'Choose a lecture file.';
    if (!title.trim()) e.title = 'Give the lecture a title.';
    else if (title.trim().length > 200) e.title = 'Keep the title under 200 characters.';
    if (recordedOn && recordedOn > today()) e.recordedOn = 'The recording date can’t be in the future.';
    if (description.length > 2000) e.description = 'Keep the description under 2000 characters.';
    if (notes.length > 10000) e.notes = 'Keep notes under 10,000 characters.';
    return e;
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!consent || uploading) return;
    const found = validate();
    setErrors(found);
    setFormError(null);
    if (Object.keys(found).length > 0 || !file) return;

    const form = new FormData();
    form.set('file', file);
    form.set('title', title.trim());
    if (courseCode.trim()) form.set('courseCode', courseCode.trim());
    if (description.trim()) form.set('description', description.trim());
    if (recordedOn) form.set('recordedOn', recordedOn);
    if (notes.trim()) form.set('notes', notes.trim());
    // One checkbox, three consent facts: the lecturer agreed, and this form showed the purpose and named the processors.
    form.set('lecturerConsent', 'true');
    form.set('purposeShown', 'true');
    form.set('processorNamed', 'true');

    setProgress(0);
    create.mutate(
      { form, onUploadProgress: setProgress },
      {
        onSuccess: (lecture) => {
          toast({ variant: 'success', title: 'Upload complete', description: 'Processing has started — this page shows its progress.' });
          navigate(`/app/lectures/${lecture.id}`);
        },
        onError: (err) => {
          // Keep everything the teacher entered; show what went wrong.
          setProgress(null);
          if (isApiError(err) && err.code === 'VALIDATION_FAILED') setErrors(apiFieldErrors(err.details, FIELDS));
          setFormError(err.message);
          toast({ variant: 'error', title: 'Upload failed', description: err.message });
        },
      },
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-1">Upload lecture</h1>
        <p className="text-sm text-ink-2">After upload, LectureLens transcribes the recording, finds topics and drafts summaries for your review.</p>
      </header>

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-6" aria-describedby={formError ? 'upload-form-error' : undefined}>
        <FormError id="upload-form-error" message={formError} />

        {file ? (
          <SelectedFileCard file={file} onRemove={() => setFile(null)} disabled={uploading} />
        ) : (
          <UploadDropzone onFile={chooseFile} disabled={uploading} />
        )}
        {errors.file && !file && <p className="-mt-4 text-sm font-medium text-danger">{errors.file}</p>}

        <Card>
          <CardHeader>
            <CardTitle>About this lecture</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Title"
              required
              value={title}
              onChange={(e) => {
                titleTouched.current = true;
                setTitle(e.target.value);
              }}
              error={errors.title}
              containerClassName="sm:col-span-2"
              disabled={uploading}
            />
            <Input label="Recorded on" type="date" value={recordedOn} max={today()} onChange={(e) => setRecordedOn(e.target.value)} error={errors.recordedOn} disabled={uploading} />
            <Input label="Course code" hint="Optional, e.g. CS 3410" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} disabled={uploading} />
            <Textarea
              label="Description"
              hint="Optional. Shown to students in the lecture list."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              error={errors.description}
              containerClassName="sm:col-span-2"
              disabled={uploading}
            />
            <Textarea
              label="Lecture notes"
              hint="Optional. Your slides’ text or notes — kept with the lecture for later use; not shown to students."
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              error={errors.notes}
              containerClassName="sm:col-span-2"
              disabled={uploading}
            />
          </CardContent>
        </Card>

        <Card className="border-brand/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="h-4 w-4 text-brand" />
              Consent
            </CardTitle>
            <CardDescription>Required before anything is uploaded.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div id="consent-purpose" className="flex flex-col gap-1.5 text-sm text-ink-2">
              <p>
                <span className="font-medium text-ink-1">Purpose:</span> to produce a searchable, timestamped transcript, topic summaries and practice
                questions for the students on this course.
              </p>
              <p>
                <span className="font-medium text-ink-1">Third-party processors:</span> the audio is sent to <strong className="font-semibold text-ink-1">{PROCESSORS.transcription}</strong> for
                transcription, and transcript text is sent to <strong className="font-semibold text-ink-1">{PROCESSORS.llm}</strong> to draft summaries and questions.
              </p>
            </div>
            <Checkbox
              label="I confirm the lecturer has consented to this recording being transcribed and processed"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              aria-describedby="consent-purpose"
              disabled={uploading}
            />
          </CardContent>
        </Card>

        {progress !== null && (
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <Progress label="Uploading" value={Math.round(progress * 100)} showLabel />
            {file && (
              <p className="text-xs text-ink-2">
                {formatBytes(file.size * progress)} of {formatBytes(file.size)}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {!consent && <p className="text-sm text-ink-2">Tick the consent box to enable upload.</p>}
          <Button type="submit" size="lg" leftIcon={<UploadCloud />} disabled={!consent || !file} loading={uploading}>
            {uploading ? 'Uploading…' : 'Upload and process'}
          </Button>
        </div>
      </form>
    </div>
  );
}
