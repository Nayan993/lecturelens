import { apiClient } from '../../lib/apiClient';
import type { Lecture, Transcript, TranscriptSegment } from '../../types';
import type { TranscriptService } from '../types';

export const httpTranscriptService: TranscriptService = {
  async get(lectureId) {
    return (await apiClient.get<Transcript>(`/lectures/${lectureId}/transcript`)).data;
  },
  async updateSegment(lectureId, index, text) {
    return (await apiClient.patch<{ segment: TranscriptSegment }>(`/lectures/${lectureId}/segments/${index}`, { text })).data.segment;
  },
  async approve(lectureId) {
    return (await apiClient.post<{ lecture: Lecture }>(`/lectures/${lectureId}/transcript/approve`)).data.lecture;
  },
};
