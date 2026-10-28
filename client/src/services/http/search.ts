import { apiClient } from '../../lib/apiClient';
import type { GroundedAnswer, SearchResponse } from '../../types';
import type { QaService, SearchService } from '../types';

export const httpSearchService: SearchService = {
  async search(request) {
    return (await apiClient.post<SearchResponse>('/search', request)).data;
  },
};

export const httpQaService: QaService = {
  async ask(request) {
    return (await apiClient.post<GroundedAnswer>('/ask', request)).data;
  },
};
