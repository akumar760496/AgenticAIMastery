/**
 * A vague chat follow-up (“and what about the other one, the balanced fund?”). The answer is one passage; only the top 5
 * reach the prompt; the latency budget is 800 ms.
 */
export interface QueryRewritingState { readonly rewrite: boolean; readonly multiQuery: boolean; readonly rerank: boolean; readonly candidates: number }
export interface QueryRewritingResult { readonly firstRank: number; readonly found: boolean; readonly finalRank: number | null; readonly hit: boolean; readonly latencyMs: number; readonly llmCalls: number; readonly query: string }

export const LATENCY_BUDGET_MS = 800;
const FIRST_STAGE_RANK: Readonly<Record<string, number>> = { '00': 140, '10': 23, '01': 41, '11': 12 };

export function simulateQueryRewriting(s: QueryRewritingState): QueryRewritingResult {
  const firstRank = FIRST_STAGE_RANK[`${s.rewrite ? 1 : 0}${s.multiQuery ? 1 : 0}`] ?? 140;
  const found = firstRank <= s.candidates;
  const finalRank = !found ? null : s.rerank ? 2 : firstRank;
  return {
    firstRank, found, finalRank,
    hit: finalRank !== null && finalRank <= 5,
    latencyMs: 40 + (s.rewrite ? 350 : 0) + (s.multiQuery ? 420 : 0) + (s.rerank ? 20 + 2 * s.candidates : 0),
    llmCalls: (s.rewrite ? 1 : 0) + (s.multiQuery ? 1 : 0),
    query: s.rewrite ? 'exit load Balanced Advantage Fund' : 'and what about the other one, the balanced fund?',
  };
}
