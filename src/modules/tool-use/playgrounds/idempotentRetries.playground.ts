import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { REFUND_INR, simulateIdempotency, type IdempotencyResult, type IdempotencyState } from '../simulators/idempotentRetries';

const base: IdempotencyState = { failurePct: 30, lostResponses: true, retries: 2, key: 'none', jitter: false };

export const idempotentRetriesPlayground = definePlayground<IdempotencyState, IdempotencyResult>({
  techniqueId: 'idempotency',
  title: '100 UPI refunds of ₹2,499 · 10 s timeout · backoff 0.5 s × 2^n, capped at 8 s',
  intro: 'For the retry burst, assume an outage fails all 100 first attempts at the same moment.',
  controls: [
    { kind: 'steps', key: 'failurePct', label: 'Failure rate per attempt', values: Array.from({ length: 11 }, (_, i) => i * 5), format: (v) => `${v}%` },
    { kind: 'toggle', key: 'lostResponses', label: 'Failures are lost responses: the refund ran, the reply never arrived' },
    { kind: 'steps', key: 'retries', label: 'Retries after a failure', values: [0, 1, 2, 3, 4, 5], format: String },
    { kind: 'select', key: 'key', label: 'Idempotency key', options: [{ value: 'none', label: 'none' }, { value: 'new', label: 'a new key on every attempt' }, { value: 'one', label: 'one key per refund, reused on retries' }] },
    { kind: 'toggle', key: 'jitter', label: 'Full jitter on the backoff' },
  ],
  presets: {
    start: { state: base, expected: { confirmed: 0.973, duplicatesPer100: 39, peakBurst: 100, p95S: 24 } },
    fresh: { state: { ...base, key: 'new' }, expected: { duplicatesPer100: 39 } },
    safe: { state: { ...base, key: 'one' }, expected: { duplicatesPer100: 0, confirmed: 0.973, peakBurst: 100 } },
    storm: { state: { failurePct: 50, lostResponses: false, retries: 5, key: 'one', jitter: false }, expected: { duplicatesPer100: 0, confirmed: 0.984375, peakBurst: 100, p95S: 56 } },
  },
  initialPreset: 'start',
  simulate: simulateIdempotency,
  outputs: [
    { kind: 'meter', label: 'Refunds confirmed to the agent', value: (r) => r.confirmed, emphasis: (r) => (r.confirmed < 0.99 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Duplicate refunds per 100', value: (r) => r.duplicatesPer100.toFixed(1), detail: (r) => (r.duplicatesPer100 ? `₹${formatCount(Math.round(r.duplicatesPer100 * REFUND_INR))} paid twice` : 'nothing is paid twice'), emphasis: (r) => (r.duplicatesPer100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Peak retry burst', value: (r) => `${r.peakBurst.toFixed(1)} per 100 ms` },
    { kind: 'value', label: 'p95 time to a confirmed refund', value: (r) => (r.p95S === null ? 'not reached' : `${r.p95S.toFixed(1)} s`) },
  ],
  verdict: (r, s) => {
    if (r.duplicatesPer100 > 0) return { tone: 'no', headline: `${r.duplicatesPer100.toFixed(1)} duplicate refunds per 100.`, detail: s.key === 'new' ? 'A new key per attempt looks like a new refund to the gateway.' : 'Without a key the gateway cannot tell a retry from a new refund.' };
    if (r.confirmed < 0.99) return { tone: 'mid', headline: 'Safe, but not reliable enough.', detail: 'Add retries to confirm more refunds.' };
    return r.peakBurst >= 20 ? { tone: 'mid', headline: 'Safe to retry.', detail: 'Add jitter so retries do not arrive together.' } : { tone: 'ok', headline: 'Safe to retry.', detail: 'One key per refund, bounded retries and jitter.' };
  },
  narrate: (r, s) => [
    `Each attempt fails ${s.failurePct}% of the time${s.lostResponses ? ', and a failure here means the refund ran but the reply was lost' : ', before the refund runs'}. With ${s.retries} retries, ${formatWholePercent(r.confirmed)} of refunds are confirmed.`,
    s.lostResponses ? (s.key === 'one' ? 'Every retry carries the same key, so the gateway returns the stored result instead of paying again.' : `${s.key === 'new' ? 'Each retry carries a fresh key, so the gateway sees a brand-new refund' : 'Without a key the gateway cannot tell a retry from a new refund'}: about ${r.duplicatesPer100.toFixed(1)} extra refunds per 100.`) : 'Failed attempts never reached the refund, so retries cannot duplicate it.',
    s.retries ? (s.jitter ? `Jitter spreads the retries, peaking at about ${r.peakBurst.toFixed(1)} per 100 ms.` : 'Without jitter all 100 clients retry in the same instant: a burst of 100.') : '',
  ].filter(Boolean).join(' '),
  missions: {
    nodup: ({ state, result }) => state.lostResponses && state.failurePct >= 30 && state.retries >= 2 && result.duplicatesPer100 === 0,
    reliable: ({ result }) => result.confirmed >= 0.99,
    calm: ({ state, result }) => state.retries >= 1 && result.peakBurst < 20,
  },
});
