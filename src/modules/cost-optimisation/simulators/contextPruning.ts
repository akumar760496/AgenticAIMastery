/** Context pruning over a 20-turn advisor session; checks that two early facts survive to the final question. */
export type PruningMode = 'none' | 'window' | 'summarize';
export type SummaryDetail = 'brief' | 'detailed';

const SYSTEM_TOKENS = 2000;
const TURN_TOKENS = 900;
const EXTRACT_TOKENS = 1000;
const TURNS = 20;
const KEPT_RECENT = 4;
const PREFERENCE_TURN = 2;
const FIGURE_TURN = 5;
const SUMMARY_TOKENS: Readonly<Record<SummaryDetail, number>> = { brief: 300, detailed: 1200 };
/** Input tokens with no pruning: turn 0 sends only the system prompt. */
export const UNPRUNED_TOKENS = (TURNS + 1) * SYSTEM_TOKENS + (TURN_TOKENS + EXTRACT_TOKENS) * ((TURNS * (TURNS + 1)) / 2);
export const CONTEXT_LIMIT = 40000;

export interface ContextPruningState {
  readonly mode: PruningMode;
  readonly windowTurns: number;
  readonly thresholdTokens: number;
  readonly detail: SummaryDetail;
  readonly clearExtracts: boolean;
}

export interface ContextPruningResult {
  readonly paidTokens: number;
  readonly summaryInputTokens: number;
  readonly peakContext: number;
  readonly summaries: number;
  readonly keepsPreference: boolean;
  readonly keepsFigure: boolean;
  readonly answerCorrect: boolean;
  readonly saving: number;
  readonly relativeTokens: number;
}

interface Message { readonly turn: number; size: number }

export function simulateContextPruning(s: ContextPruningState): ContextPruningResult {
  let messages: Message[] = [];
  let summary = 0;
  let summaryHasPreference = false;
  let summaryHasFigure = false;
  let paid = SYSTEM_TOKENS;
  let peak = 0;
  let summaries = 0;
  let summaryInput = 0;
  const contextSize = () => SYSTEM_TOKENS + summary + messages.reduce((sum, m) => sum + m.size, 0);

  for (let turn = 1; turn <= TURNS; turn++) {
    messages.push({ turn, size: TURN_TOKENS + EXTRACT_TOKENS });
    if (s.clearExtracts) messages.forEach((m) => { if (m.turn < turn) m.size = TURN_TOKENS; });
    if (s.mode === 'window') messages = messages.filter((m) => m.turn > turn - s.windowTurns);
    let context = contextSize();
    if (s.mode === 'summarize' && context > s.thresholdTokens && messages.length > KEPT_RECENT) {
      const old = messages.slice(0, -KEPT_RECENT);
      summaryInput += summary + old.reduce((sum, m) => sum + m.size, 0);
      summaries++;
      summaryHasPreference ||= old.some((m) => m.turn === PREFERENCE_TURN);
      summaryHasFigure = (summaryHasFigure || old.some((m) => m.turn === FIGURE_TURN)) && s.detail === 'detailed';
      summary = SUMMARY_TOKENS[s.detail];
      messages = messages.slice(-KEPT_RECENT);
      context = contextSize();
    }
    paid += context;
    peak = Math.max(peak, context);
  }
  const keepsPreference = summaryHasPreference || messages.some((m) => m.turn === PREFERENCE_TURN);
  const keepsFigure = summaryHasFigure || messages.some((m) => m.turn === FIGURE_TURN);
  const total = paid + summaryInput;
  return {
    paidTokens: total, summaryInputTokens: summaryInput, peakContext: peak, summaries,
    keepsPreference, keepsFigure, answerCorrect: keepsPreference && keepsFigure,
    saving: 1 - total / UNPRUNED_TOKENS, relativeTokens: total / UNPRUNED_TOKENS,
  };
}
