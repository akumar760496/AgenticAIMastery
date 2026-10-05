/** A ten-step claim workflow crashing mid-run: plain script, checkpointer or durable workflow, with an idempotent payment. */
export type RunMode = 'script' | 'ckpt' | 'durable';
export const STEPS = ['fetch claim', 'fetch policy', 'OCR bills', 'summarise', 'fraud check', 'decide', 'wait approval', 'pay hospital', 'notify', 'close'] as const;
const MODEL_STEP_TOKENS = 6000;
const PAYMENT_STEP = 8;
const APPROVAL_STEP = 7;
const isModelStep = (i: number) => i >= 3 && i <= 6;

export interface DurableState { readonly mode: RunMode; readonly crashStep: number; readonly idempotencyKey: boolean }
export interface DurableResult { readonly rerunSteps: readonly number[]; readonly rerun: number; readonly modelRepeats: number; readonly wastedTokens: number; readonly paidTwice: boolean; readonly reasked: boolean; readonly resumeMin: number }

export function simulateDurable(s: DurableState): DurableResult {
  const k = s.crashStep;
  const rerunSteps = s.mode === 'script' ? Array.from({ length: k }, (_, i) => i + 1) : [k];
  return {
    rerunSteps, rerun: rerunSteps.length,
    modelRepeats: rerunSteps.filter(isModelStep).length,
    wastedTokens: (s.mode === 'script' ? rerunSteps.filter((i) => i < k && isModelStep(i)).length : 0) * MODEL_STEP_TOKENS,
    paidTwice: !s.idempotencyKey && (k === PAYMENT_STEP || (s.mode === 'script' && k > PAYMENT_STEP)),
    reasked: s.mode === 'script' && k >= APPROVAL_STEP,
    resumeMin: s.mode === 'script' ? 30 : s.mode === 'ckpt' ? 15 : 0.2,
  };
}
