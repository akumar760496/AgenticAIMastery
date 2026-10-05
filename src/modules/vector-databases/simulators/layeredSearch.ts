/** A four-layer search pipeline over 10 million chunks: binary scan, int8 rescore, float32 rescore from SSD, cross-encoder. */
export const LATENCY_BUDGET_MS = 50;

export interface LayeredSearchState { readonly candidates: number; readonly int8Layer: boolean; readonly int8Keep: number; readonly crossEncoder: boolean; readonly depth: number }
export interface LayeredSearchResult {
  readonly recall: number;
  readonly layer1Recall: number;
  readonly layer2Recall: number;
  readonly layerMs: readonly [binary: number, int8: number, float32: number, crossEncoder: number];
  readonly latencyMs: number;
  readonly fetchedFromSsd: number;
  readonly kept: number;
  readonly ndcg: number;
  readonly withinBudget: boolean;
}

export function simulateLayeredSearch(s: LayeredSearchState): LayeredSearchResult {
  const layer1Recall = Math.max(0, 1 - 0.03 * Math.pow(1000 / s.candidates, 0.8));
  const layer2Recall = s.int8Layer ? (s.int8Keep >= s.candidates ? 1 : 1 - 0.01 * (100 / s.int8Keep) * Math.pow(s.candidates / 1000, 0.3)) : 1;
  const fetchedFromSsd = s.int8Layer ? Math.min(s.int8Keep, s.candidates) : s.candidates;
  const layerMs: [number, number, number, number] = [3 + 0.004 * s.candidates, s.int8Layer ? 0.003 * s.candidates : 0, 0.05 * fetchedFromSsd, s.crossEncoder ? 1.2 * s.depth : 0];
  const latencyMs = layerMs.reduce((a, b) => a + b, 0);
  const recall = layer1Recall * layer2Recall;
  return {
    recall, layer1Recall, layer2Recall, layerMs, latencyMs, fetchedFromSsd,
    kept: s.crossEncoder ? s.depth : 10,
    ndcg: recall * (0.62 + (s.crossEncoder ? 0.2 * (1 - Math.exp(-s.depth / 15)) : 0)),
    withinBudget: latencyMs <= LATENCY_BUDGET_MS,
  };
}
