// @vitest-environment jsdom
import { createRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, TOKEN_KEY, useAuth } from './context/AuthContext';
import { ApiError, type AuthService } from './services/auth';
import { AppRoutes } from './routes';
import { ToastProvider } from './components/ui';
import { buildBreadcrumbs } from './components/layout/navigation';
import { getReturnPath } from './components/layout/RequireAuth';
import { initials } from './components/layout/Sidebar';
import { LecturePlayer } from './components/player/LecturePlayer';
import { PlayerProvider, usePlayer, type PlayerHandle } from './components/player/PlayerContext';
import type { Role, User } from './types';
import topicsFixture from '../../mocks/topics.json';

const makeUser = (role: Role): User => ({
  id: role === 'teacher' ? '6650c3a0c3b2e41d8a000001' : '6650c3a0c3b2e41d8a000002',
  email: `${role}@example.edu`,
  name: role === 'teacher' ? 'Dr. Ananya Rao' : 'Rohan Mehta',
  role,
  lastLoginAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
});

/** Test double: token "<role>-token" is valid; anything else is a 401. */
const fakeService = (): AuthService => ({
  login: vi.fn(async (email: string) => ({ token: 'teacher-token', user: { ...makeUser('teacher'), email } })),
  register: vi.fn(async (p) => ({ token: `${p.role}-token`, user: { ...makeUser(p.role), name: p.name } })),
  me: vi.fn(async (token: string) => {
    if (token === 'teacher-token') return makeUser('teacher');
    if (token === 'student-token') return makeUser('student');
    throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid token');
  }),
});

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location" data-state={JSON.stringify(location.state)}>{location.pathname}</output>;
}

function renderApp(path: string, token: string | null, service = fakeService()) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider service={service}>
        <ToastProvider>
          <AppRoutes />
          <LocationProbe />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return service;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AuthContext', () => {
  function Probe() {
    const auth = useAuth();
    return (
      <div>
        <span data-testid="status">{auth.status}</span>
        <span data-testid="user">{auth.user?.name ?? ''}</span>
        <button onClick={() => void auth.login('t@example.edu', 'pw123456')}>login</button>
        <button onClick={auth.logout}>logout</button>
      </div>
    );
  }
  const renderProbe = (service: AuthService) =>
    render(
      <AuthProvider service={service}>
        <Probe />
      </AuthProvider>,
    );

  it('rehydrates a stored token on mount', async () => {
    localStorage.setItem(TOKEN_KEY, 'student-token');
    renderProbe(fakeService());
    expect(screen.getByTestId('status').textContent).toBe('loading');
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(screen.getByTestId('user').textContent).toBe('Rohan Mehta');
  });

  it('discards a token the server rejects with 401', async () => {
    localStorage.setItem(TOKEN_KEY, 'expired');
    renderProbe(fakeService());
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('keeps the token when the server is unreachable', async () => {
    localStorage.setItem(TOKEN_KEY, 'teacher-token');
    const service = fakeService();
    service.me = vi.fn(async () => {
      throw new ApiError(0, 'NETWORK_ERROR', 'down');
    });
    renderProbe(service);
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(localStorage.getItem(TOKEN_KEY)).toBe('teacher-token');
  });

  it('login persists the token under ll.token; logout clears it', async () => {
    renderProbe(fakeService());
    fireEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
    expect(localStorage.getItem('ll.token')).toBe('teacher-token');
    fireEvent.click(screen.getByText('logout'));
    expect(screen.getByTestId('status').textContent).toBe('anonymous');
    expect(localStorage.getItem('ll.token')).toBeNull();
  });
});

