import { apiClient } from '../../lib/apiClient';
import type { LectureCollection, Summary } from '../../types';
import type { SummaryService } from '../types';

export const httpSummaryService: SummaryService = {
  async list(lectureId) {
    return (await apiClient.get<LectureCollection<Summary>>(`/lectures/${lectureId}/summaries`)).data;
  },
  async update(id, payload) {
    return (await apiClient.patch<{ summary: Summary }>(`/summaries/${id}`, payload)).data.summary;
  },
  async approve(id) {
    return (await apiClient.post<{ summary: Summary }>(`/summaries/${id}/approve`)).data.summary;
  },
  async reject(id, payload) {
    return (await apiClient.post<{ summary: Summary }>(`/summaries/${id}/reject`, payload)).data.summary;
  },
};
