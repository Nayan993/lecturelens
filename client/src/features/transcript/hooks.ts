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

/**
 * PATCH /lectures/:id/segments/:index, optimistically: the edit shows immediately (with the same
 * originalText-set-once rule the server applies), rolls back if the request fails, and is replaced by
 * the server's segment when it succeeds.
 */
export function useUpdateSegment(lectureId: Id) {
  const queryClient = useQueryClient();
  const key = queryKeys.transcript(lectureId);
  return useMutation({
    mutationFn: ({ index, text }: { index: number; text: string }) => services.transcript.updateSegment(lectureId, index, text),
    onMutate: async ({ index, text }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Transcript>(key);
      queryClient.setQueryData<Transcript>(key, (old) =>
        old
          ? {
              ...old,
              items: old.items.map((s) =>
                s.index === index ? { ...s, text, corrected: true, originalText: s.corrected ? s.originalText : s.text } : s,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSuccess: (segment) => {
      queryClient.setQueryData<Transcript>(key, (old) =>
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
