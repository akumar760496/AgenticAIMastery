/** Vector store vs knowledge graph vs temporal knowledge graph for three years of relationship-manager notes. */
export type GraphStore = 'vector' | 'graph' | 'temporal';
export const MULTI_HOP_SHARES = [0.1, 0.3, 0.5] as const;
export type MultiHopShare = (typeof MULTI_HOP_SHARES)[number];
const SIMPLE: Readonly<Record<GraphStore, readonly [number, number]>> = { vector: [0.78, 0.9], graph: [0.8, 0.9], temporal: [0.93, 0.95] };
const MULTI_HOP: Readonly<Record<GraphStore, number>> = { vector: 0.45, graph: 0.78, temporal: 0.85 };
const STALE: Readonly<Record<GraphStore, readonly [number, number]>> = { vector: [16, 4], graph: [14, 4], temporal: [3, 1] };
const COST: Readonly<Record<GraphStore, number>> = { vector: 75, graph: 300, temporal: 375 };
const LATENCY: Readonly<Record<GraphStore, number>> = { vector: 80, graph: 180, temporal: 220 };

export interface GraphMemoryState { readonly store: GraphStore; readonly closeSuperseded: boolean; readonly multiHopShare: MultiHopShare }
export interface GraphMemoryResult { readonly simple: number; readonly multiHop: number; readonly accuracy: number; readonly stalePer100: number; readonly costPer1000Facts: number; readonly latencyMs: number }

export function simulateGraphMemory(s: GraphMemoryState): GraphMemoryResult {
  const i = s.closeSuperseded ? 1 : 0;
  const simple = SIMPLE[s.store][i];
  const multiHop = MULTI_HOP[s.store];
  return { simple, multiHop, accuracy: (1 - s.multiHopShare) * simple + s.multiHopShare * multiHop, stalePer100: STALE[s.store][i], costPer1000Facts: COST[s.store], latencyMs: LATENCY[s.store] };
}
