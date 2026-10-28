// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ROUTER_FUTURE } from '../../routerFuture';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/apiClient';
import { deepLinkToHref } from '../../lib/lectureLinks';
import { savePlayback } from '../../lib/playbackProgress';
import { TOKEN_KEY } from '../../lib/tokenStorage';
import { services } from '../../services';
import { AppRoutes } from '../../routes';
import { ToastProvider } from '../../components/ui';
import { activeSegmentIndex } from '../../features/transcript/components/TranscriptPanel';
import { MANUAL_SCROLL_SUPPRESS_MS } from '../../features/transcript/useAutoFollow';
import { progressPct } from '../../features/lectures/components/ProcessingStatusView';
import type { TranscriptSegment } from '../../types';

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
      <MemoryRouter initialEntries={[path]} future={ROUTER_FUTURE}>
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

/** jsdom has no media pipeline: give the <video> a duration, a writable clock and play/pause. */
function fakeMedia(media: HTMLMediaElement, duration: number) {
  let paused = true;
  Object.defineProperty(media, 'duration', { configurable: true, value: duration });
  Object.defineProperty(media, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused });
  media.play = vi.fn(async () => {
    paused = false;
  });
  media.pause = vi.fn(() => {
    paused = true;
  });
  act(() => {
    media.dispatchEvent(new Event('loadedmetadata'));
  });
}

/** Move the playhead and let the player publish it (forced emit via `seeked`). */
function playTo(video: HTMLVideoElement, t: number) {
  video.currentTime = t;
  act(() => {
    video.dispatchEvent(new Event('seeked'));
  });
}

const scrollTo = vi.fn();
beforeAll(() => {
  Element.prototype.scrollTo = scrollTo as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  scrollTo.mockClear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function openReadingView(userId = STUDENT, path = `/app/lectures/${L7}`) {
  renderAs(userId, path);
  await screen.findByRole('heading', { level: 1, name: 'Lecture 7 — Gradient Descent and Backpropagation' });
  const video = document.querySelector('video')!;
  fakeMedia(video, 1199.398);
  await screen.findAllByRole('button', { name: /^Play from / });
  return video;
}

const row = (index: number) => document.querySelector<HTMLLIElement>(`li[data-index="${index}"]`)!;
const transcriptScroller = () => screen.getByRole('region', { name: 'Transcript' });

describe('lecture reading view — transcript', () => {
  it('clicking any timestamp (or the sentence) seeks the player and plays', async () => {
    const video = await openReadingView();
    fireEvent.click(within(row(13)).getByRole('button', { name: /^Play from 5:57/ }));
    expect(video.currentTime).toBe(357.43);
    expect(video.play).toHaveBeenCalled();
    fireEvent.click(within(row(2)).getByText(/Stop thinking of the loss as a function of the data/));
    expect(video.currentTime).toBe(66.201);
  });

  it('highlights the playing segment and auto-scrolls it into view', async () => {
    const video = await openReadingView();
    playTo(video, 360);
    expect(row(13).getAttribute('aria-current')).toBe('true');
    expect(row(13).className).toContain('bg-accent-soft');
    expect(row(13).className).toContain('border-accent');
    expect(row(12).getAttribute('aria-current')).toBeNull();
    expect(scrollTo.mock.contexts.at(-1)).toBe(transcriptScroller());
  });

  it('a manual scroll suppresses auto-scroll for 5 s, then following resumes', async () => {
    const video = await openReadingView();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    playTo(video, 100);
    scrollTo.mockClear();

    fireEvent.wheel(transcriptScroller());
    playTo(video, 400); // segment changes while the reader is scrolling
    expect(row(14).getAttribute('aria-current')).toBe('true'); // still highlighted…
    expect(scrollTo).not.toHaveBeenCalled(); // …but not scrolled to
    expect(screen.getByRole('button', { name: 'Back to playback' })).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(MANUAL_SCROLL_SUPPRESS_MS - 500));
    playTo(video, 420);
    expect(scrollTo).not.toHaveBeenCalled(); // 4.5 s: still suppressed

    await act(() => vi.advanceTimersByTimeAsync(600));
    playTo(video, 450);
    expect(scrollTo).toHaveBeenCalled(); // > 5 s: following again
    expect(screen.queryByRole('button', { name: 'Back to playback' })).toBeNull();
  });

  it('marks low-confidence segments with a tooltip and corrected ones with "edited"', async () => {
    await openReadingView();
    expect(within(row(5)).getByRole('tooltip', { hidden: true }).textContent).toBe('Low confidence — may contain errors');
    expect(within(row(5)).getByRole('button', { name: /low-confidence transcription/ })).toBeTruthy();
    expect(within(row(14)).getByText('edited')).toBeTruthy();
    expect(within(row(13)).queryByText('edited')).toBeNull();
  });

  it('search highlights matches with previous / next', async () => {
    await openReadingView();
    fireEvent.change(screen.getByLabelText('Search this transcript'), { target: { value: 'learning rate' } });
    const marks = document.querySelectorAll('mark');
    expect(marks.length).toBeGreaterThan(3);
    const count = screen.getByText(/^Match 1 of \d+$/);
    const total = Number(count.textContent!.split(' of ')[1]);
    fireEvent.click(screen.getByRole('button', { name: 'Next match' }));
    expect(screen.getByText(`Match 2 of ${total}`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    fireEvent.click(screen.getByRole('button', { name: 'Previous match' }));
    expect(screen.getByText(`Match ${total} of ${total}`)).toBeTruthy();
  });
});

describe('lecture reading view — topics, markers, summary, deep links', () => {
  it('topic chips seek, highlight the current section, and markers come from topics', async () => {
    const video = await openReadingView();
    const rail = screen.getByRole('navigation', { name: 'Topics' });
    const chips = within(rail).getAllByRole('button');
    expect(chips.map((c) => c.textContent)).toEqual([
      '0:00Recap: training as minimising a loss over parameters',
      '3:41Gradient descent and the learning rate',
      '8:12Stochastic and mini-batch gradient descent',
      '11:39Chain rule and computational graphs',
    ]); // student: the pending 5th topic is not shown
    fireEvent.click(chips[2]);
    expect(video.currentTime).toBe(492.332);
    expect(chips[2].getAttribute('aria-current')).toBe('true');
    expect(chips[2].className).toContain('bg-accent-soft');
    expect(screen.getAllByTestId('player-marker')).toHaveLength(3);
  });

  it('summary hides unapproved sections from students and explains why; evidence chips seek', async () => {
    const video = await openReadingView();
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    const panel = await screen.findByText(/Some sections are awaiting teacher review/);
    expect(panel).toBeTruthy();
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Recap: training as minimising a loss over parameters',
      'Gradient descent and the learning rate',
      'Stochastic and mini-batch gradient descent',
    ]);
    expect(screen.queryByText('Pending review')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^Play evidence at 4:09/ }));
    expect(video.currentTime).toBe(249.396);
  });

  it('the teacher sees pending summaries labelled, with no "awaiting" note', async () => {
    await openReadingView(TEACHER);
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    expect((await screen.findAllByText('Pending review')).length).toBe(2);
    expect(screen.queryByText(/awaiting teacher review/)).toBeNull();
  });

  it('?t= starts the player there; server deepLinks redirect to the reading view', async () => {
    renderAs(STUDENT, `/lectures/${L7}/play?t=612.34`);
    await screen.findByRole('heading', { level: 1, name: /Lecture 7/ });
    expect(screen.getByTestId('location').textContent).toBe(`/app/lectures/${L7}?t=612.34`);
    const video = document.querySelector('video')!;
    fakeMedia(video, 1199.398);
    expect(video.currentTime).toBe(612.34);
    expect(deepLinkToHref(`/lectures/${L7}/play?t=357.43`)).toBe(`/app/lectures/${L7}?t=357.43`);
  });

  it('Ask and Quiz tabs are honest placeholders', async () => {
    await openReadingView();
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    expect(screen.getByText('Ask about this lecture')).toBeTruthy();
  });
});

