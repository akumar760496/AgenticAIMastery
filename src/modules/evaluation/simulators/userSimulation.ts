/** User simulation for multi-turn agents: scripted turns versus LLM-simulated users, with pass^k. */
export const REAL_USER_SUCCESS = 0.71;
const SCENARIOS = 200;
const TOTAL_FAILURE_TYPES = 20;

export interface UserSimulationState {
  readonly userSide: 'scripted' | 'llm';
  readonly difficultPersonas: boolean;
  readonly runsPerScenario: 1 | 4 | 8;
}

export interface UserSimulationResult {
  readonly reportedPassRate: number;
  readonly passHatK: number;
  readonly failureTypesFound: number;
  readonly totalFailureTypes: number;
  readonly suiteCostRupees: number;
  readonly gapToRealUsers: number;
}

const EXTRA_FAILURES_BY_RUNS: Readonly<Record<UserSimulationState['runsPerScenario'], number>> = { 1: 0, 4: 2, 8: 3 };

export function simulateUserSimulation({ userSide, difficultPersonas, runsPerScenario }: UserSimulationState): UserSimulationResult {
  const isLlm = userSide === 'llm';
  const withPersonas = isLlm && difficultPersonas;
  const reportedPassRate = !isLlm ? 0.95 : withPersonas ? REAL_USER_SUCCESS : 0.8;
  return {
    reportedPassRate,
    passHatK: Math.round(reportedPassRate ** runsPerScenario * 1000) / 1000,
    failureTypesFound: !isLlm ? 5 : 11 + (withPersonas ? 5 : 0) + EXTRA_FAILURES_BY_RUNS[runsPerScenario],
    totalFailureTypes: TOTAL_FAILURE_TYPES,
    suiteCostRupees: Math.round(SCENARIOS * runsPerScenario * (isLlm ? 4 : 0.5)),
    gapToRealUsers: Math.round((reportedPassRate - REAL_USER_SUCCESS) * 100) / 100,
  };
}
