// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../context/AuthContext';
import { ApiRequestError } from '../../lib/apiClient';
import { TOKEN_KEY } from '../../lib/tokenStorage';
import { services } from '../../services';
import { AppRoutes } from '../../routes';
import { ToastProvider } from '../../components/ui';
import type { GroundedAnswer } from '../../types';

const L7 = '6650c3a0c3b2e41d8a100001';
const STUDENT = '6650c3a0c3b2e41d8a000002';
const LR_QUESTION = 'Why does a learning rate that is too large make the loss blow up?';
const OFF_TOPIC = 'What did the lecturer recommend for Adam’s beta2?';

function LocationProbe() {
  const l = useLocation();
  return <output data-testid="location">{`${l.pathname}${l.search}`}</output>;
}

function renderAt(path: string) {
  localStorage.setItem(TOKEN_KEY, `mock-token.${STUDENT}`);
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

function fakeMedia(media: HTMLMediaElement, duration: number) {
  let paused = true;
  Object.defineProperty(media, 'duration', { configurable: true, value: duration });
  Object.defineProperty(media, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused });
  media.play = vi.fn(async () => {
    paused = false;
  });
  media.pause = vi.fn();
  act(() => {
    media.dispatchEvent(new Event('loadedmetadata'));
  });
}

async function ask(question: string) {
  const input = await screen.findByLabelText('Your question'); // pages are lazy-loaded
  fireEvent.change(input, { target: { value: question } });
  fireEvent.submit(input.closest('form')!);
}

