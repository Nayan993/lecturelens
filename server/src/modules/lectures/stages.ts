import { STAGE_NAMES, type LectureStatus, type ProcessingStage, type StageName, type StageState } from '../../models/index.js';

/**
 * Stage states follow from `status` and the stage order in CONTRACTS.md §2, so the status
 * view can never contradict the lecture's status:
 *   ready → all done · mid-pipeline → earlier done, current running, later pending ·
 *   failed → earlier done, failing stage failed, later skipped · uploaded → all pending.
 */
export function stageStatesFor(status: LectureStatus, failedStage: StageName | null): StageState[] {
  const running = STAGE_NAMES.indexOf(status as StageName); // -1 unless mid-pipeline
  const failedAt = status === 'failed' ? STAGE_NAMES.indexOf(failedStage ?? 'extracting') : -1;
  return STAGE_NAMES.map((_, i) => {
    if (status === 'ready' || i < running || i < failedAt) return 'done';
    if (i === failedAt) return 'failed';
    if (i === running) return 'running';
    return failedAt >= 0 ? 'skipped' : 'pending';
  });
}

export interface StageView {
  name: StageName;
  state: StageState;
  ms: number | null;
}

interface LectureStages {
  status: LectureStatus;
  error: { stage: StageName } | null;
  stages: ProcessingStage[];
}

/**
 * The status response's stages (§6.2): states derived from `status`, timings taken from the
 * stored stage history when it agrees (a running stage reports time so far).
 */
export function stageViews(lecture: LectureStages, now = Date.now()): StageView[] {
  const states = stageStatesFor(lecture.status, lecture.error?.stage ?? null);
  return STAGE_NAMES.map((name, i) => {
    const state = states[i]!;
    const stored = lecture.stages.find((s) => s.name === name);
    let ms: number | null = null;
    if (stored && stored.state === state) {
      ms = state === 'running' && stored.startedAt ? now - stored.startedAt.getTime() : stored.ms;
    }
    return { name, state, ms: state === 'pending' || state === 'skipped' ? null : ms };
  });
}

/** Share of the six stages finished, 0–100 (100 only when ready). */
export function progressPct(lecture: LectureStages): number {
  const states = stageStatesFor(lecture.status, lecture.error?.stage ?? null);
  return Math.round((states.filter((s) => s === 'done').length / STAGE_NAMES.length) * 100);
}

/** Stored stage history after a status change: keeps finished stages' timings, resets the rest. */
export function stagesAfter(
  previous: ProcessingStage[],
  status: LectureStatus,
  failedStage: StageName | null,
  now = new Date(),
): ProcessingStage[] {
  const states = stageStatesFor(status, failedStage);
  return STAGE_NAMES.map((name, i): ProcessingStage => {
    const state = states[i]!;
    const old = previous.find((s) => s.name === name);
    if (state === 'done' && old?.state === 'done') return { ...old, name };
    if (state === 'failed') return { name, state, ms: 0, startedAt: now, finishedAt: now };
    if (state === 'running') return { name, state, ms: 0, startedAt: now, finishedAt: null };
    return { name, state, ms: state === 'done' ? (old?.ms ?? null) : null, startedAt: null, finishedAt: null };
  });
}
