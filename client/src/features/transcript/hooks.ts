import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { Id, Transcript } from '../../types';

/** GET /lectures/:id/transcript. Students get 403 TRANSCRIPT_NOT_APPROVED until the teacher approves. */
export function useTranscript(lectureId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.transcript(lectureId ?? ''),
    queryFn: () => services.transcript.get(lectureId!),
    enabled: Boolean(lectureId),
  });
}

/** PATCH /lectures/:id/segments/:index — writes the corrected segment straight into the cached transcript. */
export function useUpdateSegment(lectureId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ index, text }: { index: number; text: string }) => services.transcript.updateSegment(lectureId, index, text),
    onSuccess: (segment) => {
      queryClient.setQueryData<Transcript>(queryKeys.transcript(lectureId), (old) =>
        old ? { ...old, items: old.items.map((s) => (s.index === segment.index ? segment : s)) } : old,
      );
    },
  });
}

/** POST /lectures/:id/transcript/approve. */
export function useApproveTranscript(lectureId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => services.transcript.approve(lectureId),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.transcript(lectureId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.lectures.all }),
      ]),
  });
}
