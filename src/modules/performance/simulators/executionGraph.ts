/** A five-step loan-underwriting workflow, A → (B, C, D) → E, run sequentially or as a graph, with failures and checkpoints. */
export type CDependency = 'none' | 'declared' | 'hidden';
export const STEP_NAMES = { A: 'fetch application', B: 'credit bureau check', C: 'bank-statement analysis', D: 'employment verification', E: 'underwriting decision' } as const;
const FIXED_STEP_S = 1;

export interface ExecutionGraphState { readonly parallel: boolean; readonly dependency: CDependency; readonly bS: number; readonly cS: number; readonly dS: number; readonly dFailsOnce: boolean; readonly checkpoints: boolean }
export interface ExecutionGraphResult { readonly totalS: number; readonly sequentialCleanS: number; readonly speedUp: number; readonly criticalPath: string; readonly correct: boolean }

export function simulateExecutionGraph(s: ExecutionGraphState): ExecutionGraphResult {
  const { bS: b, cS: c, dS: d } = s;
  const sequentialCleanS = FIXED_STEP_S + b + c + d + FIXED_STEP_S;
  const needsB = s.dependency !== 'none';
  const declared = s.dependency === 'declared';
  let totalS: number;
  let criticalPath: string;
  let correct = true;
  if (!s.parallel) {
    totalS = sequentialCleanS;
    criticalPath = 'every step in sequence';
    if (s.dFailsOnce) totalS = s.checkpoints ? sequentialCleanS + d : 1 + b + c + d + sequentialCleanS;
  } else {
    const cEnd = declared ? 1 + b + c : 1 + c;
    const dEnd = 1 + d * (s.dFailsOnce && s.checkpoints ? 2 : 1);
    const bEnd = 1 + b;
    const clean = 1 + Math.max(b, declared ? b + c : c, d) + 1;
    const paths: [number, string][] = [[bEnd, 'A → B → E'], [cEnd, declared ? 'A → B → C → E' : 'A → C → E'], [dEnd, s.dFailsOnce && s.checkpoints ? 'A → D (retried) → E' : 'A → D → E']];
    paths.sort((x, y) => y[0] - x[0]);
    totalS = Math.max(bEnd, cEnd, dEnd) + 1;
    criticalPath = paths[0]![1];
    if (s.dFailsOnce && !s.checkpoints) { totalS = 1 + d + clean; criticalPath = 'restart from A after D failed'; }
    if (needsB && !declared) correct = false;
  }
  return { totalS, sequentialCleanS, speedUp: sequentialCleanS / totalS, criticalPath, correct };
}
