import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { services } from '../../services';
import { queryKeys } from '../../lib/queryKeys';
import type { CreateQuizPayload, GenerateQuestionsPayload, Id, ListQuestionsParams, ListQuizzesParams, SubmitAttemptPayload, UpdateQuestionPayload } from '../../types';

/** GET /questions — the teacher's question bank / review queue. */
export function useQuestions(params: ListQuestionsParams | undefined) {
  return useQuery({
    queryKey: queryKeys.questions.list(params ?? { lectureId: '' }),
    queryFn: () => services.quizzes.listQuestions(params!),
    enabled: Boolean(params?.lectureId),
    placeholderData: keepPreviousData,
  });
}

/** POST /lectures/:id/questions/generate — new questions arrive as pending_review. */
export function useGenerateQuestions(lectureId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: GenerateQuestionsPayload = {}) => services.quizzes.generateQuestions(lectureId, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.questions.all }),
  });
}

/** PATCH /questions/:id — edit, approve or reject. */
export function useUpdateQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...payload }: UpdateQuestionPayload & { id: Id }) => services.quizzes.updateQuestion(id, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.questions.all }),
  });
}

/** POST /quizzes — builds a quiz from approved questions and seeds its cache entry. */
export function useCreateQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateQuizPayload) => services.quizzes.create(payload),
    onSuccess: (quiz) => {
      queryClient.setQueryData(queryKeys.quizzes.detail(quiz.id), quiz);
      return queryClient.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
  });
}

/** GET /quizzes/:id. */
export function useQuiz(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.quizzes.detail(id ?? ''),
    queryFn: () => services.quizzes.get(id!),
    enabled: Boolean(id),
  });
}

/** POST /quizzes/:id/attempts. The server regenerates the revision plan, so that cache is refreshed too. */
export function useSubmitAttempt(quizId: Id) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SubmitAttemptPayload) => services.quizzes.submitAttempt(quizId, payload),
    onSuccess: (attempt) => {
      queryClient.setQueryData(queryKeys.attempts.detail(attempt.id), attempt);
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.revision.all }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.quizzes.all, 'list'] }),
      ]);
    },
  });
}

/** GET /attempts/:id. Attempts are immutable, so they never go stale. */
export function useAttempt(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.attempts.detail(id ?? ''),
    queryFn: () => services.quizzes.getAttempt(id!),
    enabled: Boolean(id),
    staleTime: Infinity,
  });
}

/** GET /quizzes — the caller's quizzes with coverage and best score. */
export function useQuizzes(params: ListQuizzesParams = {}) {
  return useQuery({
    queryKey: queryKeys.quizzes.list(params),
    queryFn: () => services.quizzes.list(params),
  });
}
