import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent, pluralise } from '@/shared/format';
import { INTERACTIVE_LOAD, simulateWorkloadScheduling, type WorkloadSchedulingResult, type WorkloadSchedulingState } from '../simulators/workloadScheduling';

const clock = (x: number) => { let h = Math.floor(x); let m = Math.round((x - h) * 60); if (m === 60) { h++; m = 0; } return `${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };
const interactiveTotal = INTERACTIVE_LOAD.reduce((a, b) => a + b, 0);

export const workloadSchedulingPlayground = definePlayground<WorkloadSchedulingState, WorkloadSchedulingResult>({
  techniqueId: 'scheduling',
  title: 'Chat plus a nightly job',
  controls: [
    { kind: 'note', text: 'Live chat follows the market day. Contract-note summaries for 2,00,000 clients (24 unit-hours of work) become available at 16:00 and must be ready by 08:00. One unit serves 1,000 requests an hour at $2.50 per unit-hour.' },
    { kind: 'select', key: 'mode', label: 'Background job', options: [{ value: 'now', label: 'Start at 16:00 at full speed' }, { value: 'queue', label: 'Priority queue: use spare capacity only' }] },
    { kind: 'steps', key: 'capacity', label: 'Reserved capacity', values: [6, 7, 8, 9, 10, 11, 12, 13, 14], format: (v) => `${v} units` },
    { kind: 'steps', key: 'jobLimit', label: 'Background concurrency limit', values: [1, 2, 3, 4, 5, 6], format: (v) => `${v} ${pluralise(v, 'unit')}` },
    { kind: 'toggle', key: 'dedup', label: 'Skip duplicate notes (a quarter of the job)' },
  ],
  presets: {
    start: { state: { mode: 'now', capacity: 11, jobLimit: 6, dedup: false }, expected: { peak: 11, delayed: 0, onTime: true, finishClock: 20, costPerDayUsd: 660 } },
    queue: { state: { mode: 'queue', capacity: 11, jobLimit: 6, dedup: false }, expected: { delayed: 0, onTime: true } },
    under: { state: { mode: 'now', capacity: 8, jobLimit: 6, dedup: false }, expected: { delayed: 8 } },
  },
  initialPreset: 'start',
  simulate: simulateWorkloadScheduling,
  outputs: [
    { kind: 'table', columns: ['Hour', 'Chat', 'Job', 'Total'], rows: (r) => INTERACTIVE_LOAD.map((load, h) => [`${String(h).padStart(2, '0')}h`, String(load), (r.background[h] ?? 0) ? String(+(r.background[h] ?? 0).toFixed(2)) : '–', String(+(load + (r.background[h] ?? 0)).toFixed(2))]).filter((_row, h) => (r.background[h] ?? 0) > 0 || (INTERACTIVE_LOAD[h] ?? 0) >= 7) },
    { kind: 'meter', label: 'Capacity utilisation', value: (r) => r.utilisation, detail: (r) => `= ${interactiveTotal + r.work} unit-hours of work ÷ 24 hours of capacity` },
    { kind: 'value', label: 'Peak demand', value: (r) => `${r.peak} units` },
    { kind: 'value', label: 'Chat delayed', value: (r) => (r.delayed ? `${r.delayed} unit-hours` : 'none'), emphasis: (r) => (r.delayed ? 'warn' : 'normal') },
    { kind: 'value', label: 'Reports ready', value: (r) => (r.onTime && r.finishClock !== null ? clock(r.finishClock) : 'not by 08:00'), detail: (r) => (r.onTime ? '' : `${r.left} unit-hours still queued at 08:00`), emphasis: (r) => (r.onTime ? 'normal' : 'warn') },
    { kind: 'value', label: 'Reserved capacity cost', value: (r) => `$${formatCount(r.costPerDayUsd)} a day` },
  ],
  verdict: (r, s) => {
    if (r.delayed) return { tone: 'no', headline: 'Customers are waiting.', detail: 'Demand exceeds reserved capacity in some hours.' };
    if (!r.onTime) return { tone: 'no', headline: 'The reports are late.', detail: 'The job did not get enough capacity overnight.' };
    return s.capacity <= 8
      ? { tone: 'ok', headline: 'Right-sized.', detail: 'Capacity matches the chat peak and the job fits in the quiet hours.' }
      : { tone: 'mid', headline: 'Safe, but oversized.', detail: 'You are paying for capacity the job only needs for a few hours.' };
  },
  narrate: (r, s) => [
    s.mode === 'now' ? `The job starts at 16:00 at ${s.jobLimit} units, on top of the afternoon chat load, so demand peaks at ${r.peak} units.` : `The priority queue gives chat first call on capacity and lets the job use whatever is spare, up to ${s.jobLimit} ${pluralise(s.jobLimit, 'unit')} an hour.`,
    r.delayed ? `Reserved capacity is ${s.capacity} units, so ${r.delayed} unit-hours of chat traffic wait.` : `Chat is never delayed at ${s.capacity} units.`,
    r.onTime && r.finishClock !== null ? `The ${r.work} unit-hours of summaries are done at ${clock(r.finishClock)}.` : `Only ${r.work - r.left} of ${r.work} unit-hours finish by 08:00, so the reports are late.`,
    s.dedup ? 'Skipping duplicates removed a quarter of the job before it ran.' : '',
    `Utilisation is ${formatWholePercent(r.utilisation)} and capacity costs $${r.costPerDayUsd} a day.`,
  ].filter(Boolean).join(' '),
  missions: {
    min: ({ state, result }) => state.capacity <= 8 && result.delayed === 0 && result.onTime,
    dedup: ({ state, result }) => state.capacity <= 8 && result.delayed === 0 && result.onTime && (result.finishedAfter ?? Infinity) <= 5 + 1e-9,
    late: ({ result }) => result.delayed === 0 && !result.onTime,
  },
});
