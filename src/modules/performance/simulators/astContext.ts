/** How a coding agent loads code for a fix: whole file, grep, or syntax-tree node plus callers. */
export type LoadMode = 'file' | 'grep' | 'ast';
export const CONTEXT_WINDOW = 128000;
const TOKENS_PER_LINE = 10;
const RELEVANT_IN_FILE = 36;
const GREP_MATCHES = 38;
const GREP_LINES_PER_MATCH = 21;
const FUNCTION_LINES = 16;
const WITH_CALLERS_LINES = 56;

export interface AstContextState { readonly mode: LoadMode; readonly fileLines: number; readonly loadCallers: boolean; readonly reparse: boolean }
export interface AstContextResult { readonly loadedLines: number; readonly relevantLines: number; readonly tokens: number; readonly windowShare: number; readonly precision: number; readonly bothCallers: boolean; readonly testRuns: number }

export function simulateAstContext(s: AstContextState): AstContextResult {
  let loadedLines: number;
  let relevantLines: number;
  let bothCallers: boolean;
  if (s.mode === 'file') { loadedLines = s.fileLines; relevantLines = RELEVANT_IN_FILE; bothCallers = false; }
  else if (s.mode === 'grep') { loadedLines = GREP_MATCHES * GREP_LINES_PER_MATCH; relevantLines = WITH_CALLERS_LINES; bothCallers = true; }
  else { loadedLines = s.loadCallers ? WITH_CALLERS_LINES : FUNCTION_LINES; relevantLines = loadedLines; bothCallers = s.loadCallers; }
  const tokens = loadedLines * TOKENS_PER_LINE;
  return { loadedLines, relevantLines, tokens, windowShare: tokens / CONTEXT_WINDOW, precision: relevantLines / loadedLines, bothCallers, testRuns: s.reparse ? 1 : 2 };
}