beforeAll(() => {
  Element.prototype.scrollTo = vi.fn() as unknown as typeof Element.prototype.scrollTo;
});
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  document.documentElement.classList.remove('dark');
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Ask — grounded answers and abstention', () => {
  it('an abstained answer is a calm info panel (not an error), with the reason in plain English', async () => {
    renderAt('/app/ask');
    await ask(OFF_TOPIC);
    const panel = await screen.findByTestId('abstained-panel');
    expect(panel.textContent).toContain('I couldn’t find this in the lectures.');
    expect(panel.textContent).toContain('Nothing in the lecture closely matched your question');
    expect(panel.textContent).toContain('Try rephrasing');
    expect(panel.className).not.toMatch(/danger/);
    expect(within(panel).queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(panel.textContent).toMatch(/Retriever: hybrid · top score [\d.—]+ · \d+ ms/);
  });

  it('inside a lecture the abstention offers to widen the scope, and widening re-asks across all lectures', async () => {
    const askSpy = vi.spyOn(services.qa, 'ask');
    renderAt(`/app/lectures/${L7}`);
    await screen.findByRole('heading', { level: 1, name: /Lecture 7/ });
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await ask(OFF_TOPIC);
    expect((await screen.findByTestId('abstained-panel')).textContent).toContain('I couldn’t find this in this lecture.');
    fireEvent.click(screen.getByRole('button', { name: 'Ask across all lectures' }));
    await waitFor(() => expect(askSpy).toHaveBeenLastCalledWith({ question: OFF_TOPIC, lectureId: undefined }));
  });

  it('guard: answerable with no citations renders as an abstention and logs a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const ungrounded = {
      question: LR_QUESTION,
      lectureId: null,
      answerable: true,
      abstained: false,
      abstainReason: null,
      answer: 'A confident-sounding answer with no sources.',
      citations: [],
      confidence: 0.9,
      retriever: 'hybrid',
      topScore: 0.5,
      model: 'm',
      promptVersion: 'answer-v1',
      cached: false,
      latencyMs: 900,
    } as unknown as GroundedAnswer;
    vi.spyOn(services.qa, 'ask').mockResolvedValue(ungrounded);
    renderAt('/app/ask');
    await ask(LR_QUESTION);
    const panel = await screen.findByTestId('abstained-panel');
    expect(panel.textContent).toContain('came back without any sources');
    expect(screen.queryByText('A confident-sounding answer with no sources.')).toBeNull();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Contract violation'), ungrounded);
  });

  it('in the reading view, a citation chip (and its [n] marker) seeks the player', async () => {
    renderAt(`/app/lectures/${L7}`);
    await screen.findByRole('heading', { level: 1, name: /Lecture 7/ });
    const video = document.querySelector('video')!;
    fakeMedia(video, 1199.398);
    fireEvent.click(screen.getByRole('tab', { name: 'Ask' }));
    await ask(LR_QUESTION);
    const chip = await screen.findByRole('button', { name: /^Source 2: 5:57\./ });
    fireEvent.click(chip);
    expect(video.currentTime).toBe(357.43);
    expect(video.play).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Source 1' })); // the [1] marker in the text
    expect(video.currentTime).toBe(299.059);
    expect(location()).toBe(`/app/lectures/${L7}`); // seeked in place, no navigation
    expect(screen.getByText(/Retriever: hybrid · top score/)).toBeTruthy();
  });

  it('on /app/ask (no player) a chip routes to the lecture at that second and shows the lecture title', async () => {
    renderAt('/app/ask');
    await ask(LR_QUESTION);
    const chip = await screen.findByRole('button', { name: /^Source 2: Lecture 7 — Gradient Descent and Backpropagation, 5:57\./ });
    fireEvent.click(chip);
    await waitFor(() => expect(location()).toBe(`/app/lectures/${L7}?t=357.43`));
  });

  it('a 501 renders the calm notImplemented state in the thread', async () => {
    vi.spyOn(services.qa, 'ask').mockRejectedValue(new ApiRequestError({ status: 501, code: 'NOT_IMPLEMENTED', message: 'Not implemented' }));
    renderAt('/app/ask');
    await ask(LR_QUESTION);
    expect(await screen.findByText('Grounded answers aren’t available yet.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Quizzes', () => {
  it('the list shows coverage, question count and best score', async () => {
    renderAt('/app/quizzes');
    const title = await screen.findByText('Practice quiz — Lecture 7');
    const card = title.closest('.flex.h-full') as HTMLElement;
    expect(card.textContent).toContain('Best 4/5 · 80%');
    expect(card.textContent).toContain('5 questions · 3 attempts');
    expect(within(card).getByRole('list', { name: 'Topics covered' }).textContent).toContain('Recap: training as minimising a loss over parameters');
  });

  it('take a quiz: one question per screen, review flags unanswered, results show per-topic scores and evidence links', async () => {
    renderAt('/app/quizzes/6650c3a0c3b2e41d8a700001');
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    const group = screen.getByRole('group');
    expect(within(group).getAllByRole('radio')).toHaveLength(4);
    fireEvent.click(within(group).getByText('The model parameters θ')); // full-card click
    expect((within(group).getByRole('radio', { name: /The model parameters θ/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Question 2 of 5')).toBeTruthy();
    fireEvent.click(screen.getByText('θ ← θ − η∇L(θ)'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' })); // skip question 3
    fireEvent.click(screen.getByText('500'));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByText('−4'));
    fireEvent.click(screen.getByRole('button', { name: 'Review answers' }));

    expect(screen.getByText(/1 question is unanswered and will count as wrong/)).toBeTruthy();
    expect(screen.getAllByText('Not answered')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));

    expect(await screen.findByText('4 of 5 correct')).toBeTruthy();
    expect(location()).toMatch(/^\/app\/quizzes\/6650c3a0c3b2e41d8a700001\?attempt=/);
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual([
      'Recap: training as minimising a loss over parameters1 / 1100%',
      'Gradient descent and the learning rate1 / 250%',
      'Stochastic and mini-batch gradient descent1 / 1100%',
      'Chain rule and computational graphs1 / 1100%',
    ]);
    const evidence = screen.getAllByRole('link', { name: /^Watch the explanation/ });
    expect(evidence.map((a) => a.getAttribute('href'))).toEqual([
      `/app/lectures/${L7}?t=66.201`,
      `/app/lectures/${L7}?t=249.396`,
      `/app/lectures/${L7}?t=357.43`,
      `/app/lectures/${L7}?t=568.51`,
      `/app/lectures/${L7}?t=780.301`,
    ]);
    expect(screen.getByText('Not answered — incorrect')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Revise weak topics' }).getAttribute('href')).toBe('/app/revision');
  });

  it('?attempt= shows the stored results (contract §6.11 attempt)', async () => {
    renderAt('/app/quizzes/6650c3a0c3b2e41d8a700001?attempt=6650c3a0c3b2e41d8a800003');
    expect(await screen.findByText('3 of 5 correct')).toBeTruthy();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(rows).toEqual([
      'Recap: training as minimising a loss over parameters1 / 1100%',
      'Gradient descent and the learning rate1 / 250%',
      'Stochastic and mini-batch gradient descent0 / 10%',
      'Chain rule and computational graphs1 / 1100%',
    ]);
    fireEvent.click(screen.getAllByRole('link', { name: /^Watch the explanation/ })[2]);
    await waitFor(() => expect(location()).toBe(`/app/lectures/${L7}?t=357.43`));
  });
});

describe('Revision', () => {
  it('shows each item’s full reason sentence, signals and actions', async () => {
    renderAt('/app/revision');
    const reason = await screen.findByText(
      'Across your 3 quiz attempts you got 1 of 3 answers on stochastic and mini-batch gradient descent right (33%), including a miss on your latest attempt on 26 Oct — your weakest topic, against 60% (9 of 15) for the lecture overall. Rewatch the 3.4-minute section on epochs and iterations.',
    );
    expect(reason.className).toContain('prose-lecture');
    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Priority 1: Stochastic and mini-batch gradient descent',
      'Priority 2: Gradient descent and the learning rate',
      'Priority 3: Chain rule and computational graphs',
    ]);
    expect(screen.getByText(/the divergence question \(η = 1\.1 on L\(w\) = w²\) was wrong in all 3/)).toBeTruthy();
    expect(screen.getAllByText('High priority')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Watch section: Stochastic and mini-batch gradient descent' }).getAttribute('href')).toBe(`/app/lectures/${L7}?t=492.332`);
    expect(await screen.findAllByText(/Lecture 7 — Gradient Descent and Backpropagation ·/)).toHaveLength(3);
  });

  it('Practise builds a quiz for that topic and opens it', async () => {
    const create = vi.spyOn(services.quizzes, 'create');
    renderAt('/app/revision');
    fireEvent.click(await screen.findByRole('button', { name: 'Practise Stochastic and mini-batch gradient descent' }));
    await waitFor(() => expect(create).toHaveBeenCalledWith({ lectureId: L7, topicIds: ['6650c3a0c3b2e41d8a400002'], questionCount: 10 }));
    await waitFor(() => expect(location()).toMatch(/^\/app\/quizzes\/[0-9a-f]{24}$/));
  });

  it('no plan → "Take a quiz first"', async () => {
    vi.spyOn(services.revision, 'getPlan').mockResolvedValue(null);
    renderAt('/app/revision');
    expect(await screen.findByText('Take a quiz first — your plan is built from your results.')).toBeTruthy();
  });
});

describe('Search', () => {
  it('idle → results with highlighted terms, relevance meters, topic labels and play links', async () => {
    renderAt('/app/search');
    expect(await screen.findByText('Search inside your lectures')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Retriever' })).toBeTruthy(); // DEV only
    fireEvent.change(screen.getByLabelText('Search lecture transcripts'), { target: { value: 'epoch iterations mini-batch' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText(/passages for “epoch iterations mini-batch”/)).toBeTruthy();
    const meters = screen.getAllByRole('meter');
    expect(meters[0].getAttribute('aria-valuenow')).toBe('100');
    expect(document.querySelectorAll('mark').length).toBeGreaterThan(2);
    const play = screen.getAllByRole('link', { name: /^Play from / })[0];
    expect(play.getAttribute('href')).toMatch(new RegExp(`^/app/lectures/${L7}\\?t=\\d`));
    await waitFor(() => expect(screen.getAllByText(/Stochastic and mini-batch gradient descent ·/).length).toBeGreaterThan(0));
  });

  it('no matches → empty state; 501 → notImplemented', async () => {
    renderAt('/app/search?q=zzzz%20qqqq');
    expect(await screen.findByText('No passages matched')).toBeTruthy();
    cleanup();
    vi.spyOn(services.search, 'search').mockRejectedValue(new ApiRequestError({ status: 501, code: 'NOT_IMPLEMENTED', message: 'x' }));
    renderAt('/app/search?q=gradient');
    expect(await screen.findByText('Lecture search isn’t available yet.')).toBeTruthy();
  });
});

describe('Settings', () => {
  it('theme radio toggles the .dark class and persists; name saves', async () => {
    renderAt('/app/settings');
    fireEvent.click(await screen.findByLabelText(/^Dark/));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('ll.theme')).toBe('dark');
    fireEvent.click(screen.getByLabelText(/^Light/));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect((screen.getByLabelText('Email') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Rohan K. Mehta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Profile saved')).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: /Rohan K\. Mehta/ })).toBeTruthy());
  });
});
