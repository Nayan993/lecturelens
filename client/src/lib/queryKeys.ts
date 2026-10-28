import type { Id, ListLecturesParams, ListQuestionsParams, ListQuizzesParams, SearchRequest } from '../types';

/**
 * Every TanStack Query key in the app. Keys are hierarchical so a prefix invalidates a family,
 * e.g. invalidateQueries({ queryKey: queryKeys.lectures.all }) refreshes lists, details and statuses.
 */
export const queryKeys = {
  lectures: {
    all: ['lectures'] as const,
    lists: () => [...queryKeys.lectures.all, 'list'] as const,
    list: (params: ListLecturesParams = {}) => [...queryKeys.lectures.lists(), params] as const,
    detail: (id: Id) => [...queryKeys.lectures.all, 'detail', id] as const,
    status: (id: Id) => [...queryKeys.lectures.all, 'status', id] as const,
  },
  transcript: (lectureId: Id) => ['transcript', lectureId] as const,
  topics: (lectureId: Id) => ['topics', lectureId] as const,
  summaries: (lectureId: Id) => ['summaries', lectureId] as const,
  search: (request: SearchRequest) => ['search', request] as const,
  questions: {
    all: ['questions'] as const,
    list: (params: ListQuestionsParams) => [...queryKeys.questions.all, params] as const,
  },
  quizzes: {
    all: ['quizzes'] as const,
    list: (params: ListQuizzesParams = {}) => ['quizzes', 'list', params] as const,
    detail: (id: Id) => ['quizzes', 'detail', id] as const,
  },
  attempts: {
    detail: (id: Id) => ['attempts', id] as const,
  },
  revision: {
    all: ['revision'] as const,
    plan: (lectureId?: Id) => [...queryKeys.revision.all, lectureId ?? 'all'] as const,
  },
};
