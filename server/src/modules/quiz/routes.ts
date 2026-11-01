import { Router } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/asyncHandler.js';
import { objectIdParams } from '../../middleware/objectIdParams.js';
import { requireRole } from '../../middleware/rbac.js';
import { validate } from '../../middleware/validate.js';
import {
  DIFFICULTIES,
  OPTION_IDS,
  REJECTION_REASONS,
  REVIEW_STATUSES,
  Lecture,
  Question,
} from '../../models/index.js';
import {
  generateQuestions,
  NoApprovedTopicsError,
  QuestionProviderError,
} from '../../services/learning/questionGenerator.js';
import {
  createQuiz,
  findAccessibleQuiz,
  findOwnAttempt,
  listQuizzes,
  presentAttempt,
  presentQuiz,
  submitAttempt,
} from '../../services/learning/quizzes.js';
import { getLlmClient, llmModelName } from '../../services/llm/client.js';
import { conflict, notFound, providerUnavailable, unauthenticated, validationFailed } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import { objectIdString, paging } from '../../utils/schemas.js';
import { findOwned } from '../lectures/lectures.service.js';

/**
 * Questions, quizzes and attempts — owner C, PC.3 — CONTRACTS.md §5.7. Students only ever get
 * approved questions, without answer keys before submission; ownership is checked in handlers.
 */
export const quizRouter = Router();

const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { errorMap: () => ({ message: `Must be one of ${values.join(', ')}` }) });

const int = (min: number, max: number) =>
  z.number({ invalid_type_error: `Must be an integer ${min}–${max}` })
    .int(`Must be an integer ${min}–${max}`)
    .min(min, `Must be an integer ${min}–${max}`)
    .max(max, `Must be an integer ${min}–${max}`);

const generateBody = z
  .object({
    count: int(1, 20).default(5),
    topicIds: z.array(objectIdString).optional(),
    difficulty: oneOf(DIFFICULTIES).optional(),
  })
  .strict();

const questionsQuery = z.object({
  lectureId: objectIdString,
  status: oneOf(REVIEW_STATUSES).optional(),
  topicId: objectIdString.optional(),
  ...paging,
});

const updateQuestionBody = z
  .object({
    stem: z.string().trim().min(1, 'Must not be empty').optional(),
    options: z
      .array(
        z.object({
          id: oneOf(OPTION_IDS),
          text: z.string().trim().min(1, 'Must not be empty'),
        }).strict(),
      )
      .length(4, 'Must be exactly four options')
      .refine(
        (o) => o.every((opt, i) => opt.id === OPTION_IDS[i]),
        'Option ids must be a, b, c, d in order',
      )
      .optional(),
    correctOptionId: oneOf(OPTION_IDS).optional(),
    explanation: z.string().trim().min(1, 'Must not be empty').optional(),
    difficulty: oneOf(DIFFICULTIES).optional(),
    status: oneOf(REVIEW_STATUSES).optional(),
    rejectionReason: oneOf(REJECTION_REASONS).nullable().optional(),
    reviewNote: z.string().trim().max(2000, 'Must be at most 2000 characters').nullable().optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Send at least one field to change')
  .refine((b) => b.status !== 'rejected' || b.rejectionReason, {
    path: ['rejectionReason'],
    message: 'Required when status is "rejected"',
  });

const createQuizBody = z
  .object({
    lectureId: objectIdString,
    topicIds: z.array(objectIdString).optional(),
    questionCount: int(1, 20).default(10),
  })
  .strict();

const quizzesQuery = z.object({ lectureId: objectIdString.optional(), ...paging });

const attemptBody = z
  .object({
    startedAt: z.string({ required_error: 'Required' })
      .datetime({ message: 'Must be an ISO 8601 date-time' }),
    answers: z
      .array(
        z.object({
          questionId: objectIdString,
          selectedOptionId: oneOf(OPTION_IDS).nullable(),
        }).strict(),
      )
      .min(1, 'Must answer every quiz question'),
  })
  .strict();

const viewerOf = (req: { user?: { id: string; role: 'student' | 'teacher' } }) => {
  if (!req.user) throw unauthenticated();
  return req.user;
};

/** Fields whose change makes an approved question pending again (§5.7). */
const CONTENT_FIELDS = ['stem', 'options', 'correctOptionId', 'explanation', 'difficulty'] as const;

quizRouter.post(
  '/lectures/:id/questions/generate',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ body: generateBody }),
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const lecture = await findOwned(String(req.params.id), viewer);
    if (lecture.status !== 'ready') throw conflict('Questions can only be generated for a ready lecture.', { status: lecture.status });
    const llm = getLlmClient();
    if (!llm) throw providerUnavailable('llm-not-configured');
    const body = req.body as z.infer<typeof generateBody>;

    let report;
    try {
      report = await generateQuestions({
        lectureId: lecture.id, count: body.count, topicIds: body.topicIds, difficulty: body.difficulty, llm, model: llmModelName(),
      });
    } catch (error) {
      if (error instanceof NoApprovedTopicsError) {
        throw validationFailed({ topicIds: 'No approved topic sections to generate questions from; approve topics first' });
      }
      if (error instanceof QuestionProviderError) {
        logger.error('Question generation: LLM provider unavailable', { lectureId: lecture.id, error, retryAfterSec: error.retryAfterSec });
        if (error.retryAfterSec !== null) res.set('Retry-After', String(Math.ceil(error.retryAfterSec)));
        throw providerUnavailable('llm', error.retryAfterSec);
      }
      throw error;
    }
    logger.info('Questions generated', {
      lectureId: lecture.id, requested: body.count, created: report.created.length,
      discardedUnlocatable: report.discardedUnlocatable, failedTopics: report.failedTopics,
    });
    // All pending_review (§5.7): a teacher must approve each before any student can see it.
    res.status(201).json({ items: report.created.map((q) => q.toJSON()) });
  }),
);

