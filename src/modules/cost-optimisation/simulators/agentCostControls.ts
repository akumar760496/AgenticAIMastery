/** Cost controls for a KYC document agent: step budget, tool pruning, trimmed tool results, concise output. */
export const STEPS_NEEDED = 5;
export const PLATFORM_STEP_CAP = 15;
const SYSTEM_TOKENS = 1500;
const INPUT_USD = 3e-6;
const OUTPUT_USD = 15e-6;

export interface AgentCostControlsState {
  readonly stepBudget: number;
  readonly pruneTools: boolean;
  readonly trimResults: boolean;
  readonly conciseOutput: boolean;
}

export interface AgentCostControlsResult {
  readonly averageCostUsd: number;
  readonly completion: number;
  readonly loopRate: number;
  readonly typicalSteps: number;
  readonly loopingSteps: number;
  readonly typicalTokens: number;
  readonly typicalStepTokens: readonly number[];
  readonly loopingStepTokens: readonly number[];
  /** Cost relative to the agent with no controls. */
  readonly relativeCost: number;
  readonly saving: number;
}

function rawCost(s: AgentCostControlsState) {
  const toolTokens = s.pruneTools ? 1200 : 5600;
  const resultTokens = s.trimResults ? 600 : 3000;
  const outputTokens = s.conciseOutput ? 250 : 900;
  const loopRate = s.trimResults ? 0.05 : 0.3;
  const run = (steps: number) => {
    let input = 0;
    for (let i = 1; i <= steps; i++) input += SYSTEM_TOKENS + toolTokens + (i - 1) * (resultTokens + outputTokens);
    return { input, output: steps * outputTokens, cost: input * INPUT_USD + steps * outputTokens * OUTPUT_USD };
  };
  const typicalSteps = Math.min(s.stepBudget, STEPS_NEEDED);
  const loopingSteps = Math.min(s.stepBudget, PLATFORM_STEP_CAP);
  const typical = run(typicalSteps);
  const looping = run(loopingSteps);
  const stepTokens = (k: number) => Array.from({ length: k }, (_, i) => SYSTEM_TOKENS + toolTokens + i * (resultTokens + outputTokens) + outputTokens);
  return {
    averageCostUsd: (1 - loopRate) * typical.cost + loopRate * looping.cost,
    completion: s.stepBudget >= STEPS_NEEDED ? 1 - loopRate : 0,
    loopRate, typicalSteps, loopingSteps,
    typicalTokens: typical.input + typical.output,
    typicalStepTokens: stepTokens(typicalSteps),
    loopingStepTokens: stepTokens(loopingSteps),
  };
}

const UNCONTROLLED = rawCost({ stepBudget: PLATFORM_STEP_CAP, pruneTools: false, trimResults: false, conciseOutput: false }).averageCostUsd;

export function simulateAgentCostControls(state: AgentCostControlsState): AgentCostControlsResult {
  const r = rawCost(state);
  return { ...r, relativeCost: r.averageCostUsd / UNCONTROLLED, saving: 1 - r.averageCostUsd / UNCONTROLLED };
}
