/** Workflow patterns for 1,000 claim emails: routing, a completeness gate, sectioning and voting. */
export type TaskMix = 'pred' | 'open';
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const INCOMPLETE = 0.08;
const LARGE_PATH_S = 4.5;
const SMALL_CHAIN_S = 2.6;
const FRAUD_SCREEN_S = 3.0;
export const GENERIC_COST_PER_1000 = 650;

export interface WorkflowState { readonly mix: TaskMix; readonly router: boolean; readonly gate: boolean; readonly sectioning: boolean; readonly voting: boolean; readonly threshold: number }
export interface WorkflowResult { readonly accuracy: number; readonly costPer1000: number; readonly p95S: number; readonly unhandled: number; readonly callsPerClaim: number; readonly misrouted: number; readonly toGeneral: number; readonly largePath: boolean }

export function simulateWorkflow(s: WorkflowState): WorkflowResult {
  const unfit = s.mix === 'pred' ? 0.03 : 0.35;
  const r = clamp((s.threshold - 0.5) / 0.4);
  const confident = 0.9 * r;
  const fallbackDesigned = 0.25 * r * r;
  const misrouteRate = 0.1 * (1 - r);
  let accCore: number; let cost: number; let large: number; let unhandled = 0; let calls: number; let misrouted = 0;
  if (!s.router) { accCore = (1 - unfit) * 0.8 + unfit * 0.55; cost = 0.6; large = 1; calls = 1; }
  else {
    const routedAcc = (1 - misrouteRate) * 0.97 + misrouteRate * 0.3;
    const designedAcc = fallbackDesigned * 0.8 + (1 - fallbackDesigned) * routedAcc;
    const unfitAcc = confident * 0.55 + (1 - confident) * 0.1;
    accCore = (1 - unfit) * designedAcc + unfit * unfitAcc;
    cost = 0.05 + (1 - unfit) * (fallbackDesigned * 0.6 + (1 - fallbackDesigned) * 0.1) + unfit * (confident * 0.6 + (1 - confident) * 0.1);
    large = (1 - unfit) * fallbackDesigned + unfit * confident;
    unhandled = unfit * (1 - confident);
    misrouted = (1 - unfit) * (1 - fallbackDesigned) * misrouteRate;
    calls = 1 + (1 - unfit) * (fallbackDesigned + (1 - fallbackDesigned) * 2) + unfit * (confident + (1 - confident) * 2);
  }
  let accuracy = (1 - INCOMPLETE) * accCore + (s.gate ? INCOMPLETE : 0);
  accuracy *= 1 - 0.05 * (1 - (s.voting ? 0.94 : 0.7));
  cost += s.voting ? 0.15 : 0.05;
  calls += s.voting ? 3 : 1;
  const path = large > 0.05 ? LARGE_PATH_S : SMALL_CHAIN_S;
  const p95S = (s.router ? 0.8 : 0) + (s.sectioning ? Math.max(path, FRAUD_SCREEN_S) : path + FRAUD_SCREEN_S) + (s.voting ? 0.4 : 0);
  return { accuracy, costPer1000: cost * 1000, p95S, unhandled, callsPerClaim: calls, misrouted, toGeneral: large, largePath: path === LARGE_PATH_S };
}
