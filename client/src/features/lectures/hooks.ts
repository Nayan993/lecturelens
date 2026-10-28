import { useEffect } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { Id, ListLecturesParams, ProcessingStatus, StageName } from '../../types';

/** Poll interval for a lecture that is still processing. */
export const STATUS_POLL_MS = 3000;

export const isTerminalStatus = (status: ProcessingStatus['status'] | undefined) => status === 'ready' || status === 'failed';

/** GET /lectures (paginated). Keeps the previous page on screen while the next one loads. */
export function useLectures(params: ListLecturesParams = {}) {
  return useQuery({
    queryKey: queryKeys.lectures.list(params),
    queryFn: () => services.lectures.list(params),
    placeholderData: keepPreviousData,
  });
}

/** GET /lectures/:id (includes the signed mediaUrl). */
export function useLecture(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.lectures.detail(id ?? ''),
    queryFn: () => services.lectures.get(id!),
    enabled: Boolean(id),
  });
}

/**
 * GET /lectures/:id/status, polled every 3 s while the lecture is processing. Polling stops once
 * the status is `ready` or `failed` (or the request errors), and the lecture's detail and lists
 * are refreshed so the rest of the UI picks up the final state.
 */
export function useLectureStatus(id: Id | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.lectures.status(id ?? ''),
    queryFn: () => services.lectures.getStatus(id!),
    enabled: Boolean(id),
    refetchInterval: (q) => (q.state.status === 'error' || isTerminalStatus(q.state.data?.status) ? false : STATUS_POLL_MS),
    refetchIntervalInBackground: false,
  });

  const status = query.data?.status;
  useEffect(() => {
    if (id && isTerminalStatus(status)) {
      void queryClient.invalidateQueries({ queryKey: queryKeys.lectures.detail(id) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.lectures.lists() });
    }
  }, [id, status, queryClient]);

  return query;
}

/** POST /lectures (multipart). */
export function useCreateLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => services.lectures.create(form),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.lectures.lists() }),
  });
}

/** DELETE /lectures/:id. */
export function useDeleteLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: Id) => services.lectures.remove(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.lectures.detail(id) });
      queryClient.removeQueries({ queryKey: queryKeys.lectures.status(id) });
      return queryClient.invalidateQueries({ queryKey: queryKeys.lectures.lists() });
    },
  });
}

/** POST /lectures/:id/reprocess. Restarts status polling. */
export function useReprocessLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fromStage }: { id: Id; fromStage?: StageName }) => services.lectures.reprocess(id, fromStage),
    onSuccess: (_lecture, { id }) => queryClient.invalidateQueries({ queryKey: queryKeys.lectures.all, predicate: (q) => q.queryKey.includes(id) || q.queryKey[1] === 'list' }),
  });
}
