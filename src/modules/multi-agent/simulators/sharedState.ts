/** Parallel writers sharing findings: a typed board with or without a reducer, free-text chat, or typed messages. */
export type ShareMode = 'board' | 'chat' | 'typed';
export type Reducer = 'replace' | 'append';
export type ReadScope = 'all' | 'own';
export const WRITERS = [{ name: 'carrier', findings: 4 }, { name: 'warehouse', findings: 3 }, { name: 'weather', findings: 5 }, { name: 'customs', findings: 4 }, { name: 'fleet', findings: 3 }, { name: 'returns', findings: 5 }] as const;
const FINDING_K = 0.75;
const PROVENANCE: Readonly<Record<ShareMode, number>> = { board: 0.5, chat: 0.3, typed: 0.6 };

export interface SharedStateState { readonly mode: ShareMode; readonly writers: number; readonly reducer: Reducer; readonly readScope: ReadScope; readonly sourceFields: boolean }
export interface SharedStateResult { readonly total: number; readonly lost: number; readonly readK: number; readonly fullReadK: number; readonly conflicts: number; readonly provenance: number; readonly lastWriterFindings: number }

export function simulateSharedState(s: SharedStateState): SharedStateResult {
  const counts = WRITERS.slice(0, s.writers).map((w) => w.findings);
  const total = counts.reduce((a, b) => a + b, 0);
  const last = counts[counts.length - 1] ?? 0;
  let lost = 0; let conflicts = 0;
  if (s.mode === 'board' && s.reducer === 'replace') { lost = total - last; conflicts = s.writers - 1; }
  if (s.mode === 'chat') { lost = Math.round(total * 0.2); conflicts = Math.floor(s.writers / 2); }
  const kept = total - lost;
  const share = Math.min(1, 2 / s.writers);
  const readK = s.mode === 'chat' ? total * FINDING_K * 1.6 : s.mode === 'typed' ? kept * FINDING_K * share : kept * FINDING_K * (s.readScope === 'own' ? share : 1);
  return { total, lost, readK, fullReadK: total * FINDING_K, conflicts, provenance: s.sourceFields ? (s.mode === 'chat' ? 0.7 : 1) : PROVENANCE[s.mode], lastWriterFindings: last };
}
