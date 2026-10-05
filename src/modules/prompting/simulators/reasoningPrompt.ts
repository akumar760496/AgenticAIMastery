/**
 * RupeeRail (fictional) daily mix on a reasoning model: 7,000 lookups and 3,000 reconciliations.
 * Reasoning model ₹170 / ₹850 per million input / output tokens at 150 tokens/s; fast model ₹20 / ₹100 at 250 tokens/s.
 */
export type Effort = 'low' | 'medium' | 'high';
export type PromptStyle = 'scaffold' | 'goals';
export type LookupRoute = 'same' | 'low' | 'fast';
export interface ReasoningPromptState { readonly effort: Effort; readonly style: PromptStyle; readonly lookups: LookupRoute }
export interface TaskOutcome { readonly accuracy: number; readonly thinking: number; readonly cost: number; readonly p95: number }
export interface ReasoningPromptResult {
  readonly accuracy: number; readonly lookup: TaskOutcome; readonly reconciliation: TaskOutcome;
  readonly thinkingPerTask: number; readonly dailyCost: number;
}

export const LOOKUPS_PER_DAY = 7000;
export const RECONCILIATIONS_PER_DAY = 3000;
const LOOKUP_SHARE = 0.7;
const THINKING: Readonly<Record<'lookup' | 'recon', Readonly<Record<Effort, number>>>> = {
  lookup: { low: 150, medium: 600, high: 1500 },
  recon: { low: 1200, medium: 4000, high: 9000 },
};
const LOOKUP_ACCURACY: Readonly<Record<Effort, number>> = { low: 0.98, medium: 0.985, high: 0.985 };
export const RECON_ACCURACY: Readonly<Record<PromptStyle, Readonly<Record<Effort, number>>>> = {
  goals: { low: 0.72, medium: 0.87, high: 0.93 },
  scaffold: { low: 0.74, medium: 0.84, high: 0.89 },
};

function reasoningCall(inputTokens: number, thinking: number, visible: number): { cost: number; p95: number } {
  return { cost: inputTokens * 0.00017 + (thinking + visible) * 0.00085, p95: 0.5 + (1.8 * thinking + 1.3 * visible) / 150 };
}

export function simulateReasoningPrompt(s: ReasoningPromptState): ReasoningPromptResult {
  const scaffold = s.style === 'scaffold';
  const promptTokens = scaffold ? 1500 : 400;
  let lookup: TaskOutcome;
  if (s.lookups === 'fast') {
    lookup = { accuracy: 0.975, thinking: 0, cost: 1000 * 0.00002 + 80 * 0.0001, p95: 0.3 + (1.3 * 80) / 250 };
  } else {
    const effort = s.lookups === 'low' ? 'low' : s.effort;
    const thinking = THINKING.lookup[effort];
    lookup = { accuracy: LOOKUP_ACCURACY[effort], thinking, ...reasoningCall(600 + promptTokens, thinking, 80 + (scaffold ? 250 : 0)) };
  }
  const reconThinking = THINKING.recon[s.effort];
  const reconciliation: TaskOutcome = { accuracy: RECON_ACCURACY[s.style][s.effort], thinking: reconThinking, ...reasoningCall(3000 + promptTokens, reconThinking, 400 + (scaffold ? 900 : 0)) };
  return {
    accuracy: LOOKUP_SHARE * lookup.accuracy + (1 - LOOKUP_SHARE) * reconciliation.accuracy,
    lookup, reconciliation,
    thinkingPerTask: LOOKUP_SHARE * lookup.thinking + (1 - LOOKUP_SHARE) * reconciliation.thinking,
    dailyCost: LOOKUPS_PER_DAY * lookup.cost + RECONCILIATIONS_PER_DAY * reconciliation.cost,
  };
}
