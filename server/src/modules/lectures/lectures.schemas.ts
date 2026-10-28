import { z } from 'zod';
import { LECTURE_STATUSES, STAGE_NAMES } from '../../models/index.js';
import { paging } from '../../utils/schemas.js';

/** Request validation for /lectures (CONTRACTS.md §1.4, §5.3). */

export { objectIdString } from '../../utils/schemas.js';

/** Form fields arrive as strings; an empty one means "not supplied". */
const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z.string().trim().max(max, `Must be at most ${max} characters`).optional(),
  );

/** Latest calendar date anywhere on Earth right now (UTC+14), so "today" is never "future". */
const latestToday = () => new Date(Date.now() + 14 * 3600 * 1000).toISOString().slice(0, 10);

const isCalendarDate = (v: string) => {
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const consentFlag = (message: string) =>
  z.literal('true', { errorMap: () => ({ message }) });

/** Multipart text fields, reshaped so consent errors are reported as `consent.<field>`. */
export const uploadFields = z.object({
  title: z
    .string({ required_error: 'Required' })
    .trim()
    .min(1, 'Required')
    .max(200, 'Must be at most 200 characters'),
  courseCode: optionalText(100),
  description: optionalText(2000),
  recordedOn: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
    z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a date as YYYY-MM-DD')
      .refine(isCalendarDate, 'Must be a real calendar date')
      .refine((v) => v <= latestToday(), 'Must not be in the future')
      .optional(),
  ),
  notes: optionalText(10_000),
  consent: z.object({
    lecturerConsent: consentFlag('Lecturer consent is required'),
    purposeShown: consentFlag('The purpose statement must be shown before consent'),
    processorNamed: consentFlag('The third-party processors must be named before consent'),
  }),
});
export type UploadFields = z.infer<typeof uploadFields>;

/** Raw multipart body → the shape `uploadFields` validates. */
export function uploadFieldsInput(body: Record<string, unknown>) {
  const { lecturerConsent, purposeShown, processorNamed, ...rest } = body;
  return { ...rest, consent: { lecturerConsent, purposeShown, processorNamed } };
}

export const listQuery = z.object({
  ...paging,
  status: z.enum(LECTURE_STATUSES, { errorMap: () => ({ message: `Must be one of ${LECTURE_STATUSES.join(', ')}` }) }).optional(),
  q: z.string().trim().max(200, 'Must be at most 200 characters').optional(),
});
export type ListQuery = z.infer<typeof listQuery>;

const fromStage = z.enum(STAGE_NAMES, { errorMap: () => ({ message: `Must be one of ${STAGE_NAMES.join(', ')}` }) });

/** fromStage may come in the JSON body (contract) or the query string; default "extracting". */
export const reprocessBody = z.object({ fromStage: fromStage.optional() }).strict('Only "fromStage" is accepted');
export const reprocessQuery = z.object({ fromStage: fromStage.optional() });

export const mediaQuery = z.object({
  exp: z.coerce.number().int(),
  sig: z.string().regex(/^[0-9a-f]{64}$/),
});