describe('processing status view (teacher)', () => {
  it('shows a stepper, progress and statusDetail while processing', async () => {
    renderAs(TEACHER, '/app/lectures/6650c3a0c3b2e41d8a100004');
    const list = await screen.findByRole('list', { name: 'Processing steps' });
    const steps = within(list).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent)).toEqual([
      'Extract audio — doneTook 0:30',
      'Transcribe — in progressTranscribing 49.2 minutes of audio with AssemblyAI.',
      'Split into passages — waiting',
      'Find topics — waiting',
      'Write summaries — waiting',
      'Index for search — waiting',
    ]);
    expect(screen.getByRole('progressbar', { name: 'Overall progress' }).getAttribute('aria-valuenow')).toBe('25');
  });

  it('failed: error message and a Retry button for the teacher that calls reprocess', async () => {
    const reprocess = vi.spyOn(services.lectures, 'reprocess');
    renderAs(TEACHER, '/app/lectures/6650c3a0c3b2e41d8a100006');
    expect(await screen.findByText(/Processing failed at “Extract audio”/)).toBeTruthy();
    expect(screen.getByText(/does not contain any stream/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Retry processing' }));
    await waitFor(() => expect(reprocess).toHaveBeenCalledWith('6650c3a0c3b2e41d8a100006', 'extracting'));
  });

  it('progressPct counts done/skipped as 1 and running as ½', () => {
    const s = (state: 'done' | 'running' | 'pending' | 'failed' | 'skipped') => ({ name: 'chunking' as const, state, ms: null });
    expect(progressPct([s('done'), s('running'), s('pending'), s('pending')])).toBe(38);
    expect(progressPct([s('done'), s('done')])).toBe(100);
  });
});

