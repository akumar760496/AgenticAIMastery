/** Beam search over a 3-level route: proposals per state k, beam b, depth d and evaluator quality. */
export type Evaluator = 'noisy' | 'good';
/** Rank of the right proposal at each level among the model's proposals. */
const RIGHT_PROPOSAL_RANK = [2, 1, 3] as const;
/** Rank the evaluator gives the right branch at each level. */
const EVALUATOR_RANK: Readonly<Record<Evaluator, readonly number[]>> = { noisy: [2, 3, 2], good: [1, 1, 1] };
const INR_PER_CALL = 0.2;
export const SOLUTION_DEPTH = 3;

export interface TreeSearchState { readonly proposals: number; readonly beam: number; readonly depth: number; readonly evaluator: Evaluator }
export interface SearchLevel { readonly candidates: number; readonly pruned: number; readonly kept: number; readonly proposed: boolean; readonly rank: number; readonly survived: boolean }
export interface TreeSearchResult { readonly levels: readonly SearchLevel[]; readonly calls: number; readonly solved: boolean; readonly costInr: number; readonly lostAt: number }

export function simulateTreeSearch(s: TreeSearchState): TreeSearchResult {
  let frontier = 1; let alive: boolean = true; let calls = 0; let solved = false;
  const levels: SearchLevel[] = [];
  for (let l = 0; l < s.depth; l++) {
    const candidates = frontier * s.proposals;
    const pruned = Math.floor(candidates / 3);
    const kept = Math.min(s.beam, candidates - pruned);
    calls += 2 * candidates;
    const proposed: boolean = alive && s.proposals >= (RIGHT_PROPOSAL_RANK[l] ?? 99);
    const rank = EVALUATOR_RANK[s.evaluator][l] ?? 99;
    const survived: boolean = proposed && rank <= kept;
    levels.push({ candidates, pruned, kept, proposed, rank, survived });
    alive = survived; frontier = kept;
    if (l === SOLUTION_DEPTH - 1 && survived) { solved = true; break; }
  }
  return { levels, calls, solved, costInr: calls * INR_PER_CALL, lostAt: levels.findIndex((l) => !l.survived) + 1 };
}
