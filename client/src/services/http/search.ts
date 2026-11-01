import { apiClient, LLM_REQUEST_TIMEOUT_MS } from '../../lib/apiClient';
import type { GroundedAnswer, SearchResponse } from '../../types';
import type { QaService, SearchService } from '../types';

export const httpSearchService: SearchService = {
  async search(request) {
    return (await apiClient.post<SearchResponse>('/search', request)).data;
  },
};

export const httpQaService: QaService = {
  async ask(request) {
    // The server may wait out short provider rate limits (up to ~1 min) before answering; a client
    // timeout here would make the student re-ask and spend the same quota twice.
    return (await apiClient.post<GroundedAnswer>('/ask', request, { timeout: LLM_REQUEST_TIMEOUT_MS })).data;
  },
};
