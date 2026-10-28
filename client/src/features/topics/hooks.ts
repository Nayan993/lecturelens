import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { Id, LectureCollection, RejectPayload, TopicSection, UpdateTopicPayload } from '../../types';

/** GET /lectures/:id/topics (students receive approved topics only). */
export function useTopics(lectureId: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.topics(lectureId ?? ''),
    queryFn: () => services.topics.list(lectureId!),
    enabled: Boolean(lectureId),
  });
}

function useTopicMutation<V>(lectureId: Id, fn: (vars: V) => Promise<TopicSection>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (topic) =>
      queryClient.setQueryData<LectureCollection<TopicSection>>(queryKeys.topics(lectureId), (old) =>
        old ? { ...old, items: old.items.map((t) => (t.id === topic.id ? topic : t)) } : old,
      ),
  });
}

/** PATCH /topics/:id — label / keywords. */
export const useUpdateTopic = (lectureId: Id) =>
  useTopicMutation(lectureId, ({ id, ...payload }: UpdateTopicPayload & { id: Id }) => services.topics.update(id, payload));

/** POST /topics/:id/approve. */
export const useApproveTopic = (lectureId: Id) => useTopicMutation(lectureId, (id: Id) => services.topics.approve(id));

/** POST /topics/:id/reject. */
export const useRejectTopic = (lectureId: Id) =>
  useTopicMutation(lectureId, ({ id, ...payload }: RejectPayload & { id: Id }) => services.topics.reject(id, payload));
