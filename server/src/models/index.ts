/** All LectureLens models (docs/CONTRACTS.md §4). Owned by Member D. */
export * from './enums.js';
export { APPROVED, type ApprovalQueryHelpers, type Evidence, type ReviewFields } from './shared.js';
export { User, type IUser } from './User.js';
export {
  Lecture,
  LECTURE_SERVER_ONLY,
  initialStages,
  type ILecture,
  type LectureConsent,
  type LectureError,
  type LectureMedia,
  type LectureProvider,
  type ProcessingStage,
} from './Lecture.js';
export { TranscriptSegment, type ITranscriptSegment } from './TranscriptSegment.js';
export { Chunk, EMBEDDING_DIMENSIONS, type IChunk } from './Chunk.js';
export { TopicSection, type ITopicSection, type TopicSectionModel } from './TopicSection.js';
export { Summary, type ISummary, type SummaryModel } from './Summary.js';
export { Question, type IQuestion, type QuestionModel, type QuestionOption } from './Question.js';
export { Quiz, type IQuiz } from './Quiz.js';
export {
  Attempt,
  type AttemptAnswer,
  type AttemptScore,
  type AttemptTopicScore,
  type IAttempt,
} from './Attempt.js';
export { RevisionRecommendation, type IRevisionRecommendation, type RevisionItem } from './RevisionRecommendation.js';
export { LlmCache, type ILlmCache } from './LlmCache.js';
