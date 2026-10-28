// @vitest-environment jsdom
// The eight tests requested for the polish pass. Broader coverage lives in the other *.test files.
import { useEffect, useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ROUTER_FUTURE } from './routerFuture';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatTimestamp, parseTimeParam } from './lib/formatTime';
import { parseMockFlag, selectServices, SERVICE_DOMAINS } from './services';
import { mockServices } from './services/mock';
import { Button, Dialog } from './components/ui';
import { PlayerProvider, usePlayer, type PlayerHandle } from './components/player/PlayerContext';
import { CitationChip } from './features/qa/components/CitationChip';
import { AnswerCard } from './features/qa/components/AnswerCard';
import { RequireRole } from './components/layout/RequireRole';
import { AuthProvider } from './context/AuthContext';
import { TOKEN_KEY } from './lib/tokenStorage';
import type { AuthService } from './services';
import type { Citation, GroundedAnswer, User } from './types';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('lib/formatTime', () => {
  it('formatTimestamp: 0, minutes, and the ≥ 1 h form', () => {
    expect(formatTimestamp(0)).toBe('0:00');
    expect(formatTimestamp(612.34)).toBe('10:12');
    expect(formatTimestamp(3600)).toBe('1:00:00');
    expect(formatTimestamp(4212.9)).toBe('1:10:12');
  });

  it('parseTimeParam accepts float seconds and rejects everything else', () => {
    expect(parseTimeParam('612.34')).toBe(612.34);
    expect(parseTimeParam('0')).toBe(0);
    for (const bad of [null, '', '10:12', '-5', '1e3', 'abc']) expect(parseTimeParam(bad)).toBeNull();
  });
});

it('VITE_USE_MOCKS=all selects the mock adapter for every domain', () => {
  const services = selectServices(parseMockFlag('all'));
  for (const domain of SERVICE_DOMAINS) expect(services[domain]).toBe(mockServices[domain]);
});

it('Button renders its label and fires onClick', () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick}>Save changes</Button>);
  fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
  expect(onClick).toHaveBeenCalledOnce();
});

it('Dialog closes on Escape and returns focus to the trigger', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Dialog open={open} onOpenChange={setOpen} title="Rename">
          <input aria-label="Title" />
        </Dialog>
      </>
    );
  }
  render(<Harness />);
  const trigger = screen.getByRole('button', { name: 'Open' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog', { name: 'Rename' })).toBeTruthy();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it('CitationChip calls seekTo with the exact float second when the player is on screen', () => {
  const seekTo = vi.fn();
  const handle: PlayerHandle = { seekTo, pause: vi.fn(), getCurrentTime: () => 0 };
  function RegisterFakePlayer() {
    const { register } = usePlayer();
    useEffect(() => {
      register(handle);
      return () => register(null);
    }, [register]);
    return null;
  }
  const citation: Citation = {
    marker: 2,
    chunkId: '6650c3a0c3b2e41d8a300004',
    lectureId: '6650c3a0c3b2e41d8a100001',
    startSec: 357.43,
    endSec: 385.149,
    quote: 'the loss blows up to infinity',
    deepLink: '/lectures/6650c3a0c3b2e41d8a100001/play?t=357.43',
  };
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <PlayerProvider>
        <RegisterFakePlayer />
        <CitationChip citation={citation} onScreenLectureId="6650c3a0c3b2e41d8a100001" />
      </PlayerProvider>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole('button', { name: /^Source 2: 5:57/ }));
  expect(seekTo).toHaveBeenCalledWith(357.43);
});

it('AnswerCard renders the abstention panel when abstained is true', () => {
  const abstained: GroundedAnswer = {
    question: 'What did the lecturer recommend for Adam’s beta2?',
    lectureId: null,
    answerable: false,
    abstained: true,
    abstainReason: 'NO_RELEVANT_PASSAGE',
    answer: null,
    citations: [],
    confidence: null,
    retriever: 'hybrid',
    topScore: 0.0091,
    model: 'llama-3.3-70b-versatile',
    promptVersion: 'answer-v1',
    cached: false,
    latencyMs: 412,
  };
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <AnswerCard answer={abstained} scoped={false} />
    </MemoryRouter>,
  );
  const panel = screen.getByTestId('abstained-panel');
  expect(panel.textContent).toContain('I couldn’t find this in the lectures.');
  expect(panel.textContent).toContain('Nothing in the lecture closely matched your question');
  expect(screen.queryByRole('alert')).toBeNull();
});

it('RequireRole renders the 403 page for the wrong role', async () => {
  const student: User = {
    id: '6650c3a0c3b2e41d8a000002',
    email: 'student@lecturelens.dev',
    name: 'Rohan Mehta',
    role: 'student',
    lastLoginAt: null,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T08:00:00.000Z',
  };
  const service: AuthService = {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(async () => student),
    updateProfile: vi.fn(),
  };
  localStorage.setItem(TOKEN_KEY, 'student-session');
  render(
    <MemoryRouter future={ROUTER_FUTURE}>
      <AuthProvider service={service}>
        <RequireRole role="teacher">
          <p>Teacher-only content</p>
        </RequireRole>
      </AuthProvider>
    </MemoryRouter>,
  );
  expect(await screen.findByText('You don’t have access to this page')).toBeTruthy();
  expect(screen.queryByText('Teacher-only content')).toBeNull();
});
