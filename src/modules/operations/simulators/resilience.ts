/** A 20-minute provider outage at 20 requests/s: timeouts, retries, a circuit breaker and fallbacks against a pool of 200 workers. */
export type Fallback = 'none' | 'secondary' | 'cache';
const RPS = 20;
export const POOL = 200;
const HEALTHY_S = 2;

export interface ResilienceState { readonly timeoutS: number; readonly retries: number; readonly breaker: boolean; readonly fallback: Fallback }
export interface ResilienceResult { readonly answeredWell: number; readonly meanS: number; readonly busyWorkers: number; readonly saturated: boolean; readonly p95S: number }

export function simulateResilience(s: ResilienceState): ResilienceResult {
  // A 3 s timeout also cuts off the slowest 10% of healthy calls.
  const primaryFail = s.timeoutS === 3 ? 0.46 : 0.4;
  const fallbackGood = s.fallback === 'secondary' ? 0.97 : s.fallback === 'cache' ? 0.9 : 0;
  const fallbackS = s.fallback === 'secondary' ? 3 : s.fallback === 'cache' ? 0.1 : 0.05;
  const toPrimary = s.breaker ? 0.1 : 1;
  const attempts = s.retries + 1;
  const outcomes: [prob: number, seconds: number, good: number][] = [];
  for (let i = 0; i < attempts; i++) outcomes.push([toPrimary * Math.pow(primaryFail, i) * (1 - primaryFail), i * s.timeoutS + HEALTHY_S, 1]);
  outcomes.push([toPrimary * Math.pow(primaryFail, attempts), attempts * s.timeoutS + (s.fallback === 'none' ? 0 : fallbackS), fallbackGood]);
  if (s.breaker) outcomes.push([1 - toPrimary, fallbackS, fallbackGood]);
  let answeredWell = 0; let meanS = 0;
  for (const [p, t, g] of outcomes) { answeredWell += p * g; meanS += p * t; }
  const busyWorkers = RPS * meanS;
  const saturated = busyWorkers > POOL;
  if (saturated) answeredWell *= POOL / busyWorkers;
  const sorted = [...outcomes].sort((a, b) => a[1] - b[1]);
  let cumulative = 0; let p95S = sorted[sorted.length - 1]![1];
  for (const [p, t] of sorted) { cumulative += p; if (cumulative >= 0.95 - 1e-9) { p95S = t; break; } }
  return { answeredWell, meanS, busyWorkers, saturated, p95S };
}
