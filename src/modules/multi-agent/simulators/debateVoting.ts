/** Voting and debate among agents with correlated errors: accuracy, calls and gains over one agent and plain voting. */
export type Aggregation = 'last' | 'maj' | 'judge';
const TOKENS_PER_CALL_K = 2;

const choose = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
/** Probability a majority of n independent agents with accuracy p is right; ties resolved right with probability tie. */
export const majority = (n: number, p: number, tie: number) => {
  let s = 0;
  for (let k = 0; k <= n; k++) { const pr = choose(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k); if (2 * k > n) s += pr; else if (2 * k === n) s += tie * pr; }
  return s;
};

export interface DebateState { readonly agents: number; readonly rounds: number; readonly accuracyPct: number; readonly correlationPct: number; readonly aggregation: Aggregation }
export interface DebateResult { readonly accuracy: number; readonly plainVote: number; readonly perAgentAfterDebate: number; readonly independent: number; readonly calls: number; readonly gainOverSingle: number; readonly gainOverVote: number; readonly per10kTokens: number; readonly effectiveRounds: number }

export function simulateDebate(s: DebateState): DebateResult {
  const n = s.agents;
  const r = n === 1 ? 0 : s.rounds;
  const p = s.accuracyPct / 100;
  const rho = s.correlationPct / 100;
  const perAgentAfterDebate = p + (1 - p) * 0.1 * (1 - Math.pow(0.5, r));
  const independent = s.aggregation === 'last' ? perAgentAfterDebate : majority(n, perAgentAfterDebate, s.aggregation === 'judge' ? 0.8 : 0.5);
  const accuracy = rho * p + (1 - rho) * independent;
  const plainVote = rho * p + (1 - rho) * majority(n, p, 0.5);
  const calls = n * (r + 1) + (s.aggregation === 'judge' && n > 1 ? 1 : 0);
  return { accuracy, plainVote, perAgentAfterDebate, independent, calls, gainOverSingle: accuracy - p, gainOverVote: accuracy - plainVote, per10kTokens: accuracy / ((calls * TOKENS_PER_CALL_K) / 10), effectiveRounds: r };
}
