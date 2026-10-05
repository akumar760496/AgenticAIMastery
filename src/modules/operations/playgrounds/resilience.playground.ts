import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { POOL, simulateResilience, type ResilienceResult, type ResilienceState } from '../simulators/resilience';

export const resiliencePlayground = definePlayground<ResilienceState, ResilienceResult>({
  techniqueId: 'resilience',
  title: 'A 20-minute provider outage',
  intro: '20 requests a second, a pool of 200 workers. For 20 minutes, 40% of primary calls hang; healthy calls take 2 s. A 3 s timeout also cuts off the slowest 10% of healthy calls.',
  controls: [
    { kind: 'steps', key: 'timeoutS', label: 'Timeout per call', values: [600, 30, 8, 3], format: (v) => (v === 600 ? '600 s (SDK default)' : `${v} s`) },
    { kind: 'steps', key: 'retries', label: 'Retries on the primary', values: [0, 1, 2], format: (v) => (v === 2 ? '2 (SDK default)' : String(v)) },
    { kind: 'toggle', key: 'breaker', label: 'Circuit breaker (opens after 5 failures, probes every 30 s)' },
    { kind: 'select', key: 'fallback', label: 'Fallback', options: [{ value: 'none', label: 'None: return an error' }, { value: 'secondary', label: 'Secondary provider (3 s, 97% good)' }, { value: 'cache', label: 'Cached answer (0.1 s, 90% good)' }] },
  ],
  presets: {
    start: { state: { timeoutS: 600, retries: 2, breaker: false, fallback: 'none' }, expected: { busyWorkers: 7525.44, answeredWell: 0.0249, saturated: true } },
    timeouts: { state: { timeoutS: 8, retries: 1, breaker: false, fallback: 'none' }, expected: { busyWorkers: 123.2, answeredWell: 0.84, p95S: 16 } },
    fallback: { state: { timeoutS: 8, retries: 1, breaker: false, fallback: 'secondary' }, expected: { answeredWell: 0.9952, p95S: 19 } },
    breaker: { state: { timeoutS: 8, retries: 0, breaker: true, fallback: 'secondary' }, expected: { answeredWell: 0.9718, p95S: 3, busyWorkers: 65.2 } },
  },
  initialPreset: 'start',
  simulate: simulateResilience,
  outputs: [
    { kind: 'meter', label: 'Requests answered well', value: (r) => r.answeredWell, detail: (r) => `= ${formatPercent(r.answeredWell, 1)}`, emphasis: (r) => (r.answeredWell < 0.95 ? 'warn' : 'normal') },
    { kind: 'meter', label: `Busy workers (pool of ${POOL})`, value: (r) => Math.min(1, r.busyWorkers / POOL), detail: (r) => `= ${formatCount(Math.round(r.busyWorkers))} busy at once`, emphasis: (r) => (r.saturated ? 'warn' : 'normal') },
    { kind: 'value', label: 'p95 latency', value: (r) => `${r.p95S.toFixed(1)} s` },
  ],
  verdict: (r) => {
    if (r.saturated) return { tone: 'no', headline: 'The service is down.', detail: 'Hung calls hold every worker; requests queue and are rejected.' };
    if (r.answeredWell >= 0.95 && r.p95S < 8) return { tone: 'ok', headline: 'Up and fast.', detail: 'The breaker skips the failing provider and the fallback answers.' };
    return r.answeredWell >= 0.95 ? { tone: 'mid', headline: 'Up, but slow.', detail: 'Failures wait for timeouts before the fallback runs.' } : { tone: 'mid', headline: 'Failures reach users.', detail: 'Add a fallback for the calls that time out.' };
  },
  narrate: (r, s) => [
    `Each request spends ${r.meanS.toFixed(1)} s on average, so ${formatCount(Math.round(r.busyWorkers))} workers are busy at once.`,
    r.saturated ? `That is more than the pool of ${POOL}, so requests queue and are rejected: only ${formatPercent(r.answeredWell, 1)} are answered well.` : `That fits in the pool, and ${formatPercent(r.answeredWell, 1)} of requests get a good answer.`,
    s.breaker ? 'The breaker keeps about 90% of requests away from the failing provider, so they go straight to the fallback.' : s.retries > 0 ? `Each failed call is retried ${s.retries} times, adding load to a provider that is already failing.` : '',
    s.timeoutS === 600 ? 'With the 10-minute default timeout, a hung call holds its worker for up to 10 minutes.' : `p95 latency is ${r.p95S.toFixed(1)} s.`,
  ].filter(Boolean).join(' '),
  missions: {
    up: ({ result }) => result.answeredWell >= 0.95,
    fast: ({ result }) => result.answeredWell >= 0.95 && result.p95S < 8,
    pool: ({ state, result }) => state.fallback === 'none' && result.busyWorkers < POOL,
  },
});
