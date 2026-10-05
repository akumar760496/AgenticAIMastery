/** Fanning 12 company analyses out to sub-agents: returns, shared dependencies and an orchestrator merge check. */
export type SubAgentReturn = 'full' | 'sum';
export type Coupling = 'indep' | 'shared';
const COMPANIES = 12;
const FILINGS_K = 40;
const OVERHEAD_K = 40;
const SHARED_LOOKUP_K = 30;
const WINDOW_K = 200;
const INR_PER_1K = 0.4;

export interface SubAgentsState { readonly subAgents: number; readonly returns: SubAgentReturn; readonly coupling: Coupling; readonly mergeCheck: boolean }
export interface SubAgentsResult { readonly perAgent: number; readonly subAgentK: number; readonly subAgentCoverage: number; readonly conflictsFound: number; readonly conflicts: number; readonly mergeCheckK: number; readonly returnedK: number; readonly ownK: number; readonly orchestratorK: number; readonly fit: number; readonly coverage: number; readonly totalK: number; readonly costInr: number; readonly wallMin: number; readonly duplicatedK: number }

export function simulateSubAgents(s: SubAgentsState): SubAgentsResult {
  const n = s.subAgents;
  const shared = s.coupling === 'shared';
  const summaries = s.returns === 'sum';
  const perAgent = COMPANIES / n;
  const subAgentK = perAgent * FILINGS_K + OVERHEAD_K + (shared ? SHARED_LOOKUP_K : 0);
  const subAgentCoverage = Math.min(1, WINDOW_K / subAgentK);
  const conflictsFound = shared ? COMPANIES - perAgent : 0;
  const conflicts = s.mergeCheck ? 0 : conflictsFound;
  const mergeCheckK = s.mergeCheck ? 4 + 2 * conflictsFound : 0;
  const returnedK = summaries ? 6 : n * Math.min(subAgentK, WINDOW_K);
  const ownK = 2 + 0.5 * n;
  const orchestratorK = ownK + returnedK + mergeCheckK;
  const fit = Math.min(1, (WINDOW_K - ownK - mergeCheckK) / returnedK);
  const totalK = n * subAgentK + orchestratorK;
  return {
    perAgent, subAgentK, subAgentCoverage, conflictsFound, conflicts, mergeCheckK, returnedK, ownK, orchestratorK, fit,
    coverage: subAgentCoverage * fit, totalK, costInr: totalK * INR_PER_1K,
    wallMin: 2 + perAgent * 10 + 3 + (shared ? 5 : 0) + (summaries ? 2 : 8) + (s.mergeCheck ? 3 : 0),
    duplicatedK: shared ? (n - 1) * SHARED_LOOKUP_K : 0,
  };
}
