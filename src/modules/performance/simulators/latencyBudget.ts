/** A latency budget for one support question: intent step, tool fan-out, streaming and a timeout on the slow exchange log. Times in ms. */
export type IntentStep = 'large' | 'small' | 'merged';
export type ScreenMode = 'off' | 'tokens' | 'status';
export type LogTimeout = 0 | 1500 | 1000;

/** [p50 ms, p95 ms, extra ms inside the answer call] */
const INTENT: Readonly<Record<IntentStep, readonly [number, number, number]>> = { large: [600, 900, 0], small: [250, 350, 0], merged: [0, 0, 100] };
/** [exchange-log p95 ms, share of answers that fall back] */
const TIMEOUT: Readonly<Record<LogTimeout, readonly [number, number]>> = { 0: [2400, 0], 1500: [1500, 0.08], 1000: [1000, 0.2] };
const TOOLS_P50 = [300, 450, 800] as const;
const TOOLS_P95_FIXED = [400, 600] as const;
const RETRIEVAL = [150, 200] as const;
const ANSWER = [2400, 3200] as const;
const FIRST_TOKEN = [500, 800] as const;
const STATUS_LINE = [300, 400] as const;
export const DAILY_QUESTIONS = 10000;
export const BUDGET = { firstWordsP95: 3000, totalP95: 5500, degradedShare: 0.1 } as const;

export interface LatencyBudgetState { readonly intent: IntentStep; readonly parallelTools: boolean; readonly screen: ScreenMode; readonly logTimeout: LogTimeout }
export interface LatencyBudgetResult {
  readonly tools50: number; readonly tools95: number;
  readonly total50: number; readonly total95: number;
  readonly words50: number; readonly words95: number;
  readonly visible50: number; readonly visible95: number;
  /** Abandonment, percent of users. */
  readonly abandonPct: number;
  readonly degradedShare: number;
  readonly abandonedPerDay: number;
  readonly degradedPerDay: number;
  readonly wordsOk: boolean; readonly totalOk: boolean; readonly degradedOk: boolean;
}

export function simulateLatencyBudget(s: LatencyBudgetState): LatencyBudgetResult {
  const [i50, i95, inAnswer] = INTENT[s.intent];
  const [log95, degradedShare] = TIMEOUT[s.logTimeout];
  const tools50 = s.parallelTools ? Math.max(...TOOLS_P50) : TOOLS_P50.reduce((a, b) => a + b, 0);
  const tools95 = s.parallelTools ? Math.max(...TOOLS_P95_FIXED, log95) : TOOLS_P95_FIXED[0] + TOOLS_P95_FIXED[1] + log95;
  const pre50 = i50 + tools50 + RETRIEVAL[0];
  const pre95 = i95 + tools95 + RETRIEVAL[1];
  const total50 = pre50 + ANSWER[0] + inAnswer;
  const total95 = pre95 + ANSWER[1] + inAnswer;
  const words50 = s.screen === 'off' ? total50 : pre50 + FIRST_TOKEN[0] + inAnswer;
  const words95 = s.screen === 'off' ? total95 : pre95 + FIRST_TOKEN[1] + inAnswer;
  const visible50 = s.screen === 'status' ? STATUS_LINE[0] : words50;
  const visible95 = s.screen === 'status' ? STATUS_LINE[1] : words95;
  const abandonPct = Math.min(60, 4 * Math.max(0, visible50 / 1000 - 1) + 2 * Math.max(0, words50 / 1000 - Math.max(visible50 / 1000, 1)));
  return {
    tools50, tools95, total50, total95, words50, words95, visible50, visible95, abandonPct, degradedShare,
    abandonedPerDay: Math.round(abandonPct * (DAILY_QUESTIONS / 100)),
    degradedPerDay: Math.round(degradedShare * DAILY_QUESTIONS),
    wordsOk: words95 <= BUDGET.firstWordsP95, totalOk: total95 <= BUDGET.totalP95, degradedOk: degradedShare <= BUDGET.degradedShare,
  };
}
