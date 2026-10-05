/** System-level eval: 5 tasks × 3 runs, release gate at 90% success. */
export interface SystemEvalState {
  /** runs[task][run] — true when the run reached the correct end state. */
  readonly runs: readonly (readonly boolean[])[];
  /** Dollars per run. */
  readonly costPerRun: number;
}

export interface SystemEvalResult {
  readonly passingRuns: number;
  readonly totalRuns: number;
  readonly successRate: number;
  readonly passAtK: number;
  readonly passHatK: number;
  readonly totalSpend: number;
  readonly costPerSuccess: number;
  readonly gatePasses: boolean;
  readonly flakyTasks: readonly number[];
  readonly brokenTasks: readonly number[];
}

export const RELEASE_GATE_THRESHOLD = 0.9;

export function simulateSystemEval({ runs, costPerRun }: SystemEvalState): SystemEvalResult {
  const totalRuns = runs.reduce((sum, task) => sum + task.length, 0);
  const passingRuns = runs.flat().filter(Boolean).length;
  const tasksPassedOnce = runs.filter((task) => task.some(Boolean)).length;
  const tasksPassedEvery = runs.filter((task) => task.every(Boolean)).length;
  const successRate = passingRuns / totalRuns;
  const totalSpend = totalRuns * costPerRun;
  return {
    passingRuns,
    totalRuns,
    successRate,
    passAtK: tasksPassedOnce / runs.length,
    passHatK: tasksPassedEvery / runs.length,
    totalSpend,
    costPerSuccess: passingRuns ? totalSpend / passingRuns : Number.POSITIVE_INFINITY,
    gatePasses: successRate >= RELEASE_GATE_THRESHOLD,
    flakyTasks: runs.flatMap((task, i) => (task.some(Boolean) && !task.every(Boolean) ? [i + 1] : [])),
    brokenTasks: runs.flatMap((task, i) => (task.some(Boolean) ? [] : [i + 1])),
  };
}

/** Passing runs still needed to reach the gate. */
export const runsNeededForGate = (result: SystemEvalResult): number =>
  Math.max(0, Math.ceil(RELEASE_GATE_THRESHOLD * result.totalRuns) - result.passingRuns);
