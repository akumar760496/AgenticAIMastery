/** Kosh Finance (fictional) loan bundle: 2,50,000 tokens, 30 single-fact and 20 multi-hop questions; ₹62.5 a full read. */
export type LongContextApproach = 'stuff' | 'retrieve' | 'quote';
export type QuestionPlacement = 'after' | 'before';
export interface LongContextState { readonly approach: LongContextApproach; readonly placement: QuestionPlacement; readonly cache: boolean; readonly tags: boolean }
export interface LongContextResult { readonly single: number; readonly multiHop: number; readonly accuracy: number; readonly costPerQuestion: number; readonly latencyS: number; readonly citeRate: number }

const BASE: Readonly<Record<LongContextApproach, readonly [number, number]>> = { stuff: [0.86, 0.7], retrieve: [0.9, 0.56], quote: [0.92, 0.82] };
const FULL_READ_RUPEES = 62.5;
const QUESTIONS = 50;

export function simulateLongContext(s: LongContextState): LongContextResult {
  let [single, multiHop] = BASE[s.approach];
  const retrieve = s.approach === 'retrieve';
  if (s.placement === 'before') { const drop = retrieve ? 0.02 : 0.08; single -= drop; multiHop -= drop; }
  if (s.tags && !retrieve) multiHop += 0.03;
  let costPerQuestion = retrieve ? 2.5 : s.cache ? (FULL_READ_RUPEES * (1 + (QUESTIONS - 1) * 0.1)) / QUESTIONS : FULL_READ_RUPEES;
  let latencyS = retrieve ? 3 : s.cache ? 6 : 20;
  if (s.approach === 'quote') { costPerQuestion += 1; latencyS += 2; }
  return { single, multiHop, accuracy: (30 * single + 20 * multiHop) / QUESTIONS, costPerQuestion, latencyS, citeRate: s.tags ? 0.9 : 0.6 };
}
