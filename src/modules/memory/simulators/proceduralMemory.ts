/** Reusing a saved coding skill across ten tasks: retrieval threshold, a stale codebase and the skill's own check. */
export const TASKS: readonly { readonly name: string; readonly similarity: number; readonly matches: boolean }[] = [
  { name: 'add /payouts', similarity: 0.93, matches: true }, { name: 'add /refunds/{id}', similarity: 0.88, matches: true },
  { name: 'add /mandates', similarity: 0.85, matches: true }, { name: 'add /invoices/pdf', similarity: 0.82, matches: true },
  { name: 'add /kyc/status', similarity: 0.78, matches: true }, { name: 'rename a DB column', similarity: 0.74, matches: false },
  { name: 'add /upi/collect', similarity: 0.71, matches: true }, { name: 'fix a flaky test', similarity: 0.66, matches: false },
  { name: 'bump a dependency', similarity: 0.58, matches: false }, { name: 'write release notes', similarity: 0.41, matches: false },
];
export const EXPLORE_STEPS = 9;
const SKILL_STEPS = 4;
const WRONG_SKILL_STEPS = 12;
const RELEARN_STEPS = 13;
const TOKENS_PER_STEP_K = 3;

export interface ProceduralState { readonly library: boolean; readonly thresholdPct: number; readonly refactored: boolean; readonly check: boolean }
export interface TaskOutcome { readonly name: string; readonly similarity: number; readonly steps: number; readonly correct: boolean; readonly note: string }
export interface ProceduralResult { readonly outcomes: readonly TaskOutcome[]; readonly totalSteps: number; readonly averageSteps: number; readonly correctShare: number; readonly tokensK: number; readonly reused: number; readonly wrong: number; readonly missed: number; readonly silent: number }

export function simulateProcedural(s: ProceduralState): ProceduralResult {
  const threshold = s.thresholdPct / 100;
  let reused = 0; let wrong = 0; let missed = 0; let silent = 0; let firstStale = true;
  const outcomes = TASKS.map((t): TaskOutcome => {
    const retrieved = s.library && t.similarity >= threshold;
    if (retrieved && t.matches) {
      reused++;
      if (!s.refactored) return { name: t.name, similarity: t.similarity, steps: SKILL_STEPS, correct: true, note: 'reused' };
      if (!s.check) { silent++; return { name: t.name, similarity: t.similarity, steps: SKILL_STEPS, correct: false, note: 'stale, shipped broken' }; }
      if (firstStale) { firstStale = false; return { name: t.name, similarity: t.similarity, steps: RELEARN_STEPS, correct: true, note: 'stale, caught, re-learned' }; }
      return { name: t.name, similarity: t.similarity, steps: SKILL_STEPS, correct: true, note: 'revised skill' };
    }
    if (retrieved) {
      wrong++;
      if (!s.check) { silent++; return { name: t.name, similarity: t.similarity, steps: WRONG_SKILL_STEPS, correct: false, note: 'wrong skill, unchecked' }; }
      return { name: t.name, similarity: t.similarity, steps: WRONG_SKILL_STEPS, correct: true, note: 'wrong skill' };
    }
    if (t.matches && s.library) missed++;
    return { name: t.name, similarity: t.similarity, steps: EXPLORE_STEPS, correct: true, note: t.matches && s.library ? 'missed match' : 'explored' };
  });
  const totalSteps = outcomes.reduce((a, o) => a + o.steps, 0);
  return { outcomes, totalSteps, averageSteps: totalSteps / TASKS.length, correctShare: outcomes.filter((o) => o.correct).length / TASKS.length, tokensK: totalSteps * TOKENS_PER_STEP_K, reused, wrong, missed, silent };
}
