import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { GENERIC_COST_PER_1000, simulateWorkflow, type WorkflowResult, type WorkflowState } from '../simulators/workflowPatterns';

const p1 = (v: number) => formatPercent(v, 1);
const base: WorkflowState = { mix: 'pred', router: false, gate: false, sectioning: false, voting: false, threshold: 0.7 };

export const workflowPatternsPlayground = definePlayground<WorkflowState, WorkflowResult>({
  techniqueId: 'workflows',
  title: 'Build the claims pipeline',
  intro: '1,000 claim emails. Large-model call ₹0.60, small-model call ₹0.05. 8% of claims arrive incomplete.',
  controls: [
    { kind: 'select', key: 'mix', label: 'Task mix', options: [{ value: 'pred', label: 'Predictable (3% fit no path)' }, { value: 'open', label: 'Open-ended (35% fit no path)' }] },
    { kind: 'toggle', key: 'router', label: 'Router with specialised small-model paths' },
    { kind: 'toggle', key: 'gate', label: 'Completeness gate between steps' },
    { kind: 'toggle', key: 'sectioning', label: 'Sectioning: fraud screen in parallel with the summary' },
    { kind: 'toggle', key: 'voting', label: 'Voting: three fraud checks, flag on two' },
    { kind: 'steps', key: 'threshold', label: 'Router confidence threshold (below it, the general large-model path)', values: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9], format: (v) => v.toFixed(2) },
  ],
  presets: {
    start: { state: base, expected: { accuracy: 0.718, costPer1000: 650, p95S: 7.5 } },
    routed: { state: { ...base, router: true, gate: true }, expected: { accuracy: 0.903, costPer1000: 237.0625, p95S: 8.3 } },
    fast: { state: { ...base, router: true, gate: true, sectioning: true }, expected: { accuracy: 0.903, p95S: 5.3 } },
    open: { state: { ...base, mix: 'open', router: true, gate: true, sectioning: true }, expected: { accuracy: 0.721, unhandled: 0.1925 } },
  },
  initialPreset: 'start',
  simulate: simulateWorkflow,
  outputs: [
    { kind: 'meter', label: 'Accuracy', value: (r) => r.accuracy, detail: (r) => `= ${p1(r.accuracy)} of claims handled correctly`, emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Cost vs one generic prompt', value: (r) => Math.min(1, r.costPer1000 / GENERIC_COST_PER_1000), detail: (r) => `= ₹${formatCount(Math.round(r.costPer1000))} per 1,000 claims (generic prompt ₹650)` },
    { kind: 'meter', label: 'Unhandled tasks', value: (r) => r.unhandled, detail: (r) => `= ${Math.round(r.unhandled * 1000)} of 1,000 fit no path`, emphasis: (r) => (r.unhandled > 0.2 ? 'warn' : 'normal') },
    { kind: 'value', label: 'p95 latency', value: (r) => `${r.p95S.toFixed(1)} s` },
    { kind: 'value', label: 'Model calls per claim', value: (r) => r.callsPerClaim.toFixed(2) },
    { kind: 'value', label: 'To general path · misrouted', value: (r) => `${p1(r.toGeneral)} · ${p1(r.misrouted)}` },
  ],
  verdict: (r, s) => {
    if (r.accuracy >= 0.9 && r.costPer1000 < 400) return { tone: 'ok', headline: 'A workflow is enough here.', detail: 'Most claims take a cheap, specialised path and the gate catches incomplete ones.' };
    if (r.unhandled > 0.2) return { tone: 'no', headline: 'Too much falls outside the paths.', detail: 'More than a fifth of tasks fit no designed path: the signal an agent may be warranted.' };
    if (r.accuracy < 0.8) return { tone: 'no', headline: 'Too many wrong answers.', detail: s.router ? 'Check the gate and the threshold.' : 'One generic prompt pays large-model prices for every claim.' };
    return { tone: 'mid', headline: 'Works, with room to improve.', detail: s.router ? 'Check the gate and the threshold.' : 'One generic prompt pays large-model prices for every claim.' };
  },
  narrate: (r, s) => [
    s.router ? `The router sends ${p1(1 - r.toGeneral)} of claims down cheap specialised paths and ${p1(r.toGeneral)} to the general large-model path; ${p1(r.misrouted)} are misrouted.` : `Every claim goes through one generic prompt on the large model, and accuracy is ${p1(r.accuracy)}.`,
    s.gate ? 'The gate returns the 8% of incomplete claims for documents instead of guessing.' : 'Incomplete claims get a confident but wrong summary, which costs 8 points of accuracy.',
    `The fraud screen ${s.sectioning ? 'runs alongside' : 'waits for'} the summary, so p95 latency is ${r.p95S.toFixed(1)} s.`,
    s.mix === 'open' && s.router ? `On open-ended work ${p1(r.unhandled)} of tasks fit no path${r.unhandled > 0.2 ? ': a fixed workflow is the wrong tool for them.' : '.'}` : '',
  ].filter(Boolean).join(' '),
  missions: {
    cheap: ({ result }) => result.costPer1000 < 400 && result.accuracy >= 0.9,
    fast: ({ state, result }) => state.sectioning && result.p95S < 6 && result.accuracy >= 0.9,
    agent: ({ state, result }) => state.mix === 'open' && state.router && result.unhandled > 0.2,
  },
});
