/** Choosing a vector store for a (fictional) NBFC by latency, cost, operations hours and data residency. */
export type StoreFamily = 'pg' | 'engine' | 'managed' | 'search';
export const SCALE_LABELS = ['10 lakh', '1 crore', '20 crore'] as const;

const STORES: Readonly<Record<StoreFamily, { readonly latencyMs: readonly number[]; readonly costInr: readonly number[]; readonly opsHours: readonly number[]; readonly inOwnAccount: boolean }>> = {
  pg: { latencyMs: [15, 60, 400], costInr: [8000, 45000, 400000], opsHours: [4, 10, 40], inOwnAccount: true },
  engine: { latencyMs: [10, 20, 45], costInr: [15000, 40000, 220000], opsHours: [12, 16, 30], inOwnAccount: true },
  managed: { latencyMs: [30, 40, 60], costInr: [6000, 55000, 350000], opsHours: [2, 2, 3], inOwnAccount: false },
  search: { latencyMs: [25, 45, 120], costInr: [10000, 70000, 450000], opsHours: [8, 14, 30], inOwnAccount: true },
};

export interface StoreSelectionState { readonly store: StoreFamily; readonly scale: number; readonly ownAccount: boolean }
export interface StoreSelectionResult { readonly latencyMs: number; readonly costInr: number; readonly opsHours: number; readonly residencyMet: boolean }

export function simulateStoreSelection({ store, scale, ownAccount }: StoreSelectionState): StoreSelectionResult {
  const d = STORES[store];
  return { latencyMs: d.latencyMs[scale] ?? 0, costInr: d.costInr[scale] ?? 0, opsHours: d.opsHours[scale] ?? 0, residencyMet: !ownAccount || d.inOwnAccount };
}
