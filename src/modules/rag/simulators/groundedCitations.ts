/** Kaveri Bank (fictional) staff assistant: 100 questions — 80 answerable (20 with a superseded policy also indexed), 20 not. */
export type PromptStyle = 'free' | 'grounded';
export type CitationStyle = 'none' | 'answer' | 'sentence';
export interface CitationState { readonly prompt: PromptStyle; readonly citations: CitationStyle; readonly verify: boolean; readonly filterSuperseded: boolean; readonly abstain: boolean }
export interface CitationResult { readonly unsupportedRate: number; readonly answered: number; readonly unsupportedAnswers: number; readonly outdated: number; readonly declined: number; readonly checkSeconds: number; readonly verified: boolean }

export function simulateCitations(s: CitationState): CitationResult {
  const verified = s.verify && s.citations !== 'none';
  const unsupportedRate = (s.prompt === 'grounded' ? 0.09 : 0.18) * (s.citations === 'sentence' ? 0.8 : 1) * (verified ? 0.2 : 1);
  const answered = 80 - (s.abstain ? 3 : 0);
  return {
    unsupportedRate, answered,
    unsupportedAnswers: Math.round(answered * unsupportedRate),
    outdated: s.filterSuperseded ? 0 : 8,
    declined: Math.min(20, (s.prompt === 'grounded' ? 12 : 2) + (s.abstain ? (verified ? 7 : 5) : 0)),
    checkSeconds: s.citations === 'none' ? 90 : s.citations === 'answer' ? 40 : 15,
    verified,
  };
}
