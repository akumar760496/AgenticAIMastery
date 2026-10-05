import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateSupervisor, type SupervisorResult, type SupervisorState } from '../simulators/supervisorPattern';

export const supervisorPatternPlayground = definePlayground<SupervisorState, SupervisorResult>({
  techniqueId: 'supervisor',
  title: 'Weekly literature screen',
  intro: '8 drug classes, about 240k tokens of papers in all. A quarter of the papers are only reachable by web fetch. A worker’s window holds 100k tokens and reads about 10k tokens a minute.',
  controls: [
    { kind: 'steps', key: 'workers', label: 'Workers', values: [1, 2, 3, 4, 5, 6, 7, 8], format: String },
    { kind: 'select', key: 'brief', label: 'Brief each worker gets', options: [{ value: 'title', label: 'A title: “Check drug-class safety papers”' }, { value: 'obj', label: 'Objective and output format' }, { value: 'full', label: 'Objective, format, sources and boundaries' }] },
    { kind: 'select', key: 'tools', label: 'Worker tools', options: [{ value: 'ro', label: 'Read local files only' }, { value: 'web', label: 'Read files + web fetch (no writes)' }, { value: 'rw', label: 'All tools, including write and shell' }] },
    { kind: 'select', key: 'returns', label: 'What each worker returns', options: [{ value: 'sum', label: 'A 1k-token structured summary' }, { value: 'full', label: 'Its full transcript' }] },
  ],
  presets: {
    start: { state: { workers: 4, brief: 'title', tools: 'rw', returns: 'full' }, expected: { orchestratorK: 326, duplication: 0.35, coverage: 0.75, wallMin: 12.1, writers: 4 } },
    objfull: { state: { workers: 6, brief: 'obj', tools: 'rw', returns: 'full' }, expected: { duplication: 0.15, coverage: 0.9, orchestratorK: 278, wallMin: 8.6 } },
    local: { state: { workers: 3, brief: 'title', tools: 'ro', returns: 'sum' }, expected: { orchestratorK: 5, coverage: 0.5625 } },
    one: { state: { workers: 1, brief: 'full', tools: 'web', returns: 'sum' }, expected: { orchestratorK: 3, wallMin: 11 } },
  },
  initialPreset: 'start',
  simulate: simulateSupervisor,
  outputs: [
    { kind: 'value', label: 'Orchestrator context', value: (r) => `${formatCount(Math.round(r.orchestratorK))}k tokens`, emphasis: (r) => (r.orchestratorK > 100 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Duplicated work', value: (r) => r.duplication, emphasis: (r) => (r.duplication >= 0.1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Coverage of the papers', value: (r) => r.coverage, emphasis: (r) => (r.coverage < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Wall time', value: (r) => `${r.wallMin.toFixed(1)} min` },
    { kind: 'value', label: 'Workers that can write or run commands', value: (r) => String(r.writers), emphasis: (r) => (r.writers ? 'warn' : 'normal') },
    { kind: 'value', label: 'Tokens for the whole screen', value: (r) => `${formatCount(Math.round(r.totalK))}k` },
  ],
  verdict: (r, s) => {
    const tone = r.orchestratorK < 20 && r.duplication < 0.1 && r.coverage >= 0.999 && s.tools !== 'rw' ? 'ok' : r.orchestratorK > 100 || r.coverage < 0.8 ? 'no' : 'mid';
    const headline = r.orchestratorK > 128 ? 'The orchestrator’s context overflows.' : r.coverage < 0.999 ? `${formatWholePercent(1 - r.coverage)} of the papers are missed.` : r.duplication >= 0.1 ? 'Workers overlap.' : 'Clean fan-out.';
    const detail = s.returns === 'full' ? 'Transcripts bury the orchestrator in raw reading.' : s.brief !== 'full' ? 'A fuller brief would stop workers overlapping.' : s.tools === 'rw' ? 'Readers do not need write access.' : 'Brief, scope and summaries are all in order.';
    return { tone, headline, detail };
  },
  narrate: (r, s) => [
    `${s.workers} workers each read about ${formatCount(Math.round(r.readPerWorkerK))}k tokens.`,
    s.returns === 'sum' ? `Each returns a 1k summary, so the orchestrator holds only ${formatCount(Math.round(r.orchestratorK))}k.` : `Each returns its whole transcript, so the orchestrator must hold ${formatCount(Math.round(r.orchestratorK))}k tokens of raw reading.`,
    s.brief === 'title' ? 'With only a title, workers guess their scope, overlap and skip papers.' : s.brief === 'obj' ? 'Without sources and boundaries some work still overlaps.' : 'A complete brief keeps each worker on its own slice.',
    r.windowCoverage < 1 ? 'Too few workers: each would need more than its 100k window.' : '',
    s.tools === 'ro' ? 'Local-only tools cannot reach the papers that need a web fetch.' : s.tools === 'rw' ? 'Every worker can also write and run commands, which screening never needs.' : 'Read and fetch are enough: nothing is written.',
    `Coverage ${formatWholePercent(r.coverage)}, duplicated work ${formatWholePercent(r.duplication)}.`,
  ].filter(Boolean).join(' '),
  missions: {
    lean: ({ state, result }) => state.workers >= 6 && result.orchestratorK < 20,
    nodup: ({ state, result }) => state.workers >= 2 && result.duplication < 0.1,
    safe: ({ state, result }) => result.coverage >= 0.999 && state.tools !== 'rw',
  },
});
