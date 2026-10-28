import { apiClient } from '../../lib/apiClient';
import type { Attempt, Paginated, Question, Quiz, QuizSummary, RevisionPlan } from '../../types';
import type { QuizService, RevisionService } from '../types';

export const httpQuizService: QuizService = {
  async listQuestions(params) {
    return (await apiClient.get<Paginated<Question>>('/questions', { params })).data;
  },
  async generateQuestions(lectureId, payload = {}) {
    return (await apiClient.post<{ items: Question[] }>(`/lectures/${lectureId}/questions/generate`, payload)).data.items;
  },
  async updateQuestion(id, payload) {
    return (await apiClient.patch<{ question: Question }>(`/questions/${id}`, payload)).data.question;
  },
  async list(params) {
    return (await apiClient.get<Paginated<QuizSummary>>('/quizzes', { params })).data;
  },
  async create(payload) {
    return (await apiClient.post<{ quiz: Quiz }>('/quizzes', payload)).data.quiz;
  },
  async get(id) {
    return (await apiClient.get<{ quiz: Quiz }>(`/quizzes/${id}`)).data.quiz;
  },
  async submitAttempt(quizId, payload) {
    return (await apiClient.post<{ attempt: Attempt }>(`/quizzes/${quizId}/attempts`, payload)).data.attempt;
  },
  async getAttempt(id) {
    return (await apiClient.get<{ attempt: Attempt }>(`/attempts/${id}`)).data.attempt;
  },
};

export const httpRevisionService: RevisionService = {
  async getPlan(lectureId) {
    const params = lectureId ? { lectureId } : undefined;
    return (await apiClient.get<{ plan: RevisionPlan | null }>('/revision-plan', { params })).data.plan;
  },
};
