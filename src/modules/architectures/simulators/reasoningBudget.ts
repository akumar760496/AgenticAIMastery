/** Thinking budgets for an underwriting assistant: accuracy on easy and hard files, tokens and cost, with optional routing. */
export const BUDGETS = [0, 1000, 4000, 16000, 32000] as const;
export type Budget = (typeof BUDGETS)[number];
export type TrafficMix = 'easy' | 'bal' | 'hard';
const HARD_ACC = [0.41, 0.58, 0.74, 0.86, 0.866];
const EASY_ACC = [0.96, 0.97, 0.97, 0.97, 0.97];
const HARD_SHARE: Readonly<Record<TrafficMix, number>> = { easy: 0.2, bal: 0.5, hard: 0.8 };
const BASE_OUTPUT = 350;
const MISJUDGED_HARD = 0.02;
const INPUT_INR_PER_1000_FILES = 500;
const TOKENS_PER_SECOND = 150;

export interface ReasoningState { readonly budget: Budget; readonly mix: TrafficMix; readonly route: boolean }
export interface ReasoningResult { readonly easy: number; readonly hard: number; readonly overall: number; readonly tokensPerFile: number; readonly easyTokens: number; readonly hardTokens: number; readonly costPer1000: number; readonly flatCostPer1000: number; readonly p95S: number; readonly gainPoints: number | null }

export function simulateReasoning(s: ReasoningState): ReasoningResult {
  const i = BUDGETS.indexOf(s.budget);
  const B = s.budget;
  const h = HARD_SHARE[s.mix];
  const flatEasy: [number, number] = [EASY_ACC[i]!, BASE_OUTPUT + 0.25 * B];
  const flatHard: [number, number] = [HARD_ACC[i]!, BASE_OUTPUT + 0.9 * B];
  const easy = s.route ? [EASY_ACC[0]!, BASE_OUTPUT] : flatEasy;
  const hard = s.route ? [(1 - MISJUDGED_HARD) * HARD_ACC[i]! + MISJUDGED_HARD * HARD_ACC[0]!, (1 - MISJUDGED_HARD) * (BASE_OUTPUT + 0.9 * B) + MISJUDGED_HARD * BASE_OUTPUT] : flatHard;
  const tokensPerFile = (1 - h) * easy[1]! + h * hard[1]!;
  const flatTokens = (1 - h) * flatEasy[1] + h * flatHard[1];
  return {
    easy: easy[0]!, hard: hard[0]!, overall: (1 - h) * easy[0]! + h * hard[0]!,
    tokensPerFile, easyTokens: easy[1]!, hardTokens: hard[1]!,
    costPer1000: INPUT_INR_PER_1000_FILES + tokensPerFile, flatCostPer1000: INPUT_INR_PER_1000_FILES + flatTokens,
    p95S: (h > 0.05 ? hard[1]! : easy[1]!) / TOKENS_PER_SECOND + 1,
    gainPoints: i ? (HARD_ACC[i]! - HARD_ACC[i - 1]!) * 100 : null,
  };
}
