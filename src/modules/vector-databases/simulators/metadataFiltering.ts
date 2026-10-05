/** Post-filter, pre-filter and filtered ANN over 20 lakh chunks with a structured filter of varying selectivity. */
export type FilterStrategy = 'post' | 'pre' | 'filtered';
export const SELECTIVITIES = [0.5, 0.05, 0.005] as const;
export type Selectivity = (typeof SELECTIVITIES)[number];
export const OVERSAMPLING = [1, 4, 20, 100] as const;
export type Oversampling = (typeof OVERSAMPLING)[number];
export const TOTAL_CHUNKS = 2000000;
const ANN_RECALL: Readonly<Record<Oversampling, number>> = { 1: 0.94, 4: 0.97, 20: 0.99, 100: 0.99 };
const PLANNER_EXACT_LIMIT = 20000;
export type QueryPlan = 'ann-then-filter' | 'exact' | 'planner-exact' | 'filtered-hnsw';

export interface MetadataFilteringState { readonly strategy: FilterStrategy; readonly selectivity: Selectivity; readonly oversampling: Oversampling }
export interface MetadataFilteringResult { readonly matching: number; readonly candidates: number; readonly scored: number; readonly returned: number; readonly recall: number; readonly latencyMs: number; readonly plan: QueryPlan }

const exactScan = (matching: number): MetadataFilteringResult => ({ matching, candidates: matching, scored: matching, returned: 10, recall: 1, latencyMs: 2 + matching / 10000, plan: 'exact' });

export function simulateMetadataFiltering({ strategy, selectivity, oversampling }: MetadataFilteringState): MetadataFilteringResult {
  const matching = Math.round(TOTAL_CHUNKS * selectivity);
  const candidates = 10 * oversampling;
  const annRecall = ANN_RECALL[oversampling];
  if (strategy === 'post') {
    const kept = Math.min(10, Math.floor(candidates * selectivity + 1e-9));
    return { matching, candidates, scored: candidates, returned: kept, recall: (kept / 10) * annRecall, latencyMs: 3 + 0.01 * candidates, plan: 'ann-then-filter' };
  }
  if (strategy === 'pre') return exactScan(matching);
  if (matching <= PLANNER_EXACT_LIMIT) return { ...exactScan(matching), plan: 'planner-exact' };
  return { matching, candidates, scored: Math.round(candidates / Math.max(selectivity, 0.1)), returned: 10, recall: annRecall, latencyMs: 3 + 0.01 * candidates + (selectivity >= 0.5 ? 0.5 : 2), plan: 'filtered-hnsw' };
}