describe('route table', () => {
  const SHARED: Array<[string, RegExp]> = [
    ['/app/dashboard', /dashboard/i],
    ['/app/lectures', /lectures/i],
    ['/app/lectures/6650c3a0c3b2e41d8a100001', /^Lecture$/],
    ['/app/search', /^Search$/],
    ['/app/ask', /^Ask$/],
    ['/app/quizzes', /^Quizzes$/],
    ['/app/quizzes/6650c3a0c3b2e41d8a700001', /^Quiz$/],
    ['/app/revision', /^Revision$/],
    ['/app/settings', /^Settings$/],
  ];
  const TEACHER_ONLY: Array<[string, RegExp]> = [
    ['/app/upload', /^Upload lecture$/],
    ['/app/review', /^Review Queue$/],
    ['/app/students', /^Students$/],
  ];

  it.each([
    ['/', /^LectureLens$/],
    ['/login', /^Log in$/],
    ['/register', /^Create an account$/],
  ])('public %s renders without a session', async (path, heading) => {
    renderApp(path, null);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it.each([...SHARED, ...TEACHER_ONLY])('teacher can open %s', async (path, heading) => {
    renderApp(path, 'teacher-token');
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeTruthy();
  });

  it.each(SHARED)('student can open %s', async (path, heading) => {
    renderApp(path, 'student-token');
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeTruthy();
  });

  it.each(TEACHER_ONLY)('student gets the 403 page at %s (same URL)', async (path) => {
    renderApp(path, 'student-token');
    expect(await screen.findByText('You don’t have access to this page')).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe(path);
  });

  it('/app redirects to /app/dashboard', async () => {
    renderApp('/app', 'student-token');
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeTruthy();
    expect(screen.getByTestId('location').textContent).toBe('/app/dashboard');
  });

  it('anonymous users are sent to /login with the intended path preserved', async () => {
    renderApp('/app/quizzes/abc?x=1', null);
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeTruthy();
    const probe = screen.getByTestId('location');
    expect(probe.textContent).toBe('/login');
    const state = JSON.parse(probe.getAttribute('data-state')!);
    expect(state.from).toMatchObject({ pathname: '/app/quizzes/abc', search: '?x=1' });
    expect(getReturnPath(state)).toBe('/app/quizzes/abc?x=1');
  });

  it.each([['/403', 'You don’t have access to this page'], ['/nope', 'We couldn’t find that page'], ['/app/nope', 'We couldn’t find that page']])(
    '%s renders its error page',
    async (path, text) => {
      renderApp(path, 'teacher-token');
      expect(await screen.findByText(text)).toBeTruthy();
    },
  );
});

describe('navigation', () => {
  it('shows role-specific sidebar items; hidden links are not the access control', async () => {
    renderApp('/app/dashboard', 'student-token');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'Lectures', 'Search', 'Ask', 'Quizzes', 'Revision']);
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
  });

  it('teacher sidebar has the teaching items and marks the active route', async () => {
    renderApp('/app/review', 'teacher-token');
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    const labels = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent);
    expect(labels).toEqual(['Dashboard', 'My Lectures', 'Upload', 'Review Queue', 'Students']);
    const active = screen.getAllByRole('link', { name: 'Review Queue' })[0];
    expect(active.getAttribute('aria-current')).toBe('page');
    expect(active.className).toContain('bg-brand-soft');
    expect(active.className).toContain('border-brand');
  });

  it('user menu shows initials, role and logs out', async () => {
    renderApp('/app/dashboard', 'teacher-token');
    const trigger = await screen.findByRole('button', { name: /Dr\. Ananya Rao/ });
    expect(trigger.textContent).toContain('AR');
    expect(trigger.textContent).toContain('teacher');
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Log in' })).toBeTruthy();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('mobile drawer opens from the header, closes on Escape and returns focus', async () => {
    renderApp('/app/dashboard', 'student-token');
    const button = await screen.findByRole('button', { name: 'Open navigation' });
    button.focus();
    fireEvent.click(button);
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(drawer.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('drawer closes on backdrop click and after navigating', async () => {
    renderApp('/app/dashboard', 'student-token');
    fireEvent.click(await screen.findByRole('button', { name: 'Open navigation' }));
    fireEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    fireEvent.click(Array.from(drawer.querySelectorAll('a')).find((a) => a.textContent === 'Ask')!);
    expect(await screen.findByRole('heading', { level: 1, name: 'Ask' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).toBeNull();
  });

  it('Ctrl-K focuses the global search', async () => {
    renderApp('/app/dashboard', 'student-token');
    const search = await screen.findByRole('searchbox', { name: 'Search lectures' });
    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(search);
  });

  it('builds breadcrumbs from the route', () => {
    expect(buildBreadcrumbs('/app/lectures/6650c3a0c3b2e41d8a100001', 'teacher')).toEqual([
      { label: 'My Lectures', to: '/app/lectures' },
      { label: 'Lecture', to: '/app/lectures/6650c3a0c3b2e41d8a100001' },
    ]);
    expect(buildBreadcrumbs('/app/review', 'teacher')).toEqual([{ label: 'Review Queue', to: '/app/review' }]);
    expect(buildBreadcrumbs('/login', undefined)).toEqual([]);
  });

  it('computes avatar initials, skipping honorifics', () => {
    expect(initials('Dr. Ananya Rao')).toBe('AR');
    expect(initials('Rohan Mehta')).toBe('RM');
    expect(initials('Cher')).toBe('C');
  });

  it('getReturnPath refuses non-app destinations', () => {
    expect(getReturnPath({ from: { pathname: 'https://evil.example' } })).toBe('/app');
    expect(getReturnPath(null)).toBe('/app');
  });
});

/** jsdom has no media pipeline: give the element a duration and a writable clock. */
function fakeMedia(media: HTMLMediaElement, duration: number) {
  let paused = true;
  Object.defineProperty(media, 'duration', { configurable: true, value: duration });
  Object.defineProperty(media, 'readyState', { configurable: true, value: 1 });
  Object.defineProperty(media, 'currentTime', { configurable: true, writable: true, value: 0 });
  Object.defineProperty(media, 'muted', { configurable: true, writable: true, value: false });
  Object.defineProperty(media, 'paused', { configurable: true, get: () => paused });
  media.play = vi.fn(async () => {
    paused = false;
    media.dispatchEvent(new Event('play'));
  });
  media.pause = vi.fn(() => {
    paused = true;
    media.dispatchEvent(new Event('pause'));
  });
  act(() => {
    media.dispatchEvent(new Event('loadedmetadata'));
  });
}

describe('LecturePlayer', () => {
  const markers = topicsFixture.items.map((t) => ({ startSec: t.startSec, label: t.label }));

  it('seekTo sets currentTime, plays if paused, and emits onTimeUpdate', () => {
    const ref = createRef<PlayerHandle>();
    const onTimeUpdate = vi.fn();
    render(<LecturePlayer ref={ref} src="/lecture.mp4" title="Lecture 7" onTimeUpdate={onTimeUpdate} />);
    const video = document.querySelector('video')!;
    fakeMedia(video, 1199.398);

    act(() => ref.current!.seekTo(90));
    expect(video.currentTime).toBe(90);
    expect(video.play).toHaveBeenCalledOnce();
    expect(ref.current!.getCurrentTime()).toBe(90);
    expect(onTimeUpdate).toHaveBeenLastCalledWith(90);
    expect(screen.getByLabelText('Current time').textContent).toBe('1:30');
    expect(screen.getByLabelText('Duration').textContent).toBe('19:59');

    act(() => ref.current!.pause());
    expect(video.pause).toHaveBeenCalled();
  });

  it('keyboard shortcuts work only while the player has focus', () => {
    render(<LecturePlayer src="/lecture.mp4" title="Lecture 7" />);
    const video = document.querySelector('video')!;
    fakeMedia(video, 600);
    video.currentTime = 100;

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(100);

    const region = screen.getByRole('region', { name: 'Lecture 7 — media player' });
    fireEvent.keyDown(region, { key: 'ArrowRight' });
    expect(video.currentTime).toBe(105);
    fireEvent.keyDown(region, { key: 'ArrowLeft' });
    expect(video.currentTime).toBe(100);
    fireEvent.keyDown(region, { key: 'l' });
    expect(video.currentTime).toBe(110);
    fireEvent.keyDown(region, { key: 'J' });
    expect(video.currentTime).toBe(100);
    fireEvent.keyDown(region, { key: 'm' });
    expect(video.muted).toBe(true);
    fireEvent.keyDown(region, { key: ' ' });
    expect(video.play).toHaveBeenCalledOnce();
    // Space on a focused button is left to the button itself.
    fireEvent.keyDown(screen.getByRole('button', { name: 'Pause' }), { key: ' ' });
    expect(video.pause).not.toHaveBeenCalled();
  });

  it('throttles onTimeUpdate to ~4 per second', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const onTimeUpdate = vi.fn();
    render(<LecturePlayer src="/lecture.mp4" title="Lecture 7" onTimeUpdate={onTimeUpdate} />);
    const video = document.querySelector('video')!;
    fakeMedia(video, 600);
    onTimeUpdate.mockClear();
    // 40 timeupdate events over 1 second (every 25 ms).
    for (let i = 1; i <= 40; i++) {
      now = 1000 + i * 25;
      video.currentTime = i * 0.025;
      act(() => {
        video.dispatchEvent(new Event('timeupdate'));
      });
    }
    expect(onTimeUpdate.mock.calls.length).toBe(4);
  });

  it('renders topic markers as ticks positioned by startSec', () => {
    render(<LecturePlayer src="/lecture.mp4" title="Lecture 7" markers={markers} />);
    fakeMedia(document.querySelector('video')!, 1199.398);
    const ticks = screen.getAllByTestId('player-marker');
    expect(ticks).toHaveLength(5);
    expect(ticks[1].style.left).toBe(`${(221.199 / 1199.398) * 100}%`);
    expect(ticks[1].className).toContain('bg-accent');
    expect(ticks[1].getAttribute('title')).toBe('3:41 · Gradient descent and the learning rate');
  });

  it('falls back to <audio> for audio sources', () => {
    render(<LecturePlayer src="/lecture.mp3" title="Audio lecture" />);
    expect(document.querySelector('audio')).not.toBeNull();
    expect(document.querySelector('video')).toBeNull();
    cleanup();
    render(<LecturePlayer src="/media/123" mimeType="audio/mpeg" title="Audio lecture" />);
    expect(document.querySelector('audio')).not.toBeNull();
  });

  it('usePlayer lets any descendant seek without prop drilling', () => {
    function CitationButton() {
      const player = usePlayer();
      return <button onClick={() => player.seekTo(612.34)}>Jump to 10:12</button>;
    }
    function Page() {
      const [show] = useState(true);
      return (
        <PlayerProvider>
          {show && <LecturePlayer src="/lecture.mp4" title="Lecture 7" />}
          <div>
            <CitationButton />
          </div>
        </PlayerProvider>
      );
    }
    render(<Page />);
    const video = document.querySelector('video')!;
    fakeMedia(video, 1199.398);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to 10:12' }));
    expect(video.currentTime).toBe(612.34);
    expect(video.play).toHaveBeenCalled();
  });

  it('usePlayer throws outside a PlayerProvider', () => {
    function Bad() {
      usePlayer();
      return null;
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Bad />)).toThrow('usePlayer must be used inside <PlayerProvider>');
  });
});
