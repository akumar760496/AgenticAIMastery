/** Tool count, description quality, result size and error style for a hospital scheduling agent (3 calls per task). */
export type DescriptionStyle = 'terse' | 'full';
export type ResultStyle = 'raw' | 'concise';
export type ErrorStyle = 'code' | 'actionable';
const SYSTEM_TOKENS = 1500;
const INR_PER_MILLION = 250;

export interface ToolDesignState { readonly tools: number; readonly descriptions: DescriptionStyle; readonly results: ResultStyle; readonly errors: ErrorStyle; readonly toolSearch: boolean }
export interface ToolDesignResult { readonly accuracy: number; readonly definitionTokens: number; readonly resultTokens: number; readonly retries: number; readonly wrongChoices: number; readonly badArguments: number; readonly callsPerTask: number; readonly tokensPerTask: number; readonly costPer1000: number }

export function simulateToolDesign(s: ToolDesignState): ToolDesignResult {
  const full = s.descriptions === 'full';
  const loaded = s.toolSearch ? 5 : s.tools;
  const perTool = full ? 220 : 60;
  // Past about 15 tools each extra similar tool makes the choice harder.
  const accuracy = Math.max(0.3, (s.toolSearch ? 0.99 : 1) * ((full ? 0.98 : 0.85) - Math.max(0, loaded - 15) * (full ? 0.004 : 0.006)));
  const definitionTokens = s.toolSearch ? 500 + 5 * perTool : s.tools * perTool;
  const resultTokens = s.results === 'raw' ? 4100 : 380;
  const retries = s.errors === 'actionable' ? 1 : 3;
  const wrongChoices = 3 * (1 - accuracy);
  const badArguments = 3 * (full ? 0.05 : 0.15);
  const callsPerTask = 3 + wrongChoices + badArguments * retries;
  const tokensPerTask = (callsPerTask + 1) * (SYSTEM_TOKENS + definitionTokens) + callsPerTask * resultTokens * 1.5;
  return { accuracy, definitionTokens, resultTokens, retries, wrongChoices, badArguments, callsPerTask, tokensPerTask, costPer1000: (tokensPerTask * 1000 * INR_PER_MILLION) / 1e6 };
}
