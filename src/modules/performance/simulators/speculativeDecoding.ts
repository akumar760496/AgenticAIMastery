/** Speculative decoding: expected tokens per target pass, step cost and net speed-up. */
export const BATCH_SIZES = [1, 16, 64] as const;
export type BatchSize = (typeof BATCH_SIZES)[number];
/** Extra verify cost per drafted token once the GPU is busy. */
const VERIFY_LOAD: Readonly<Record<BatchSize, number>> = { 1: 0, 16: 0.04, 64: 0.15 };
export const PLAIN_TOKENS_PER_SECOND = 40;
export const MAX_LOOKAHEAD = 10;

export interface SpeculativeState { readonly acceptancePct: number; readonly lookahead: number; readonly draftCost: number; readonly batchSize: BatchSize }
export interface SpeculativeResult { readonly tokensPerPass: number; readonly stepCost: number; readonly speedUp: number; readonly wastedPerStep: number; readonly bestLookahead: number; readonly bestSpeedUp: number }

const evaluate = (a: number, k: number, c: number, b: BatchSize) => {
  const tokensPerPass = a >= 1 ? k + 1 : (1 - Math.pow(a, k + 1)) / (1 - a);
  const stepCost = 1 + k * c + VERIFY_LOAD[b] * k;
  return { tokensPerPass, stepCost, speedUp: tokensPerPass / stepCost };
};

export function simulateSpeculative(s: SpeculativeState): SpeculativeResult {
  const a = s.acceptancePct / 100;
  const r = evaluate(a, s.lookahead, s.draftCost, s.batchSize);
  let bestLookahead = 1;
  let bestSpeedUp = 0;
  for (let k = 1; k <= MAX_LOOKAHEAD; k++) { const sp = evaluate(a, k, s.draftCost, s.batchSize).speedUp; if (sp > bestSpeedUp + 1e-12) { bestSpeedUp = sp; bestLookahead = k; } }
  return { ...r, wastedPerStep: s.lookahead - (r.tokensPerPass - 1), bestLookahead, bestSpeedUp };
}
