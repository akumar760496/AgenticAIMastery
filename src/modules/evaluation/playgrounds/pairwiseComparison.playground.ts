import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatRupees, formatWholePercent } from '@/shared/format';
import { simulatePairwise, type PairwiseResult, type PairwiseState } from '../simulators/pairwiseComparison';

export const pairwisePlayground = definePlayground<PairwiseState, PairwiseResult>({
  techniqueId: 'pairwise',
  title: 'Decide on Kaveri Bank’s new prompt',
  intro: 'The new prompt is truly better: it wins 56% of the time. The LLM judge favours whichever answer it sees first by about 10 points, and each judge call costs ₹0.60.',
  controls: [
    { kind: 'steps', key: 'questions', label: 'Questions compared', values: [50, 200, 800], format: String },
    { kind: 'toggle', key: 'judgeBothOrders', label: 'Judge each pair in both orders' },
    { kind: 'select', key: 'shipRule', label: 'Ship rule', options: [{ value: 'naive', label: 'Ship if the win rate is above 50%' }, { value: 'interval', label: 'Ship if the whole 95% interval is above 50%' }] },
  ],
  presets: {
    start: { state: { questions: 50, judgeBothOrders: true, shipRule: 'naive' }, expected: { shipsB: true, judgeCostRupees: 60 } },
    noswap: { state: { questions: 200, judgeBothOrders: false, shipRule: 'naive' }, expected: { measuredWinRate: 0.46, shipsB: false } },
    ci200: { state: { questions: 200, judgeBothOrders: true, shipRule: 'interval' }, expected: { shipsB: false, judgeCostRupees: 240 } },
    n800: { state: { questions: 800, judgeBothOrders: true, shipRule: 'interval' }, expected: { shipsB: true, judgeCostRupees: 960 } },
  },
  initialPreset: 'start',
  simulate: simulatePairwise,
  outputs: [
    { kind: 'meter', label: 'Measured win rate of B', value: (r) => r.measuredWinRate, emphasis: (r) => (r.measuredWinRate < 0.5 ? 'warn' : 'normal') },
    { kind: 'value', label: '95% interval', value: (r) => `${formatWholePercent(r.lower)} to ${formatWholePercent(r.upper)}` },
    { kind: 'value', label: 'Decision', value: (r) => (r.shipsB ? 'ship B' : 'keep A'), emphasis: (r) => (r.shipsB ? 'normal' : 'warn') },
    { kind: 'value', label: 'Judge cost', value: (r) => formatRupees(r.judgeCostRupees) },
  ],
  verdict: (r, s) => {
    if (s.shipRule === 'interval' && r.shipsB && s.judgeBothOrders) return { tone: 'ok', headline: 'Right call, on solid evidence.', detail: 'The whole interval is above 50%.' };
    if (!r.shipsB && !s.judgeBothOrders) return { tone: 'no', headline: 'Position bias hid a real gain.', detail: 'B always sat in the second slot.' };
    if (!r.shipsB) return { tone: 'no', headline: 'Not proven yet.', detail: 'The interval still includes 50%; use more questions.' };
    return { tone: 'mid', headline: 'Right call, but by luck.', detail: 'The interval includes 50%, so this rule would ship a worse version just as often.' };
  },
  narrate: (r, s) =>
    `${s.judgeBothOrders ? 'Each pair is judged in both orders, so the first-slot bias cancels' : 'B is always shown second, so the judge’s first-slot bias counts against it'}. ` +
    `Win rate ${formatWholePercent(r.measuredWinRate)} on ${s.questions} questions, interval ${formatWholePercent(r.lower)} to ${formatWholePercent(r.upper)}: ${r.shipsB ? 'ship B' : 'keep A'}.`,
  missions: {
    best: ({ state, result }) => state.shipRule === 'interval' && state.judgeBothOrders && result.shipsB && result.judgeCostRupees <= 1000,
    bias: ({ state, result }) => !state.judgeBothOrders && result.measuredWinRate < 0.5,
    narrow: ({ result }) => result.halfWidth <= 0.04,
  },
});
