// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/apiClient';
import { MAX_UPLOAD_MB, titleFromFilename } from '../../lib/media';
import { TOKEN_KEY } from '../../lib/tokenStorage';
import { services } from '../../services';
import { AppRoutes } from '../../routes';
import { ToastProvider } from '../../components/ui';
import { UploadDropzone } from '../../features/upload/components/UploadDropzone';

const L7 = '6650c3a0c3b2e41d8a100001';
const TEACHER = '6650c3a0c3b2e41d8a000001';
const STUDENT = '6650c3a0c3b2e41d8a000002';

function LocationProbe() {
  const l = useLocation();
  return <output data-testid="location">{`${l.pathname}${l.search}`}</output>;
}
function renderAs(userId: string, path: string) {
  localStorage.setItem(TOKEN_KEY, `mock-token.${userId}`);
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <ToastProvider>
            <AppRoutes />
            <LocationProbe />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
const location = () => screen.getByTestId('location').textContent;
const toasts = () => screen.getByRole('status', { name: 'Status messages' });
const videoFile = (name = 'cs3410-lec11_attention.mp4', size = 1024) => {
  const f = new File(['x'], name, { type: 'video/mp4' });
  Object.defineProperty(f, 'size', { value: size });
  return f;
};

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => 'blob:mock');
  URL.revokeObjectURL = vi.fn();
});
beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('teacher dashboard (read before anything is mutated)', () => {
  it('real stats, the combined review list and processing rows; no invented attempt numbers', async () => {
    renderAs(TEACHER, '/app/dashboard');
    expect(await screen.findByRole('heading', { level: 1, name: 'Welcome back, Ananya' })).toBeTruthy();
    const overview = screen.getByRole('region', { name: 'Overview' });
    await waitFor(() => expect(within(overview).getByText('Items awaiting review').previousSibling?.textContent).toBe('4'));
    expect(within(overview).getByText('Lectures published').previousSibling?.textContent).toBe('3');
    expect(within(overview).getByText('Currently processing').previousSibling?.textContent).toBe('2');
    expect(within(overview).getByText('Student attempts this week').previousSibling?.textContent).toBe('—');
    expect(screen.getAllByRole('link', { name: /^Review (summary|question):/ })).toHaveLength(4);
    expect(screen.getAllByRole('progressbar', { name: /% processed$/ })).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Upload lecture' }).getAttribute('href')).toBe('/app/upload');
  });
});

