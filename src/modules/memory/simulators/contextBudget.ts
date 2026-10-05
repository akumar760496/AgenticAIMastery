/** How much context to send: size, near-duplicate distractors, key-fact position and question placement (illustrative decay curve). */
export const CONTEXT_SIZES_K = [4, 8, 16, 32, 64, 128, 200] as const;
export type FactPosition = 'start' | 'middle' | 'end';
const CHUNK_K = 3;
const REQUIRED_RANKS = [1, 2, 4];
const MAX_CHUNKS = 40;

export interface ContextBudgetState { readonly sizeIndex: number; readonly distractors: number; readonly position: FactPosition; readonly questionLast: boolean }
export interface ContextBudgetResult {
  readonly budgetK: number; readonly relevant: number; readonly distractors: number; readonly facts: number; readonly tokensK: number;
  readonly accuracy: number; readonly accuracyIfMiddle: number; readonly edgeGain: number; readonly decay: number; readonly middlePenalty: number; readonly costUsd: number;
  /** Baseline (the start preset) for the reduction mission. */
  readonly startTokensK: number; readonly startAccuracy: number;
}

function evaluate(s: ContextBudgetState) {
  const budgetK = CONTEXT_SIZES_K[s.sizeIndex] ?? 128;
  const slots = Math.max(0, Math.floor((budgetK - 2) / CHUNK_K));
  const distractors = Math.min(s.distractors, slots);
  const relevant = Math.min(MAX_CHUNKS, slots - distractors);
  const facts = REQUIRED_RANKS.filter((r) => r <= relevant).length;
  const tokensK = 2 + CHUNK_K * (relevant + distractors);
  const decay = tokensK <= 8 ? 1 : 1 - 0.06 * Math.log2(tokensK / 8);
  const distractorPenalty = 0.01 * distractors * (1 + tokensK / 128);
  const middle = 0.12 * Math.min(1, tokensK / 32);
  const questionPenalty = s.questionLast ? 0 : 0.06 * Math.min(1, tokensK / 32);
  const base = 0.97 * (facts / 3) * decay - distractorPenalty - questionPenalty;
  const accuracy = Math.max(0, base - (s.position === 'middle' ? middle : 0));
  const accuracyIfMiddle = Math.max(0, base - middle);
  return { budgetK, relevant, distractors, facts, tokensK, accuracy, accuracyIfMiddle, edgeGain: accuracy - accuracyIfMiddle, decay, middlePenalty: s.position === 'middle' ? middle : 0, costUsd: (tokensK * 3) / 1000 };
}

export const CONTEXT_START: ContextBudgetState = { sizeIndex: 5, distractors: 4, position: 'middle', questionLast: false };
const START = evaluate(CONTEXT_START);

export const simulateContextBudget = (s: ContextBudgetState): ContextBudgetResult => ({ ...evaluate(s), startTokensK: START.tokensK, startAccuracy: START.accuracy });