describe('library', () => {
  it('teacher: table with filter chips, title search and sort', async () => {
    renderAs(TEACHER, '/app/lectures');
    await screen.findByText('6 lectures uploaded');
    const cards = () => screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/app/lectures/'));
    expect(cards()).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Processing', pressed: false }));
    // (Order-independent: another test in this file may have restarted the failed tutorial in the shared mock.)
    const processing = cards().map((a) => a.textContent);
    expect(processing).toEqual(expect.arrayContaining(['Lecture 10 — Convolutional Neural Networks', 'Lecture 9 — Regularisation: Weight Decay and Dropout']));
    expect(screen.queryByText('Ready', { selector: '[data-status]' })).toBeNull();
    expect(within(screen.getByText('Lecture 9 — Regularisation: Weight Decay and Dropout').closest('tr')!).getByText('Transcribing')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'longest' } });
    expect(cards()[0].textContent).toBe('Lecture 6 — Linear Regression and Loss Functions');
    fireEvent.change(screen.getByLabelText('Search by title'), { target: { value: 'backprop' } });
    expect(cards().map((a) => a.textContent)).toEqual(['Tutorial 4 — Worked Examples on Backpropagation', 'Lecture 7 — Gradient Descent and Backpropagation']);
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
  });

  it('cards show teacher, date, duration, status and the caller’s topic count', async () => {
    renderAs(STUDENT, '/app/lectures');
    const title = await screen.findByText('Lecture 7 — Gradient Descent and Backpropagation');
    const card = title.closest('div.group') as HTMLElement;
    expect(card.textContent).toContain('Dr. Ananya Rao');
    expect(card.textContent).toContain('20 Oct 2026');
    expect(card.textContent).toContain('19 min');
    expect(card.textContent).toContain('4 topics'); // the student sees 4 approved of 5
    expect(within(card).getByText('Ready')).toBeTruthy();
  });
});

describe('student dashboard', () => {
  it('greets by first name, resumes from saved progress, lists weak topics', async () => {
    savePlayback(STUDENT, L7, 612.34, 1199.398);
    renderAs(STUDENT, '/app/dashboard');
    expect(await screen.findByRole('heading', { level: 1, name: /^Good (morning|afternoon|evening), Rohan$/ })).toBeTruthy();
    expect(await screen.findByText('2 lectures are ready for you.')).toBeTruthy();
    const resume = await screen.findByRole('link', { name: 'Resume' });
    expect(resume.getAttribute('href')).toBe(`/app/lectures/${L7}?t=612.34`);
    expect(screen.getByText(/10:12 of 19:59/)).toBeTruthy();

    const weak = await screen.findByRole('region', { name: 'Weak topics' });
    await within(weak).findByText('Stochastic and mini-batch gradient descent');
    expect(within(weak).getByText('33% correct')).toBeTruthy();
    expect(within(weak).getByRole('link', { name: /^Revise Stochastic and mini-batch gradient descent from 8:12$/ }).getAttribute('href')).toBe(
      `/app/lectures/${L7}?t=492.332`,
    );
    expect(within(weak).getAllByRole('link', { name: /^Revise / })).toHaveLength(3);
  });

  it('a 501 from the revision plan renders the calm notImplemented state inside the card only', async () => {
    vi.spyOn(services.revision, 'getPlan').mockRejectedValue(
      new ApiRequestError({ status: 501, code: 'NOT_IMPLEMENTED', message: 'Not implemented', details: { owner: 'C', prompt: 'C5' } }),
    );
    renderAs(STUDENT, '/app/dashboard');
    const weak = await screen.findByRole('region', { name: 'Weak topics' });
    expect(await within(weak).findByText('Coming soon')).toBeTruthy();
    expect(within(weak).queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'Recent lectures' })).toBeTruthy(); // rest of page fine
  });

  it('no lectures → the empty state', async () => {
    vi.spyOn(services.lectures, 'list').mockResolvedValue({ items: [], page: 1, limit: 6, total: 0 });
    renderAs(STUDENT, '/app/dashboard');
    expect(await screen.findByText('No lectures yet — ask your teacher to upload one')).toBeTruthy();
  });
});

describe('activeSegmentIndex', () => {
  const segs = [
    { startSec: 2.4, endSec: 10 },
    { startSec: 11, endSec: 20 },
    { startSec: 21, endSec: 30 },
  ].map((s, index) => ({ ...s, index }) as unknown as TranscriptSegment);
  it('picks the last segment starting at or before t; gaps belong to the previous one', () => {
    expect(activeSegmentIndex(segs, 0)).toBe(-1);
    expect(activeSegmentIndex(segs, 2.4)).toBe(0);
    expect(activeSegmentIndex(segs, 10.5)).toBe(0);
    expect(activeSegmentIndex(segs, 11)).toBe(1);
    expect(activeSegmentIndex(segs, 999)).toBe(2);
  });
});