describe('upload dropzone', () => {
  const files = (file: File) => ({ dataTransfer: { types: ['Files'], files: [file], dropEffect: 'none' } });

  it('the drag counter keeps the highlight steady over child elements', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const zone = screen.getByRole('button', { name: 'Choose a lecture file to upload' });
    const child = within(zone).getByText(/Drag a lecture here/).closest('p')!;
    const file = videoFile();
    fireEvent.dragEnter(zone, files(file));
    expect(zone.dataset.active).toBe('true');
    fireEvent.dragEnter(child, files(file)); // pointer moves onto a child: enter(child) …
    fireEvent.dragLeave(zone, files(file)); // … then leave(zone) — must not clear the highlight
    expect(zone.dataset.active).toBe('true');
    fireEvent.dragLeave(child, files(file)); // pointer leaves the child and the zone
    expect(zone.dataset.active).toBeUndefined();
    fireEvent.dragEnter(zone, files(file));
    fireEvent.drop(zone, files(file));
    expect(zone.dataset.active).toBeUndefined();
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('ignores drags without files (e.g. selected text)', () => {
    render(<UploadDropzone onFile={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Choose a lecture file to upload' });
    fireEvent.dragEnter(zone, { dataTransfer: { types: ['text/plain'], files: [] } });
    expect(zone.dataset.active).toBeUndefined();
  });

  it('rejects other formats and oversize files, naming the limit and the actual size', () => {
    const onFile = vi.fn();
    render(<UploadDropzone onFile={onFile} />);
    const zone = screen.getByRole('button', { name: 'Choose a lecture file to upload' });
    fireEvent.drop(zone, files(new File(['x'], 'notes.pdf', { type: 'application/pdf' })));
    expect(screen.getByRole('alert').textContent).toContain('“notes.pdf” isn’t a supported format. Use .mp4, .mkv, .mov, .webm, .mp3, .wav, .m4a.');
    fireEvent.drop(zone, files(videoFile('huge.mov', 600 * 1024 * 1024)));
    expect(screen.getByRole('alert').textContent).toBe(`“huge.mov” is 600 MB; the limit is ${MAX_UPLOAD_MB} MB.`);
    expect(onFile).not.toHaveBeenCalled();
    fireEvent.drop(zone, files(new File(['x'], 'recording.mkv', { type: '' }))); // empty MIME, accepted by extension
    expect(onFile).toHaveBeenCalledOnce();
  });

  it('is keyboard operable: Enter or Space opens the file picker', () => {
    const click = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    render(<UploadDropzone onFile={vi.fn()} />);
    const zone = screen.getByRole('button', { name: 'Choose a lecture file to upload' });
    expect(zone.tabIndex).toBe(0);
    fireEvent.keyDown(zone, { key: 'Enter' });
    fireEvent.keyDown(zone, { key: ' ' });
    expect(click).toHaveBeenCalledTimes(2);
  });
});

describe('upload page', () => {
  it('prefills the title, blocks submit until consent, sends the contract fields, shows progress, then opens the status view', async () => {
    const create = vi.spyOn(services.lectures, 'create');
    renderAs(TEACHER, '/app/upload');
    fireEvent.change(await screen.findByTestId('lecture-file-input'), { target: { files: [videoFile()] } });
    expect((screen.getByLabelText(/^Title/) as HTMLInputElement).value).toBe('cs3410 lec11 attention');
    expect(titleFromFilename('Lecture_07--backprop.v2.MP4')).toBe('Lecture 07 backprop v2');

    const submit = screen.getByRole('button', { name: 'Upload and process' });
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Tick the consent box to enable upload.')).toBeTruthy();
    expect(screen.getByText('AssemblyAI')).toBeTruthy(); // the processor is named
    fireEvent.submit(submit.closest('form')!); // even a forced submit does nothing
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText(/I confirm the lecturer has consented/));
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    fireEvent.change(screen.getByLabelText(/^Lecture notes/), { target: { value: 'Slides 1–24' } });
    fireEvent.click(submit);

    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    const form = create.mock.calls[0][0];
    expect(Object.fromEntries([...form.entries()].filter(([k]) => k !== 'file'))).toMatchObject({
      title: 'cs3410 lec11 attention',
      notes: 'Slides 1–24',
      lecturerConsent: 'true',
      purposeShown: 'true',
      processorNamed: 'true',
    });
    expect(form.get('recordedOn')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof create.mock.calls[0][1]?.onUploadProgress).toBe('function');

    expect(await screen.findByRole('heading', { level: 1, name: 'cs3410 lec11 attention' })).toBeTruthy();
    expect(location()).toMatch(/^\/app\/lectures\/[0-9a-f]{24}$/);
    expect(await screen.findByRole('list', { name: 'Processing steps' })).toBeTruthy();
  });

  it('drives a determinate progress bar from onUploadProgress', async () => {
    let report: ((f: number) => void) | undefined;
    vi.spyOn(services.lectures, 'create').mockImplementation((_form, options) => {
      report = options?.onUploadProgress;
      return new Promise(() => undefined); // still uploading
    });
    renderAs(TEACHER, '/app/upload');
    fireEvent.change(await screen.findByTestId('lecture-file-input'), { target: { files: [videoFile('a.mp4', 400 * 1024 * 1024)] } });
    fireEvent.click(screen.getByLabelText(/I confirm the lecturer has consented/));
    fireEvent.click(screen.getByRole('button', { name: 'Upload and process' }));
    await waitFor(() => expect(report).toBeDefined());
    act(() => report!(0.37));
    expect(screen.getByRole('progressbar', { name: 'Uploading' }).getAttribute('aria-valuenow')).toBe('37');
    expect(screen.getByText('148 MB of 400 MB')).toBeTruthy();
  });

  it('on failure keeps the form populated and shows the error', async () => {
    vi.spyOn(services.lectures, 'create').mockRejectedValue(
      new ApiRequestError({ status: 422, code: 'VALIDATION_FAILED', message: 'Request body is invalid.', details: { title: 'Must be 1–200 characters' } }),
    );
    renderAs(TEACHER, '/app/upload');
    fireEvent.change(await screen.findByTestId('lecture-file-input'), { target: { files: [videoFile()] } });
    fireEvent.change(screen.getByLabelText(/^Description/), { target: { value: 'Attention and transformers.' } });
    fireEvent.click(screen.getByLabelText(/I confirm the lecturer has consented/));
    fireEvent.click(screen.getByRole('button', { name: 'Upload and process' }));
    expect(await screen.findByText('Must be 1–200 characters')).toBeTruthy();
    expect(screen.getByText('Request body is invalid.', { selector: '#upload-form-error p' })).toBeTruthy();
    expect((screen.getByLabelText(/^Description/) as HTMLTextAreaElement).value).toBe('Attention and transformers.');
    expect(screen.getByText('cs3410-lec11_attention.mp4')).toBeTruthy();
    expect(location()).toBe('/app/upload');
  });
});

describe('review queue', () => {
  it('shows the approval banner and pending items in two tabs', async () => {
    renderAs(TEACHER, '/app/review');
    expect(await screen.findByText('Students only ever see approved content.')).toBeTruthy();
    expect(await screen.findAllByRole('button', { name: /^Approve summary:/ })).toHaveLength(2);
    fireEvent.click(screen.getByRole('tab', { name: /Questions/ }));
    expect(await screen.findAllByRole('button', { name: /^Approve question:/ })).toHaveLength(2);
    expect(screen.getAllByText('Correct answer')).toHaveLength(2);
  });

  it('rejecting a question requires a reason from the enum', async () => {
    renderAs(TEACHER, '/app/review?tab=questions');
    fireEvent.click(await screen.findByRole('button', { name: /^Reject question: Why do deep stacks of sigmoid layers/ }));
    const dialog = screen.getByRole('dialog', { name: 'Reject this question?' });
    const confirm = within(dialog).getByRole('button', { name: 'Reject' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    const reason = within(dialog).getByLabelText(/^Reason/) as HTMLSelectElement;
    expect([...reason.options].map((o) => o.value)).toEqual(['', 'FACTUALLY_WRONG', 'UNSUPPORTED', 'AMBIGUOUS', 'TOO_EASY', 'TOO_HARD', 'DUPLICATE', 'OTHER']);
    fireEvent.change(reason, { target: { value: 'TOO_EASY' } });
    expect((confirm as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(confirm);
    expect(await within(toasts()).findByText('Question rejected')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Approve question: Why do deep stacks/ })).toBeNull());
    const stored = await services.quizzes.listQuestions({ lectureId: L7, status: 'rejected' });
    expect(stored.items.find((q) => q.id === '6650c3a0c3b2e41d8a600006')?.rejectionReason).toBe('TOO_EASY');
  });

  it('approve is optimistic and rolls back with a toast on error', async () => {
    // Fail after a short delay so the optimistic removal is observable before the rollback.
    vi.spyOn(services.summaries, 'approve').mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new ApiRequestError({ status: 503, code: 'PROVIDER_UNAVAILABLE', message: 'Try again shortly.' })), 80)),
    );
    renderAs(TEACHER, '/app/review');
    const approve = await screen.findByRole('button', { name: 'Approve summary: Chain rule and computational graphs' });
    fireEvent.click(approve);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Approve summary: Chain rule and computational graphs' })).toBeNull()); // optimistic
    expect(await within(toasts()).findByText('Change undone')).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'Approve summary: Chain rule and computational graphs' })).toBeTruthy(); // rolled back

    fireEvent.click(screen.getByRole('button', { name: 'Approve summary: Chain rule and computational graphs' }));
    expect(await within(toasts()).findByText('Summary approved — students can now see it')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Approve summary:/ })).toHaveLength(1));
  });

  it('editing a summary opens a dialog and saves the text', async () => {
    renderAs(TEACHER, '/app/review');
    fireEvent.click((await screen.findAllByRole('button', { name: /^Edit summary:/ }))[0]);
    const dialog = screen.getByRole('dialog', { name: 'Edit summary' });
    fireEvent.change(within(dialog).getByLabelText(/^Summary/), { target: { value: 'A shorter, teacher-written summary.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('A shorter, teacher-written summary.')).toBeTruthy();
  });
});

describe('transcript review', () => {
  const editButton = (i: number) => document.querySelector<HTMLButtonElement>(`button[data-edit-index="${i}"]`)!;

  it('Enter edits, Ctrl+Enter saves, the edit persists in the adapter and shows "edited" with the original text', async () => {
    renderAs(TEACHER, `/app/lectures/${L7}/review`);
    await screen.findByText('Jump to next low-confidence segment');
    const original = editButton(5).textContent!;
    editButton(5).focus();
    fireEvent.keyDown(editButton(5), { key: 'Enter' });
    fireEvent.click(editButton(5)); // a button activates on Enter as a click
    const area = await screen.findByRole('textbox', { name: /^Edit segment at / });
    fireEvent.change(area, { target: { value: 'Sorry, is the loss landscape always shaped like a bowl?' } });
    fireEvent.keyDown(area, { key: 'Enter', ctrlKey: true });

    await waitFor(() => expect(editButton(5).textContent).toContain('Sorry, is the loss landscape always shaped like a bowl?'));
    const row = editButton(5).closest('li')!;
    const badge = await within(row).findByRole('button', { name: 'Edited — show the original transcription' });
    expect(within(row).getByRole('tooltip', { hidden: true }).textContent).toBe(`Original transcription: ${original}`);
    expect(badge).toBeTruthy();
    await waitFor(async () => {
      const stored = await services.transcript.get(L7);
      expect(stored.items[5]).toMatchObject({ text: 'Sorry, is the loss landscape always shaped like a bowl?', corrected: true, originalText: original });
    });
    expect(document.activeElement).toBe(editButton(5)); // focus returns to the row
  });

  it('Escape cancels without saving', async () => {
    const update = vi.spyOn(services.transcript, 'updateSegment');
    renderAs(TEACHER, `/app/lectures/${L7}/review`);
    await screen.findByText('Jump to next low-confidence segment');
    fireEvent.click(editButton(29));
    const area = await screen.findByRole('textbox', { name: 'Edit segment at 13:00' });
    fireEvent.change(area, { target: { value: 'nope' } });
    fireEvent.keyDown(area, { key: 'Escape' });
    expect(update).not.toHaveBeenCalled();
    expect(editButton(29).textContent).toContain('Here’s a tiny example'.replace('’', "'"));
  });

  it('a failed save rolls back with a toast', async () => {
    vi.spyOn(services.transcript, 'updateSegment').mockRejectedValue(new ApiRequestError({ status: 503, code: 'PROVIDER_UNAVAILABLE', message: 'Server busy' }));
    renderAs(TEACHER, `/app/lectures/${L7}/review`);
    await screen.findByText('Jump to next low-confidence segment');
    const before = editButton(40).textContent;
    fireEvent.click(editButton(40));
    const area = await screen.findByRole('textbox', { name: /^Edit segment at / });
    fireEvent.change(area, { target: { value: 'Optimistic text that will fail' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await within(toasts()).findByText('Couldn’t save — your edit was undone')).toBeTruthy();
    await waitFor(() => expect(editButton(40).textContent).toBe(before));
  });

  it('"Jump to next low-confidence segment" walks the unchecked ones and focuses them', async () => {
    renderAs(TEACHER, `/app/lectures/${L7}/review`);
    const jump = await screen.findByRole('button', { name: 'Jump to next low-confidence segment' });
    expect(screen.getByText(/low-confidence segments still to check/).textContent).toMatch(/^2 of 4/); // 5 edited above, 14 corrected in the fixture
    fireEvent.click(jump);
    await waitFor(() => expect(document.activeElement).toBe(editButton(29)));
    fireEvent.click(jump);
    await waitFor(() => expect(document.activeElement).toBe(editButton(40)));
    expect(editButton(40).closest('li')!.className).toContain('ring-2');
  });

  it('the footer counts edits and explains approval', async () => {
    renderAs(TEACHER, `/app/lectures/${L7}/review`);
    expect(await screen.findByText('2 segments edited')).toBeTruthy();
    expect(screen.getByText('Transcript approved')).toBeTruthy();
    expect(screen.getByText(/students can read this transcript/)).toBeTruthy();
  });

  it('students get the 403 page', async () => {
    renderAs(STUDENT, `/app/lectures/${L7}/review`);
    expect(await screen.findByText('You don’t have access to this page')).toBeTruthy();
  });
});

describe('teacher lecture table', () => {
  it('rows with status, topics and review counts; delete requires typing the exact title', async () => {
    renderAs(TEACHER, '/app/lectures');
    const table = await screen.findByRole('table');
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(8)); // header + 6 + the upload above
    const row = within(table).getByText('Lecture 10 — Convolutional Neural Networks').closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Actions for Lecture 10 — Convolutional Neural Networks' }));
    expect(screen.getByRole('menuitem', { name: 'Review transcript' }).getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete…' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this lecture?' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete permanently' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Lecture 10' } });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Lecture 10 — Convolutional Neural Networks' } });
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(await within(toasts()).findByText('Lecture deleted')).toBeTruthy();
    await waitFor(() => expect(within(table).queryByText('Lecture 10 — Convolutional Neural Networks')).toBeNull());
  });
});

describe('students page', () => {
  it('says analytics are planned instead of inventing data', async () => {
    renderAs(TEACHER, '/app/students');
    expect(await screen.findByText('Student analytics are planned')).toBeTruthy();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
