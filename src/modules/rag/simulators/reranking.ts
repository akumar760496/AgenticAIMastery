/**
 * Vyapar Mart (fictional) seller help centre: 8,000 articles. 200 questions (140 English, 60 Hinglish) plus 20 with no answer.
 * Hybrid search takes 40 ms; the latency budget is 500 ms.
 */
export type Reranker = 'none' | 'en' | 'multi' | 'llm';
export interface RerankingState { readonly reranker: Reranker; readonly scored: number; readonly kept: number; readonly threshold: boolean }
export interface RerankingResult { readonly poolRecall: number; readonly english: number; readonly hinglish: number; readonly recall: number; readonly latencyMs: number; readonly declined: number; readonly promptTokens: number }

const POOL_RECALL: Readonly<Record<number, number>> = { 10: 0.7, 20: 0.8, 50: 0.9, 100: 0.94, 200: 0.96 };
const FIRST_STAGE_AT_K: Readonly<Record<number, number>> = { 3: 0.48, 5: 0.58, 10: 0.7 };
const KEPT_FACTOR: Readonly<Record<number, number>> = { 3: 0.93, 5: 1, 10: 1.03 };
const PRECISION: Readonly<Record<Exclude<Reranker, 'none'>, readonly [number, number]>> = { en: [0.93, 0.7], multi: [0.93, 0.9], llm: [0.95, 0.93] };

export function simulateReranking(s: RerankingState): RerankingResult {
  const pool = POOL_RECALL[s.scored] ?? 0.9;
  let english: number; let hinglish: number;
  if (s.reranker === 'none') { english = FIRST_STAGE_AT_K[s.kept] ?? 0.58; hinglish = english * 0.9; }
  else {
    const [pe, ph] = PRECISION[s.reranker]; const kf = KEPT_FACTOR[s.kept] ?? 1;
    english = Math.min(0.98, pool * pe * kf); hinglish = Math.min(0.98, pool * ph * kf);
  }
  const thresholded = s.threshold && s.reranker !== 'none';
  if (thresholded) { english *= 0.985; hinglish *= 0.985; }
  const perCandidate = s.reranker === 'en' ? 1.5 * s.scored : s.reranker === 'multi' ? 2.5 * s.scored : s.reranker === 'llm' ? 900 + 8 * s.scored : 0;
  return { poolRecall: pool, english, hinglish, recall: (140 * english + 60 * hinglish) / 200, latencyMs: 40 + perCandidate, declined: thresholded ? 16 : 0, promptTokens: s.kept * 300 };
}
