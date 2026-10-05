/** InfoNCE on one (anchor, positive, hard negative) example: replays N gradient steps from fixed starting similarities. */
export const EASY_NEGATIVE_SIMILARITY = 0.1;
const LEARNING_RATE = 0.08;
export const INITIAL = { positive: 0.62, hardNegative: 0.71 } as const;
export const TEMPERATURES = [0.05, 0.1, 0.5, 1] as const;
export const BATCH_SIZES = [8, 32, 128] as const;

export interface ContrastiveState { readonly hardNegative: boolean; readonly temperature: number; readonly batchSize: number; readonly steps: number }
export interface ContrastiveResult {
  readonly positiveSimilarity: number;
  readonly hardNegativeSimilarity: number;
  readonly pPositive: number;
  readonly pHard: number;
  readonly pEasy: number;
  readonly loss: number;
  readonly ranksCorrectly: boolean;
  readonly margin: number;
}

function softmax(sp: number, sh: number, s: ContrastiveState) {
  const ep = Math.exp(sp / s.temperature);
  const eh = s.hardNegative ? Math.exp(sh / s.temperature) : 0;
  const ee = (s.batchSize - 1) * Math.exp(EASY_NEGATIVE_SIMILARITY / s.temperature);
  const z = ep + eh + ee;
  return { p: ep / z, ph: eh / z, pe: ee / z };
}

export function simulateContrastive(s: ContrastiveState): ContrastiveResult {
  let sp: number = INITIAL.positive;
  let sh: number = INITIAL.hardNegative;
  for (let i = 0; i < s.steps; i++) {
    const { p, ph } = softmax(sp, sh, s);
    const dp = LEARNING_RATE * (1 - p);
    sp = Math.min(0.99, sp + dp);
    // Without the hard negative in the loss, the look-alike drifts with the positive.
    sh = s.hardNegative ? Math.max(-1, sh - LEARNING_RATE * ph) : Math.min(0.99, sh + 0.9 * dp);
  }
  const { p, ph, pe } = softmax(sp, sh, s);
  return { positiveSimilarity: sp, hardNegativeSimilarity: sh, pPositive: p, pHard: ph, pEasy: pe, loss: -Math.log(p), ranksCorrectly: sp > sh, margin: sp - sh };
}
