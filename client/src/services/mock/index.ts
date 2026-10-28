import type { Services } from '../types';
import { mockAuthService } from './auth';
import { mockSummaryService, mockTopicService, mockTranscriptService } from './content';
import { mockLectureService } from './lectures';
import { mockQuizService, mockRevisionService } from './quizzes';
import { mockQaService, mockSearchService } from './search';

/** Fixture-backed adapters (see services/mock/db.ts). Demo login: teacher@ / student@lecturelens.dev, "lecturelens". */
export const mockServices: Services = {
  auth: mockAuthService,
  lectures: mockLectureService,
  transcript: mockTranscriptService,
  topics: mockTopicService,
  summaries: mockSummaryService,
  search: mockSearchService,
  qa: mockQaService,
  quizzes: mockQuizService,
  revision: mockRevisionService,
};
