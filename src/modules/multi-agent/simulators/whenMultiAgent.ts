/** One agent or a team? Parallel branches, wall time, tokens, context coverage and cost per useful answer. */
const MINUTES_PER_SUBTASK = 6;
const MERGE_MINUTES = 1;
const SINGLE_MULTIPLIER = 4;
const TEAM_MULTIPLIER = 15;
const INR_PER_1K = 0.5;
export const WINDOW_K = 128;

export interface WhenMultiState { readonly subtasks: number; readonly densityPct: number; readonly tokensPerSubtaskK: number; readonly inrPerMinute: number }
export interface WhenMultiResult {
  readonly chain: number; readonly branches: number; readonly singleTokensK: number; readonly teamTokensK: number; readonly singleMinutes: number; readonly teamMinutes: number;
  readonly timeRatio: number; readonly singleCoverage: number; readonly teamCoverage: number; readonly singleCostPerAnswer: number; readonly teamCostPerAnswer: number; readonly teamWins: boolean;
}

export function simulateWhenMulti(s: WhenMultiState): WhenMultiResult {
  const n = s.subtasks;
  const chain = n === 1 ? 1 : 1 + Math.round(((n - 1) * s.densityPct) / 100);
  const branches = n - chain + 1;
  const baseK = n * s.tokensPerSubtaskK;
  const singleTokensK = SINGLE_MULTIPLIER * baseK;
  const teamTokensK = TEAM_MULTIPLIER * baseK;
  const singleMinutes = MINUTES_PER_SUBTASK * n;
  const teamMinutes = MINUTES_PER_SUBTASK * chain + MERGE_MINUTES;
  const singleCoverage = Math.min(1, WINDOW_K / (SINGLE_MULTIPLIER * baseK));
  const teamCoverage = Math.min(1, WINDOW_K / (SINGLE_MULTIPLIER * s.tokensPerSubtaskK * chain));
  const singleCostPerAnswer = (singleTokensK * INR_PER_1K + singleMinutes * s.inrPerMinute) / (n * singleCoverage);
  const teamCostPerAnswer = (teamTokensK * INR_PER_1K + teamMinutes * s.inrPerMinute) / (n * teamCoverage);
  return { chain, branches, singleTokensK, teamTokensK, singleMinutes, teamMinutes, timeRatio: teamMinutes / singleMinutes, singleCoverage, teamCoverage, singleCostPerAnswer, teamCostPerAnswer, teamWins: branches > 1 && teamCostPerAnswer < singleCostPerAnswer - 1e-9 };
}
