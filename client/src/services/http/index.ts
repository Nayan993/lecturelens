import type { Services } from '../types';
import { httpAuthService } from './auth';
import { httpLectureService } from './lectures';
import { httpQuizService, httpRevisionService } from './quizzes';
import { httpQaService, httpSearchService } from './search';
import { httpSummaryService } from './summaries';
import { httpTopicService } from './topics';
import { httpTranscriptService } from './transcript';

/** Real-backend adapters. Routes not built yet reject with ApiRequestError 501 / 404 until P2.x. */
export const httpServices: Services = {
  auth: httpAuthService,
  lectures: httpLectureService,
  transcript: httpTranscriptService,
  topics: httpTopicService,
  summaries: httpSummaryService,
  search: httpSearchService,
  qa: httpQaService,
  quizzes: httpQuizService,
  revision: httpRevisionService,
};
