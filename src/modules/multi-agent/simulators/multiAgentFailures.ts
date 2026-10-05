/** 50 coder–reviewer runs: termination caps, AND vs OR, a repetition detector and a verifier. */
export type CapOperator = 'and' | 'or';
const RUNS = 50;
const TOKENS_PER_MESSAGE_K = 4;
const MANUAL_KILL_K = 240;

export interface FailureState { readonly messageCap: boolean; readonly tokenCap: boolean; readonly timeCap: boolean; readonly repetitionDetector: boolean; readonly verifier: boolean; readonly operator: CapOperator; readonly forgetPct: number }
export type RunOutcome = 'finished' | 'early' | 'cut' | 'endless';
export interface FailureResult { readonly outcomes: readonly RunOutcome[]; readonly endless: number; readonly premature: number; readonly falseApprovals: number; readonly unverified: number; readonly loopsCut: number; readonly averageK: number; readonly baseK: number; readonly ratio: number; readonly caps: number }

export function simulateFailures(s: FailureState): FailureResult {
  const caps = [s.messageCap && 30, s.tokenCap && 25, s.timeCap && 36].filter((c): c is number => typeof c === 'number');
  let endless = 0; let premature = 0; let unverified = 0; let loopsCut = 0; let falseApprovals = 0; let tokens = 0; let base = 0;
  const outcomes: RunOutcome[] = [];
  for (let i = 0; i < RUNS; i++) {
    const n = 8 + ((i * 7) % 19);
    const loop = i % 6 === 2;
    const early = !loop && i % 9 === 4;
    const forget = !loop && !early && ((i * 0.618034) % 1) < s.forgetPct / 100;
    const completes = loop ? (s.repetitionDetector ? n + 3 : Infinity) : n;
    let signal: number;
    if (s.verifier) signal = Number.isFinite(completes) ? completes + 1 : Infinity;
    else if (loop) signal = s.repetitionDetector && !forget ? completes : Infinity;
    else if (early) signal = Math.ceil(0.6 * n);
    else signal = forget ? Infinity : n;
    const events = [signal, ...caps];
    const stop = s.operator === 'or' ? Math.min(...events) : Math.max(...events);
    base += n * TOKENS_PER_MESSAGE_K;
    if (!Number.isFinite(stop)) { endless++; tokens += MANUAL_KILL_K; outcomes.push('endless'); continue; }
    tokens += stop * TOKENS_PER_MESSAGE_K;
    let outcome: RunOutcome = 'finished';
    if (Number.isFinite(completes) && stop < completes) { premature++; outcome = 'early'; if (early && signal <= stop) falseApprovals++; }
    else if (!Number.isFinite(completes)) { loopsCut++; outcome = 'cut'; }
    if (!s.verifier && Number.isFinite(signal) && signal <= stop) unverified++;
    outcomes.push(outcome);
  }
  const averageK = tokens / RUNS; const baseK = base / RUNS;
  return { outcomes, endless, premature, falseApprovals, unverified, loopsCut, averageK, baseK, ratio: averageK / baseK, caps: caps.length };
}
