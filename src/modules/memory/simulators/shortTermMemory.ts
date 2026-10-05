/** A long call: tool-result clearing and compaction against a 200k window (all sizes in thousands of tokens). */
export type Compaction = 0 | 1 | 2;
const PINNED = 4;
const SUMMARY = 6;
const COMPACT_AT = 80;
export const WINDOW = 200;
const EARLY_FACTS = 5;

export interface ShortTermState { readonly turns: number; readonly resultK: number; readonly clearAbove: number; readonly keepLast: number; readonly compaction: Compaction }
export interface ShortTermResult { readonly peakK: number; readonly totalK: number; readonly factsLeft: number; readonly compactions: number; readonly clears: number; readonly rewrites: number; readonly truncated: boolean; readonly series: readonly number[]; readonly reduction: number }

function run(s: ShortTermState) {
  let dialogue = 0; let results: number[] = []; let summary = 0; let compactions = 0; let clears = 0; let peakK = 0; let totalK = 0; let truncated = false;
  const series: number[] = [];
  const size = () => PINNED + summary + dialogue + results.reduce((a, b) => a + b, 0);
  for (let t = 1; t <= s.turns; t++) {
    dialogue += 1; results.push(s.resultK);
    let ctx = size();
    if (s.clearAbove && ctx > s.clearAbove && results.length > s.keepLast) { results = results.slice(-s.keepLast); clears++; ctx = size(); }
    if (s.compaction && ctx > COMPACT_AT) { summary = SUMMARY; dialogue = 1; results = [s.resultK]; compactions++; ctx = size(); }
    if (ctx > WINDOW) { truncated = true; ctx = WINDOW; }
    peakK = Math.max(peakK, ctx); totalK += ctx; series.push(ctx);
  }
  // Generic summaries paraphrase exact values; keep-IDs summaries survive three rounds, then summaries of summaries drift.
  let factsLeft = EARLY_FACTS;
  if (truncated) factsLeft = 0;
  else if (s.compaction === 1) factsLeft = Math.max(0, EARLY_FACTS - 2 * compactions);
  else if (s.compaction === 2) factsLeft = Math.max(0, EARLY_FACTS - Math.max(0, compactions - 3));
  return { peakK, totalK, factsLeft, compactions, clears, rewrites: compactions + clears, truncated, series };
}

export const SHORT_TERM_START: ShortTermState = { turns: 120, resultK: 3.5, clearAbove: 0, keepLast: 3, compaction: 0 };
const START_TOTAL = run(SHORT_TERM_START).totalK;

export function simulateShortTerm(s: ShortTermState): ShortTermResult {
  const r = run(s);
  return { ...r, reduction: 1 - r.totalK / START_TOTAL };
}
