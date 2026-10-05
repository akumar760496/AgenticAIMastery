/** Evaluating a tuned model: test size, contamination and regression suites. The true gain is +4 points. */
export interface TunedEvalState { readonly cases: number; readonly contamination: number; readonly general: boolean; readonly safety: boolean }
export interface TunedEvalResult { readonly measuredGain: number; readonly margin: number; readonly significant: boolean; readonly unearned: number }

export const TRUE_GAIN = 4;

export function simulateTunedEval(s: TunedEvalState): TunedEvalResult {
  const measuredGain = TRUE_GAIN + (s.contamination * 80) / 3;
  const margin = 1.96 * Math.sqrt((2 * 0.16) / s.cases) * 100;
  return { measuredGain, margin, significant: measuredGain - margin > 0, unearned: measuredGain - TRUE_GAIN };
}
