import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui';
import { isApiError, isNotImplemented } from '../../lib/apiClient';
import { queryKeys } from '../../lib/queryKeys';
import { services } from '../../services';
import type {
  Id,
  Lecture,
  LectureCollection,
  ListQuestionsParams,
  Paginated,
  Question,
  RejectPayload,
  Summary,
  TopicSection,
  UpdateQuestionPayload,
  UpdateSummaryPayload,
} from '../../types';
import { useLectures } from '../lectures/hooks';
import { useTopicsForLectures } from '../topics/hooks';

export const pendingQuestionsParams = (lectureId: Id): ListQuestionsParams => ({ lectureId, status: 'pending_review', limit: 100 });

export interface PendingSummary {
  kind: 'summary';
  summary: Summary;
  lecture: Lecture;
  topic?: TopicSection;
}

export interface PendingQuestion {
  kind: 'question';
  question: Question;
  lecture: Lecture;
  topic?: TopicSection;
}

/**
 * Everything awaiting the teacher's review, across their ready lectures. There is no review-queue
 * endpoint in the contract, so this combines per-lecture summaries + pending questions. Fine at
 * course scale; a dedicated endpoint would replace it if a teacher had many lectures.
 * Lectures with no content yet (404) are skipped, not treated as errors.
 */
export function useReviewQueue() {
  const lecturesQ = useLectures({ limit: 100 });
  const lectures = (lecturesQ.data?.items ?? []).filter((l) => l.status === 'ready');
  const ids = lectures.map((l) => l.id);

  const summaryQs = useQueries({
    queries: ids.map((id) => ({ queryKey: queryKeys.summaries(id), queryFn: () => services.summaries.list(id), retry: false })),
  });
  const questionQs = useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.questions.list(pendingQuestionsParams(id)),
      queryFn: () => services.quizzes.listQuestions(pendingQuestionsParams(id)),
      retry: false,
    })),
  });
  const topics = useTopicsForLectures(ids);

  const byId = new Map(lectures.map((l) => [l.id, l]));
  const topicOf = new Map(topics.map((t) => [t.id, t]));
  const summaries: PendingSummary[] = summaryQs
    .flatMap((q) => q.data?.items ?? [])
    .flatMap((summary) => {
      const lecture = byId.get(summary.lectureId);
      return summary.status === 'pending_review' && lecture ? [{ kind: 'summary' as const, summary, lecture, topic: topicOf.get(summary.topicId) }] : [];
    });
  const questions: PendingQuestion[] = questionQs
    .flatMap((q) => q.data?.items ?? [])
    .flatMap((question) => {
      const lecture = byId.get(question.lectureId);
      return question.status === 'pending_review' && lecture ? [{ kind: 'question' as const, question, lecture, topic: topicOf.get(question.topicId) }] : [];
    });

  const pendingCount = new Map<Id, number>();
  for (const item of [...summaries, ...questions]) pendingCount.set(item.lecture.id, (pendingCount.get(item.lecture.id) ?? 0) + 1);

  const errors = [lecturesQ.error, ...summaryQs.map((q) => q.error), ...questionQs.map((q) => q.error)].filter(
    (e): e is Error => e !== null && !(isApiError(e) && e.status === 404),
  );
  return {
    lectures,
    summaries,
    questions,
    pendingCount,
    total: summaries.length + questions.length,
    isPending: lecturesQ.isPending || summaryQs.some((q) => q.isPending) || questionQs.some((q) => q.isPending),
    notImplemented: errors.length > 0 && errors.every(isNotImplemented),
    error: errors[0] ?? null,
    refetch: () => Promise.all([lecturesQ.refetch(), ...summaryQs.map((q) => q.refetch()), ...questionQs.map((q) => q.refetch())]),
  };
}

export type SummaryChange =
  | { action: 'approve'; summary: Summary }
  | { action: 'reject'; summary: Summary; payload: RejectPayload }
  | { action: 'edit'; summary: Summary; payload: UpdateSummaryPayload };

export type SummaryAction = SummaryChange & { successMessage: string };

/**
 * Approve / reject / edit a summary, optimistically, rolling back on error. Toasts are raised here,
 * not in mutate() callbacks: the card unmounts as soon as the optimistic update removes it from the
 * queue, and TanStack Query skips per-call callbacks for unmounted components.
 */
export function useSummaryReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (a: SummaryAction) =>
      a.action === 'approve'
        ? services.summaries.approve(a.summary.id)
        : a.action === 'reject'
          ? services.summaries.reject(a.summary.id, a.payload)
          : services.summaries.update(a.summary.id, a.payload),
    onMutate: async (a) => {
      const key = queryKeys.summaries(a.summary.lectureId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<LectureCollection<Summary>>(key);
      const patch: Partial<Summary> =
        a.action === 'approve'
          ? { status: 'approved', rejectionReason: null }
          : a.action === 'reject'
            ? { status: 'rejected', rejectionReason: a.payload.rejectionReason, reviewNote: a.payload.reviewNote ?? null }
            : a.payload;
      queryClient.setQueryData<LectureCollection<Summary>>(key, (old) =>
        old ? { ...old, items: old.items.map((s) => (s.id === a.summary.id ? { ...s, ...patch } : s)) } : old,
      );
      return { key, previous };
    },
    onError: (err, _a, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ variant: 'error', title: 'Change undone', description: err.message });
    },
    onSuccess: (saved, a) => {
      queryClient.setQueryData<LectureCollection<Summary>>(queryKeys.summaries(a.summary.lectureId), (old) =>
        old ? { ...old, items: old.items.map((s) => (s.id === saved.id ? saved : s)) } : old,
      );
      toast({ variant: 'success', title: a.successMessage });
    },
  });
}

/** Approve / reject / edit a pending question (PATCH /questions/:id), optimistically, rolling back on error. */
export function useQuestionReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: ({ question, patch }: { question: Question; patch: UpdateQuestionPayload; successMessage: string }) =>
      services.quizzes.updateQuestion(question.id, patch),
    onMutate: async ({ question, patch }) => {
      const key = queryKeys.questions.list(pendingQuestionsParams(question.lectureId));
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Paginated<Question>>(key);
      const leavesQueue = patch.status !== undefined && patch.status !== 'pending_review';
      queryClient.setQueryData<Paginated<Question>>(key, (old) =>
        old
          ? {
              ...old,
              items: leavesQueue ? old.items.filter((q) => q.id !== question.id) : old.items.map((q) => (q.id === question.id ? { ...q, ...patch } as Question : q)),
              total: leavesQueue ? old.total - 1 : old.total,
            }
          : old,
      );
      return { key, previous };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.key, ctx.previous);
      toast({ variant: 'error', title: 'Change undone', description: err.message });
    },
    onSuccess: (_q, v) => toast({ variant: 'success', title: v.successMessage }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.questions.all }),
  });
}