quizRouter.get(
  '/questions',
  requireAuth,
  requireRole('teacher'),
  validate({ query: questionsQuery }),
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const query = req.query as unknown as z.infer<typeof questionsQuery>;
    const lecture = await findOwned(query.lectureId, viewer); // the review queue of OWN lectures only
    const filter = {
      lectureId: lecture._id,
      ...(query.status ? { status: query.status } : {}),
      ...(query.topicId ? { topicId: query.topicId } : {}),
    };
    const [items, total] = await Promise.all([
      Question.find(filter).sort({ createdAt: -1, _id: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
      Question.countDocuments(filter),
    ]);
    res.json({ items: items.map((q) => q.toJSON()), page: query.page, limit: query.limit, total });
  }),
);

quizRouter.patch(
  '/questions/:id',
  requireAuth,
  requireRole('teacher'),
  objectIdParams('id'),
  validate({ body: updateQuestionBody }),
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const question = await Question.findById(req.params.id);
    // Owner-only: another teacher's question is a 404, existence not revealed (§1.6).
    if (!question || !(await Lecture.exists({ _id: question.lectureId, uploadedBy: viewer.id }))) throw notFound('Question');
    const body = req.body as z.infer<typeof updateQuestionBody>;

    const contentChanged = CONTENT_FIELDS.some((f) => body[f] !== undefined);
    if (body.stem !== undefined) question.stem = body.stem;
    if (body.options !== undefined) question.options = body.options;
    if (body.correctOptionId !== undefined) question.correctOptionId = body.correctOptionId;
    if (body.explanation !== undefined) question.explanation = body.explanation;
    if (body.difficulty !== undefined) question.difficulty = body.difficulty;
    if (body.reviewNote !== undefined) question.reviewNote = body.reviewNote;

    if (body.status !== undefined) {
      // Rejection needs a CONTRACTS enum reason (validated above → 422); approval clears it.
      question.status = body.status;
      question.rejectionReason = body.status === 'rejected' ? body.rejectionReason ?? null : null;
      question.reviewedBy = new Types.ObjectId(viewer.id);
      question.reviewedAt = new Date();
    } else if (body.rejectionReason !== undefined) {
      if (question.status !== 'rejected') throw validationFailed({ rejectionReason: 'Only a rejected question has a rejection reason' });
      if (body.rejectionReason === null) throw validationFailed({ rejectionReason: 'Required when status is "rejected"' });
      question.rejectionReason = body.rejectionReason;
    } else if (contentChanged && question.status === 'approved') {
      // Editing an approved question's content sends it back for review (§5.7).
      question.status = 'pending_review';
      question.reviewedBy = null;
      question.reviewedAt = null;
    }
    await question.save();
    res.json({ question: question.toJSON() });
  }),
);

quizRouter.post(
  '/quizzes',
  requireAuth,
  validate({ body: createQuizBody }),
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const quiz = await createQuiz(req.body as z.infer<typeof createQuizBody>, viewer);
    const lecture = await Lecture.findById(quiz.lectureId).select('uploadedBy');
    res.status(201).json({ quiz: await presentQuiz(quiz, lecture!, viewer) });
  }),
);

quizRouter.get(
  '/quizzes',
  requireAuth,
  validate({ query: quizzesQuery }),
  asyncHandler(async (req, res) => {
    res.json(await listQuizzes(req.query as unknown as z.infer<typeof quizzesQuery>, viewerOf(req)));
  }),
);

// The quiz's creator, or the lecture's owner (§5.7); others 404. Students never get answer keys.
quizRouter.get(
  '/quizzes/:id',
  requireAuth,
  objectIdParams('id'),
  asyncHandler(async (req, res) => {
    const viewer = viewerOf(req);
    const { quiz, lecture } = await findAccessibleQuiz(String(req.params.id), viewer);
    res.json({ quiz: await presentQuiz(quiz, lecture, viewer) });
  }),
);

// Any signed-in user may submit (CONTRACTS.md §1.6: teachers can do everything students can).
quizRouter.post(
  '/quizzes/:id/attempts',
  requireAuth,
  objectIdParams('id'),
  validate({ body: attemptBody }),
  asyncHandler(async (req, res) => {
    const attempt = await submitAttempt(String(req.params.id), req.body as z.infer<typeof attemptBody>, viewerOf(req));
    res.status(201).json({ attempt: await presentAttempt(attempt) });
  }),
);

// Own attempts only — nobody reads another user's attempt (§1.6): 404, existence not revealed.
quizRouter.get(
  '/attempts/:id',
  requireAuth,
  objectIdParams('id'),
  asyncHandler(async (req, res) => {
    const attempt = await findOwnAttempt(String(req.params.id), viewerOf(req));
    res.json({ attempt: await presentAttempt(attempt) });
  }),
);
