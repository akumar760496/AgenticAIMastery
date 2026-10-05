/** Evaluating a vendor's computer-use agent on our loan tasks. Hidden truth: 78% single-run completion in production. */
export type Evidence = 'board' | 'mock' | 'staging' | 'shadow';
export interface AgentEvaluationState { readonly evidence: Evidence; readonly tasks: number; readonly runs: number; readonly adversarial: boolean }
export interface AgentEvaluationResult { readonly truthSingle: number; readonly truthAllRuns: number; readonly estimate: number; readonly estimateAllRuns: number | null; readonly margin: number | null; readonly gapPoints: number; readonly adversarialTested: boolean }

export const TRUE_SINGLE_RUN = 0.78;
const TRUTH_ALL_RUNS: Readonly<Record<number, number>> = { 1: 0.78, 3: 0.62, 5: 0.55 };
const ESTIMATE: Readonly<Record<Evidence, number>> = { board: 0.85, mock: 0.92, staging: 0.79, shadow: 0.78 };

export function simulateAgentEvaluation(s: AgentEvaluationState): AgentEvaluationResult {
  const truthAllRuns = TRUTH_ALL_RUNS[s.runs] ?? TRUE_SINGLE_RUN;
  const estimate = ESTIMATE[s.evidence];
  const board = s.evidence === 'board';
  return {
    truthSingle: TRUE_SINGLE_RUN, truthAllRuns, estimate,
    estimateAllRuns: board ? null : (estimate * truthAllRuns) / TRUE_SINGLE_RUN,
    margin: board ? null : 1.96 * Math.sqrt((estimate * (1 - estimate)) / s.tasks) * 100,
    gapPoints: Math.abs(estimate - TRUE_SINGLE_RUN) * 100,
    adversarialTested: !board && s.adversarial,
  };
}
