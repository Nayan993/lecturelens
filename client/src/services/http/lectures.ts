import { apiClient } from '../../lib/apiClient';
import type { Lecture, Paginated, ProcessingStatus } from '../../types';
import type { LectureService } from '../types';

export const httpLectureService: LectureService = {
  async list(params) {
    return (await apiClient.get<Paginated<Lecture>>('/lectures', { params })).data;
  },
  async get(id) {
    const { lecture, mediaUrl } = (await apiClient.get<{ lecture: Lecture; mediaUrl: string }>(`/lectures/${id}`)).data;
    return { ...lecture, mediaUrl };
  },
  async getStatus(id) {
    return (await apiClient.get<ProcessingStatus>(`/lectures/${id}/status`)).data;
  },
  async create(form) {
    // Let the browser set the multipart boundary; uploads can be large, so no timeout.
    return (await apiClient.post<{ lecture: Lecture }>('/lectures', form, { timeout: 0 })).data.lecture;
  },
  async remove(id) {
    await apiClient.delete(`/lectures/${id}`);
  },
  async reprocess(id, fromStage) {
    return (await apiClient.post<{ lecture: Lecture }>(`/lectures/${id}/reprocess`, fromStage ? { fromStage } : {})).data.lecture;
  },
};
