/**
 * One interface per domain, with exactly the operations the UI needs. Every method maps to one
 * route in docs/CONTRACTS.md §5 and rejects with ApiRequestError (lib/apiClient.ts) on failure.
 * Both adapters (services/mock, services/http) implement these.
 */
import type {
  AskRequest,
  Attempt,
  AuthResponse,
  CreateQuizPayload,
  GenerateQuestionsPayload,
  GroundedAnswer,
  Id,
  Lecture,
  LectureCollection,
  LectureDetail,
  ListLecturesParams,
  ListQuestionsParams,
  ListQuizzesParams,
  Paginated,
  ProcessingStatus,
  Question,
  Quiz,
  QuizSummary,
  RegisterPayload,
  RejectPayload,
  RevisionPlan,
  SearchRequest,
  SearchResponse,
  StageName,
  SubmitAttemptPayload,
  Summary,
  TopicSection,
  Transcript,
  TranscriptSegment,
  UpdateProfilePayload,
  UpdateQuestionPayload,
  UpdateSummaryPayload,
  UpdateTopicPayload,
  User,
} from '../types';

export interface AuthService {
  /** POST /auth/login */
  login(email: string, password: string): Promise<AuthResponse>;
  /** POST /auth/register */
  register(payload: RegisterPayload): Promise<AuthResponse>;
  /** GET /auth/me — with an explicit token, so AuthContext can validate a stored one. */
  me(token: string): Promise<User>;
  /** PATCH /users/me */
  updateProfile(payload: UpdateProfilePayload): Promise<User>;
}

export interface LectureService {
  /** GET /lectures */
  list(params?: ListLecturesParams): Promise<Paginated<Lecture>>;
  /** GET /lectures/:id */
  get(id: Id): Promise<LectureDetail>;
  /** GET /lectures/:id/status */
  getStatus(id: Id): Promise<ProcessingStatus>;
  /** POST /lectures (multipart: file, title, courseCode?, description?, lecturerConsent, purposeShown, processorNamed) */
  create(form: FormData): Promise<Lecture>;
  /** DELETE /lectures/:id */
  remove(id: Id): Promise<void>;
  /** POST /lectures/:id/reprocess */
  reprocess(id: Id, fromStage?: StageName): Promise<Lecture>;
}

export interface TranscriptService {
  /** GET /lectures/:id/transcript */
  get(lectureId: Id): Promise<Transcript>;
  /** PATCH /lectures/:id/segments/:index */
  updateSegment(lectureId: Id, index: number, text: string): Promise<TranscriptSegment>;
  /** POST /lectures/:id/transcript/approve */
  approve(lectureId: Id): Promise<Lecture>;
}

export interface TopicService {
  /** GET /lectures/:id/topics */
  list(lectureId: Id): Promise<LectureCollection<TopicSection>>;
  /** PATCH /topics/:id */
  update(id: Id, payload: UpdateTopicPayload): Promise<TopicSection>;
  /** POST /topics/:id/approve */
  approve(id: Id): Promise<TopicSection>;
  /** POST /topics/:id/reject */
  reject(id: Id, payload: RejectPayload): Promise<TopicSection>;
}

export interface SummaryService {
  /** GET /lectures/:id/summaries */
  list(lectureId: Id): Promise<LectureCollection<Summary>>;
  /** PATCH /summaries/:id */
  update(id: Id, payload: UpdateSummaryPayload): Promise<Summary>;
  /** POST /summaries/:id/approve */
  approve(id: Id): Promise<Summary>;
  /** POST /summaries/:id/reject */
  reject(id: Id, payload: RejectPayload): Promise<Summary>;
}

export interface SearchService {
  /** POST /search */
  search(request: SearchRequest): Promise<SearchResponse>;
}

export interface QaService {
  /** POST /ask — abstaining resolves normally (HTTP 200) with abstained: true. */
  ask(request: AskRequest): Promise<GroundedAnswer>;
}

/** Question bank (teacher review), quizzes and attempts. */
export interface QuizService {
  /** GET /questions */
  listQuestions(params: ListQuestionsParams): Promise<Paginated<Question>>;
  /** POST /lectures/:id/questions/generate */
  generateQuestions(lectureId: Id, payload?: GenerateQuestionsPayload): Promise<Question[]>;
  /** PATCH /questions/:id */
  updateQuestion(id: Id, payload: UpdateQuestionPayload): Promise<Question>;
  /** GET /quizzes — the caller's quizzes with best scores. */
  list(params?: ListQuizzesParams): Promise<Paginated<QuizSummary>>;
  /** POST /quizzes */
  create(payload: CreateQuizPayload): Promise<Quiz>;
  /** GET /quizzes/:id */
  get(id: Id): Promise<Quiz>;
  /** POST /quizzes/:id/attempts */
  submitAttempt(quizId: Id, payload: SubmitAttemptPayload): Promise<Attempt>;
  /** GET /attempts/:id */
  getAttempt(id: Id): Promise<Attempt>;
}

export interface RevisionService {
  /** GET /revision-plan — null when the student has no attempts yet. */
  getPlan(lectureId?: Id): Promise<RevisionPlan | null>;
}

export interface Services {
  auth: AuthService;
  lectures: LectureService;
  transcript: TranscriptService;
  topics: TopicService;
  summaries: SummaryService;
  search: SearchService;
  qa: QaService;
  quizzes: QuizService;
  revision: RevisionService;
}

export type ServiceDomain = keyof Services;

export const SERVICE_DOMAINS: readonly ServiceDomain[] = [
  'auth',
  'lectures',
  'transcript',
  'topics',
  'summaries',
  'search',
  'qa',
  'quizzes',
  'revision',
];
