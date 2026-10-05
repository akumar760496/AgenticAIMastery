/** Prompt templates and a golden suite: will a regression in a 3% intent be caught before release? */
export type VariablePlacement = 'top' | 'end';
export interface PromptTemplatesState { readonly strict: boolean; readonly variables: VariablePlacement; readonly wrap: boolean; readonly cases: number; readonly ci: boolean }
export interface PromptTemplatesResult { readonly coverage: number; readonly catchChance: number; readonly blankVariableShare: number; readonly cacheHit: number; readonly exposed: boolean }

const BROKEN_INTENT_SHARE = 0.03;
const MANUAL_RUN_FACTOR = 0.3;

export function simulatePromptTemplates(s: PromptTemplatesState): PromptTemplatesResult {
  const coverage = s.cases === 0 ? 0 : 1 - (1 - BROKEN_INTENT_SHARE) ** s.cases;
  return {
    coverage,
    catchChance: coverage * (s.ci ? 1 : MANUAL_RUN_FACTOR),
    blankVariableShare: s.strict ? 0 : 0.04,
    cacheHit: s.variables === 'end' ? 0.85 : 0,
    exposed: !s.wrap,
  };
}
