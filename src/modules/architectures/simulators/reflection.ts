/** Reflection loops on a loan-sanction letter: no evaluator, self-critique, or a rules checklist, with optional memory. */
export type Feedback = 'none' | 'self' | 'rules';
const SEQUENCES: Readonly<Record<string, readonly number[]>> = { none: [62], self: [62, 70, 74, 71, 66], selfm: [66, 73, 76, 72, 68], rules: [62, 81, 92, 97, 100], rulesm: [72, 90, 98, 100] };
const DRAFT_INR = 1.5;
const EVAL_INR: Readonly<Record<Feedback, number>> = { none: 0, self: 0.4, rules: 0.1 };
const MEMORY_INR = 0.05;

export interface ReflectionState { readonly feedback: Feedback; readonly maxRounds: number; readonly memory: boolean }
export interface ReflectionResult { readonly scores: readonly number[]; readonly costInr: number; readonly best: number; readonly bestRound: number; readonly last: number; readonly regressed: boolean; readonly rounds: number; readonly roundReaching90: number }

export function simulateReflection(s: ReflectionState): ReflectionResult {
  const useMemory = s.memory && s.feedback !== 'none';
  const seq = SEQUENCES[s.feedback + (useMemory ? 'm' : '')] ?? [62];
  const cap = s.feedback === 'none' ? 1 : s.maxRounds;
  const scores: number[] = [];
  for (let i = 0; i < Math.min(cap, seq.length); i++) { scores.push(seq[i]!); if (s.feedback === 'rules' && seq[i]! >= 100) break; }
  const best = Math.max(...scores);
  const hit = scores.findIndex((v) => v >= 90);
  return {
    scores, best, bestRound: scores.indexOf(best) + 1, last: scores[scores.length - 1]!,
    costInr: scores.length * (DRAFT_INR + EVAL_INR[s.feedback]) + (useMemory ? MEMORY_INR : 0),
    regressed: scores.some((v, i) => i > 0 && v < scores[i - 1]!),
    rounds: scores.length, roundReaching90: hit < 0 ? 0 : hit + 1,
  };
}
