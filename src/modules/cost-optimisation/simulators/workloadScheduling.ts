/** Scheduling a nightly job around interactive chat on reserved capacity (units of 1,000 requests an hour). */
export type JobMode = 'now' | 'queue';
/** Interactive demand per hour of the day, 00h–23h. */
export const INTERACTIVE_LOAD: readonly number[] = [1, 1, 1, 1, 1, 1, 2, 3, 5, 7, 8, 8, 7, 7, 6, 6, 5, 4, 4, 3, 3, 2, 2, 1];
export const JOB_START_HOUR = 16;
export const JOB_WINDOW_HOURS = 16;
export const USD_PER_UNIT_HOUR = 2.5;
const FULL_JOB = 24;
const DEDUPED_JOB = 18;

export interface WorkloadSchedulingState {
  readonly mode: JobMode;
  readonly capacity: number;
  readonly jobLimit: number;
  readonly dedup: boolean;
}

export interface WorkloadSchedulingResult {
  readonly background: readonly number[];
  readonly work: number;
  readonly left: number;
  readonly onTime: boolean;
  /** Hours after 16:00 when the job finished, or null if it did not. */
  readonly finishedAfter: number | null;
  readonly finishClock: number | null;
  readonly delayed: number;
  readonly peak: number;
  readonly utilisation: number;
  readonly costPerDayUsd: number;
}

export function simulateWorkloadScheduling(s: WorkloadSchedulingState): WorkloadSchedulingResult {
  const work = s.dedup ? DEDUPED_JOB : FULL_JOB;
  const background = Array<number>(24).fill(0);
  let remaining = work;
  let finishedAfter: number | null = null;
  for (let elapsed = 0; elapsed < JOB_WINDOW_HOURS; elapsed++) {
    const hour = (JOB_START_HOUR + elapsed) % 24;
    const room = s.mode === 'now' ? s.jobLimit : Math.min(s.jobLimit, Math.max(0, s.capacity - (INTERACTIVE_LOAD[hour] ?? 0)));
    const used = Math.min(room, remaining);
    background[hour] = used;
    if (used > 0 && used >= remaining - 1e-9 && finishedAfter === null) finishedAfter = elapsed + (room > 0 ? remaining / room : 0);
    remaining -= used;
    if (remaining < 1e-9) { remaining = 0; if (finishedAfter === null) finishedAfter = elapsed + 1; }
  }
  let delayed = 0;
  let peak = 0;
  INTERACTIVE_LOAD.forEach((load, hour) => {
    const demand = load + (background[hour] ?? 0);
    peak = Math.max(peak, demand);
    delayed += Math.max(0, demand - s.capacity);
  });
  const interactive = INTERACTIVE_LOAD.reduce((a, b) => a + b, 0);
  return {
    background, work, left: remaining, onTime: remaining === 0, finishedAfter,
    finishClock: finishedAfter === null ? null : (JOB_START_HOUR + finishedAfter) % 24,
    delayed, peak,
    utilisation: Math.min(1, (interactive + work) / (s.capacity * 24)),
    costPerDayUsd: s.capacity * 24 * USD_PER_UNIT_HOUR,
  };
}
