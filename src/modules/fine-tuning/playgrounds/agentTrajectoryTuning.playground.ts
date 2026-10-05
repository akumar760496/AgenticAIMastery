import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatRupees, formatWholePercent } from '@/shared/format';
import { simulateAgentTuning, type AgentTuningResult, type AgentTuningState } from '../simulators/agentTrajectoryTuning';

const isBest = (r: AgentTuningResult) => r.success >= 0.72 && r.invented <= 0.03 && r.cost <= 50000;

export const agentTrajectoryTuningPlayground = definePlayground<AgentTuningState, AgentTuningResult>({
  techniqueId: 'ftagent',
  title: 'Tune Yatra Setu’s booking agent',
  intro: 'Yatra Setu is a fictional travel company. The base 8B model completes 48% of held-out booking tasks; the large teacher 78%. Each trajectory costs about ₹15 to generate and ₹6 to train on.',
  controls: [
    { kind: 'select', key: 'data', label: 'Training trajectories', options: [{ value: 'raw', label: 'All logged runs, including failures' }, { value: 'filtered', label: 'Only runs verified successful in the sandbox' }] },
    { kind: 'toggle', key: 'mask', label: 'Loss on assistant turns only (mask tool outputs)' },
    { kind: 'steps', key: 'trajectories', label: 'Trajectories', values: [500, 2000, 8000], format: (v) => v.toLocaleString('en-IN') },
  ],
  presets: {
    start: { state: { data: 'raw', mask: false, trajectories: 2000 }, expected: { success: 0.55, invented: 0.12, cost: 42000 } },
    filtered: { state: { data: 'filtered', mask: false, trajectories: 2000 }, expected: { success: 0.68, invented: 0.09 } },
    masked: { state: { data: 'filtered', mask: true, trajectories: 2000 }, expected: { success: 0.73, invented: 0.02, gapToTeacher: 0.05 } },
    big: { state: { data: 'filtered', mask: true, trajectories: 8000 }, expected: { success: 0.76, cost: 168000 } },
  },
  initialPreset: 'start',
  simulate: simulateAgentTuning,
  outputs: [
    { kind: 'meter', label: 'Task success (held-out)', value: (r) => r.success, emphasis: (r) => (r.success < 0.6 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Invented tool results', value: (r) => r.invented, emphasis: (r) => (r.invented > 0.05 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Gap to teacher', value: (r) => `${Math.round(r.gapToTeacher * 100)} points` },
    { kind: 'value', label: 'Data and training cost', value: (r) => formatRupees(r.cost), emphasis: (r) => (r.cost > 50000 ? 'warn' : 'normal') },
  ],
  verdict: (r) => (isBest(r)
    ? { tone: 'ok', headline: 'Close to the teacher, far cheaper.', detail: 'Verified successes with masked tool outputs.' }
    : r.success < 0.6 ? { tone: 'no', headline: 'It learned the failures too.', detail: 'Keep only verified successful runs.' }
      : r.invented > 0.05 ? { tone: 'mid', headline: 'It writes tool results itself.', detail: 'Mask tool outputs so only assistant turns carry loss.' }
        : { tone: 'mid', headline: 'Good, but check the cost.', detail: 'More data helps a little and costs a lot.' }),
  narrate: (r, s) => [
    s.data === 'raw' ? 'Unfiltered logs include failed and looping runs, which the model copies.' : 'Only runs verified in the sandbox are kept.',
    s.mask ? 'Tool outputs are masked, so the model learns to call tools rather than invent results.' : 'Tool outputs carry loss, so the model also learns to write them.',
    `Task success ${formatWholePercent(r.success)}, invented results ${formatWholePercent(r.invented)}.`,
  ].join(' '),
  missions: {
    best: ({ result }) => isBest(result),
    mask: ({ state, result }) => state.data === 'filtered' && result.invented >= 0.08,
    scale: ({ result }) => result.success >= 0.75,
  },
});
