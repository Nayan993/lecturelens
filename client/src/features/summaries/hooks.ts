import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { Id, LectureCollection, RejectPayload, Summary, UpdateSummaryPayload } from '../../types';

/** GET /lectures/:id/summaries (students receive approved summaries only). */
export function useSummaries(lectureId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.summaries(lectureId ?? ''),
    queryFn: () => services.summaries.list(lectureId!),
    enabled: Boolean(lectureId),
  });
}

function useSummaryMutation<V>(lectureId: Id, fn: (vars: V) => Promise<Summary>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (summary) =>
      queryClient.setQueryData<LectureCollection<Summary>>(queryKeys.summaries(lectureId), (old) =>
        old ? { ...old, items: old.items.map((s) => (s.id === summary.id ? summary : s)) } : old,
      ),
  });
}

/** PATCH /summaries/:id. */
export const useUpdateSummary = (lectureId: Id) =>
  useSummaryMutation(lectureId, ({ id, ...payload }: UpdateSummaryPayload & { id: Id }) => services.summaries.update(id, payload));

/** POST /summaries/:id/approve. */
export const useApproveSummary = (lectureId: Id) => useSummaryMutation(lectureId, (id: Id) => services.summaries.approve(id));

/** POST /summaries/:id/reject. */
export const useRejectSummary = (lectureId: Id) =>
  useSummaryMutation(lectureId, ({ id, ...payload }: RejectPayload & { id: Id }) => services.summaries.reject(id, payload));
