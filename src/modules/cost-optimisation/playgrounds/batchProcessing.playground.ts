import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateBatchProcessing, type BatchProcessingResult, type BatchProcessingState } from '../simulators/batchProcessing';

const usd = (v: number) => (v >= 1 ? `$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `$${v.toFixed(3)}`);
const base: BatchProcessingState = { tickets: 100000, mode: 'realtime', deadlineHours: 24, retry: 'failed', cacheInstructions: false };

export const batchProcessingPlayground = definePlayground<BatchProcessingState, BatchProcessingResult>({
  techniqueId: 'batch',
  title: 'Nightly ticket tagging',
  controls: [
    { kind: 'note', text: 'Each ticket: 1,500 input tokens (1,000 of them shared instructions) and 200 output tokens. About 2% of requests fail and must be retried. Real-time limit: 2,000 requests a minute; batch limit: 100,000 per batch.' },
    { kind: 'steps', key: 'tickets', label: 'Tickets', values: Array.from({ length: 30 }, (_, i) => (i + 1) * 10000), format: formatCount },
    { kind: 'select', key: 'mode', label: 'API', options: [{ value: 'realtime', label: 'Real-time' }, { value: 'batch', label: 'Batch (50% off)' }] },
    { kind: 'select', key: 'deadlineHours', label: 'Results needed within', options: [{ value: '2', label: '2 hours' }, { value: '12', label: '12 hours' }, { value: '24', label: '24 hours' }] },
    { kind: 'select', key: 'retry', label: 'On failures', options: [{ value: 'failed', label: 'Retry failed IDs only' }, { value: 'all', label: 'Resubmit the whole job' }] },
    { kind: 'toggle', key: 'cacheInstructions', label: 'Cache the shared instructions (reads at 0.1×)' },
  ],
  presets: {
    start: { state: base, expected: { costUsd: 765, status: 'guaranteed' } },
    batch: { state: { ...base, mode: 'batch' }, expected: { costUsd: 382.5, relativeCost: 0.5, status: 'guaranteed' } },
    urgent: { state: { ...base, tickets: 200000, mode: 'batch', deadlineHours: 2 }, expected: { costUsd: 765, status: 'not guaranteed' } },
  },
  initialPreset: 'start',
  simulate: simulateBatchProcessing,
  outputs: [
    { kind: 'meter', label: 'Cost vs real-time baseline', value: (r) => Math.min(1, r.relativeCost), detail: (r) => `= ${usd(r.costUsd)} vs ${usd(r.baselineUsd)} for real-time, no caching`, emphasis: (r) => (r.relativeCost > 0.6 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per ticket', value: (r) => `$${r.perTicketUsd.toFixed(4)}` },
    { kind: 'value', label: 'Turnaround', value: (r) => (r.batches ? 'up to 24 h' : `${Math.round(r.minutes)} min`) },
    { kind: 'value', label: 'Deadline', value: (r) => r.status, emphasis: (r) => (r.status === 'guaranteed' ? 'normal' : 'warn') },
    { kind: 'value', label: 'Batches to submit', value: (r) => String(r.batches) },
  ],
  verdict: (r, s) => {
    const ok = r.status === 'guaranteed';
    if (!ok && r.status !== 'likely') return { tone: 'no', headline: 'The deadline is at risk.', detail: s.mode === 'batch' ? 'A batch only promises results within its 24-hour window.' : 'The rate limit cannot push this many requests through in time.' };
    if (ok && r.relativeCost <= 0.55) return { tone: 'ok', headline: 'Cheap and on time.', detail: 'Nobody waits on this job, so it runs at the batch price.' };
    return { tone: 'mid', headline: 'On time, but paying more than needed.', detail: r.status === 'likely' ? 'Most batches finish well within 12 hours, but it is not guaranteed.' : 'This job can wait, so a batch would halve the bill.' };
  },
  narrate: (r, s) => [
    `${formatCount(s.tickets)} tickets at $${r.perTicketUsd.toFixed(4)} each${s.cacheInstructions ? ' (cached instructions)' : ''}${s.mode === 'batch' ? ' after the batch discount' : ''}.`,
    s.retry === 'all' ? 'Resubmitting the whole job to fix 2% failures pays for every ticket twice.' : 'Only the 2% that failed are retried, by custom ID.',
    s.mode === 'realtime' ? `At 2,000 requests a minute the run takes about ${Math.round(r.minutes)} minutes, so a ${s.deadlineHours}-hour deadline is ${r.status === 'guaranteed' ? 'met' : 'missed'}.` : `A batch usually finishes early, but only 24 hours is promised, so a ${s.deadlineHours}-hour deadline is ${r.status}.`,
    `Total: ${usd(r.costUsd)}, ${formatWholePercent(r.relativeCost)} of the real-time price.`,
  ].join(' '),
  missions: {
    stack: ({ result }) => result.relativeCost <= 0.35,
    deadline: ({ state, result }) => state.deadlineHours === 2 && state.tickets >= 200000 && result.status === 'guaranteed',
    waste: ({ state, result }) => state.mode === 'batch' && result.relativeCost >= 0.95,
  },
});
