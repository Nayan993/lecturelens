import { Lecture, STAGE_NAMES, type LectureStatus, type StageName } from '../../models/index.js';
import { stagesAfter } from '../../modules/lectures/stages.js';
import { logger } from '../../utils/logger.js';

/*
 * ===========================================================================================
 *  PROCESSING PIPELINE — INTERFACE + STUB. Owned jointly: Member D defines the interface,
 *  Member A implements it.
 *
 *  Member A replaces this implementation in PA.1/PA.2.
 *  Do not change the interface without a contract-change issue.
 * ===========================================================================================
 *
 *  Contract for implementations:
 *  - Called WITHOUT await right after the lecture is saved (upload) or claimed for a rerun
 *    (reprocess), so it must never throw synchronously and should record its own failures on
 *    the lecture (status "failed" + `error`) rather than rejecting.
 *  - `fromStage` is the first stage to (re)run; omitted = from "extracting".
 *  - Keep `status`, `statusDetail`, `error` and `stages` up to date as stages run
 *    (CONTRACTS.md §2, §4.2).
 */
export interface ProcessingPipeline {
  startProcessing(lectureId: string, opts?: { fromStage?: LectureStatus }): Promise<void>;
}

export const NOT_IMPLEMENTED_DETAIL = 'Transcription pipeline not yet implemented (Member A, prompt PA.1)';

const asStage = (status: LectureStatus | undefined): StageName =>
  STAGE_NAMES.includes(status as StageName) ? (status as StageName) : 'extracting';

/**
 * Default implementation until Member A's lands: honestly marks the lecture as failed at the
 * stage it would have started, with error code NOT_IMPLEMENTED. Never fakes success.
 */
export const notImplementedPipeline: ProcessingPipeline = {
  async startProcessing(lectureId, opts) {
    const stage = asStage(opts?.fromStage);
    logger.warn('Processing pipeline is not implemented yet; marking the lecture failed', { lectureId, stage });
    try {
      const lecture = await Lecture.findById(lectureId);
      if (!lecture || lecture.status === 'ready' || lecture.status === 'failed') return; // deleted or settled
      const at = new Date();
      lecture.status = 'failed';
      lecture.statusDetail = NOT_IMPLEMENTED_DETAIL;
      lecture.error = { stage, code: 'NOT_IMPLEMENTED', message: NOT_IMPLEMENTED_DETAIL, at };
      lecture.stages = stagesAfter(lecture.stages, 'failed', stage, at);
      await lecture.save();
    } catch (err) {
      logger.error('Could not record the pipeline stub failure', { lectureId, error: err });
    }
  },
};

let pipeline: ProcessingPipeline = notImplementedPipeline;

/** Swap the implementation (Member A's pipeline, or a fake in tests). */
export function setPipeline(next: ProcessingPipeline): void {
  pipeline = next;
}

export function startProcessing(lectureId: string, opts?: { fromStage?: LectureStatus }): Promise<void> {
  return pipeline.startProcessing(lectureId, opts);
}

/**
 * On boot (§2): there is no job queue to resume from, so any lecture left mid-pipeline by a
 * restart is marked failed with PIPELINE_INTERRUPTED. Returns how many were marked.
 */
export async function failInterruptedLectures(): Promise<number> {
  const stuck = await Lecture.find({ status: { $nin: ['ready', 'failed'] } });
  for (const lecture of stuck) {
    const stage = asStage(lecture.status);
    const at = new Date();
    lecture.status = 'failed';
    lecture.statusDetail = 'Processing was interrupted by a server restart. Reprocess to try again.';
    lecture.error = { stage, code: 'PIPELINE_INTERRUPTED', message: 'The server restarted while this lecture was processing.', at };
    lecture.stages = stagesAfter(lecture.stages, 'failed', stage, at);
    await lecture.save();
  }
  if (stuck.length) logger.warn('Marked interrupted lectures as failed', { count: stuck.length });
  return stuck.length;
}
