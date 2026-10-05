/** An orchestrator fanning a literature screen out to workers: brief quality, tool scope and what workers return. */
export type Brief = 'title' | 'obj' | 'full';
export type ToolScope = 'ro' | 'web' | 'rw';
export type WorkerReturn = 'sum' | 'full';
const BRIEF_COVERAGE: Readonly<Record<Brief, number>> = { title: 0.75, obj: 0.9, full: 1 };
const BRIEF_DUPLICATION: Readonly<Record<Brief, number>> = { title: 0.35, obj: 0.15, full: 0.04 };
const SCOPE_REACH: Readonly<Record<ToolScope, number>> = { ro: 0.75, web: 1, rw: 1 };
const PAPERS_K = 240;
const WORKER_WINDOW_K = 100;
const READ_K_PER_MIN = 10;

export interface SupervisorState { readonly workers: number; readonly brief: Brief; readonly tools: ToolScope; readonly returns: WorkerReturn }
export interface SupervisorResult { readonly duplication: number; readonly coverage: number; readonly windowCoverage: number; readonly readPerWorkerK: number; readonly orchestratorK: number; readonly wallMin: number; readonly totalK: number; readonly writers: number }

export function simulateSupervisor(s: SupervisorState): SupervisorResult {
  const w = s.workers;
  const duplication = w === 1 ? 0 : BRIEF_DUPLICATION[s.brief] * Math.min(1, (w - 1) / 3);
  const windowCoverage = Math.min(1, (WORKER_WINDOW_K * w) / PAPERS_K);
  const read = (PAPERS_K / w) * (1 + duplication);
  const readPerWorkerK = Math.min(WORKER_WINDOW_K, read);
  const orchestratorK = 2 + (s.returns === 'sum' ? w : w * readPerWorkerK);
  return {
    duplication, windowCoverage, readPerWorkerK, orchestratorK,
    coverage: BRIEF_COVERAGE[s.brief] * windowCoverage * SCOPE_REACH[s.tools],
    wallMin: readPerWorkerK / READ_K_PER_MIN + (s.returns === 'sum' ? 1 : 4),
    totalK: PAPERS_K * (1 + duplication) + orchestratorK,
    writers: s.tools === 'rw' ? w : 0,
  };
}
