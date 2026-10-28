import { apiClient } from '../../lib/apiClient';
import type { LectureCollection, TopicSection } from '../../types';
import type { TopicService } from '../types';

export const httpTopicService: TopicService = {
  async list(lectureId) {
    return (await apiClient.get<LectureCollection<TopicSection>>(`/lectures/${lectureId}/topics`)).data;
  },
  async update(id, payload) {
    return (await apiClient.patch<{ topic: TopicSection }>(`/topics/${id}`, payload)).data.topic;
  },
  async approve(id) {
    return (await apiClient.post<{ topic: TopicSection }>(`/topics/${id}/approve`)).data.topic;
  },
  async reject(id, payload) {
    return (await apiClient.post<{ topic: TopicSection }>(`/topics/${id}/reject`, payload)).data.topic;
  },
};
