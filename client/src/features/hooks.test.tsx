// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { services } from '../services';
import { TOKEN_KEY } from '../lib/apiClient';
import { queryKeys } from '../lib/queryKeys';
import type { ProcessingStatus } from '../types';
import { STATUS_POLL_MS, useLectureStatus, useLectures } from './lectures/hooks';
import { useAsk } from './qa/hooks';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, Wrapper };
}

const status = (s: ProcessingStatus['status']): ProcessingStatus => ({
  lectureId: 'L',
  status: s,
  statusDetail: s,
  error: null,
  durationSec: null,
  progressPct: s === 'ready' ? 100 : 0,
  stages: [],
  updatedAt: '2026-10-27T10:03:12.517Z',
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLectureStatus', () => {
  it('polls every 3 s while processing and stops at ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const sequence = [status('transcribing'), status('chunking'), status('ready')];
    const getStatus = vi.spyOn(services.lectures, 'getStatus').mockImplementation(async () => sequence.shift() ?? status('ready'));
    const { client, Wrapper } = wrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    const { result } = renderHook(() => useLectureStatus('L'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('transcribing'));
    expect(getStatus).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));
    await waitFor(() => expect(result.current.data?.status).toBe('chunking'));
    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS));
    await waitFor(() => expect(result.current.data?.status).toBe('ready'));
    expect(getStatus).toHaveBeenCalledTimes(3);

    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 5));
    expect(getStatus).toHaveBeenCalledTimes(3); // polling stopped
    expect(invalidate).toHaveBeenCalledWith({ queryKey: queryKeys.lectures.detail('L') });
  });

  it('does not poll a lecture that is already failed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const getStatus = vi.spyOn(services.lectures, 'getStatus').mockResolvedValue(status('failed'));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useLectureStatus('L'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.status).toBe('failed'));
    await act(() => vi.advanceTimersByTimeAsync(STATUS_POLL_MS * 3));
    expect(getStatus).toHaveBeenCalledTimes(1);
  });
});

describe('hooks use `services` (mock adapter by default)', () => {
  it('useLectures returns typed fixture data', async () => {
    localStorage.setItem(TOKEN_KEY, await services.auth.login('teacher@lecturelens.dev', 'lecturelens').then((r) => r.token));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useLectures({ limit: 2 }), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ page: 1, limit: 2, total: 6 });
    expect(result.current.data!.items).toHaveLength(2);
  });

  it('useAsk resolves an abstained answer as data, not as an error', async () => {
    localStorage.setItem(TOKEN_KEY, await services.auth.login('student@lecturelens.dev', 'lecturelens').then((r) => r.token));
    const { Wrapper } = wrapper();
    const { result } = renderHook(() => useAsk(), { wrapper: Wrapper });
    await act(() => result.current.mutateAsync({ question: 'Who invented the transformer?' }));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.abstained).toBe(true);
    expect(result.current.error).toBeNull();
  });
});
