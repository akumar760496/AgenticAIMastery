/** Retrying 100 UPI refunds: lost responses, idempotency keys, exponential backoff and jitter. */
export type IdempotencyKey = 'none' | 'new' | 'one';
const TIMEOUT_S = 10;
const backoffWindow = (k: number) => Math.min(8, 0.5 * Math.pow(2, k));
export const REFUND_INR = 2499;

export interface IdempotencyState { readonly failurePct: number; readonly lostResponses: boolean; readonly retries: number; readonly key: IdempotencyKey; readonly jitter: boolean }
export interface IdempotencyResult { readonly confirmed: number; readonly duplicatesPer100: number; readonly peakBurst: number; readonly p95S: number | null }

export function simulateIdempotency(s: IdempotencyState): IdempotencyResult {
  const p = s.failurePct / 100;
  const R = s.retries;
  let executions = 0;
  for (let k = 0; k <= R; k++) executions += Math.pow(p, k);
  const duplicatesPer100 = s.lostResponses && s.key !== 'one' ? 100 * (executions - 1) : 0;
  let peakBurst = 0;
  if (R >= 1) {
    if (s.jitter) for (let k = 1; k <= R; k++) peakBurst += (100 * Math.pow(p, k - 1)) / (backoffWindow(k) / 0.1);
    else peakBurst = 100;
  }
  let need = -1;
  for (let k = 1; k <= R + 1; k++) if (1 - Math.pow(p, k) >= 0.95) { need = k; break; }
  let p95S: number | null = null;
  if (need > 0) { p95S = 1; for (let j = 1; j < need; j++) p95S += TIMEOUT_S + (s.jitter ? backoffWindow(j) / 2 : backoffWindow(j)); }
  return { confirmed: 1 - Math.pow(p, R + 1), duplicatesPer100, peakBurst, p95S };
}
