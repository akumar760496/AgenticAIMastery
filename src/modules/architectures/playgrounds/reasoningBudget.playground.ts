import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent, formatWholePercent } from '@/shared/format';
import { BUDGETS, simulateReasoning, type ReasoningResult, type ReasoningState } from '../simulators/reasoningBudget';

const p1 = (v: number) => formatPercent(v, 1);
const k = (v: number) => (v ? `${v / 1000}k` : 'off');

export const reasoningBudgetPlayground = definePlayground<ReasoningState, ReasoningResult>({
  techniqueId: 'reasoning',
  title: 'Set Gamma-R’s thinking budget (fictional NBFC assistant)',
  intro: 'Easy: routine top-ups. Hard: thin-file MSME loans. Illustrative prices: ₹0.50 input per file, ₹1 per 1,000 output tokens. The router misjudges 2% of hard files as easy; output runs at about 150 tokens a second.',
  controls: [
    { kind: 'steps', key: 'budget', label: 'Thinking budget', values: BUDGETS, format: k },
    { kind: 'select', key: 'mix', label: 'Traffic', options: [{ value: 'easy', label: 'Mostly easy (80 / 20)' }, { value: 'bal', label: 'Balanced (50 / 50)' }, { value: 'hard', label: 'Mostly hard (20 / 80)' }] },
    { kind: 'toggle', key: 'route', label: 'Route by difficulty: easy files get no thinking' },
  ],
  presets: {
    start: { state: { budget: 0, mix: 'easy', route: false }, expected: { easy: 0.96, hard: 0.41, tokensPerFile: 350, costPer1000: 850 } },
    flat: { state: { budget: 16000, mix: 'easy', route: false }, expected: { hard: 0.86, tokensPerFile: 6430, costPer1000: 6930 } },
    routed: { state: { budget: 16000, mix: 'easy', route: true }, expected: { easy: 0.96, hard: 0.851, tokensPerFile: 3172.4, costPer1000: 3672.4 } },
    max: { state: { budget: 32000, mix: 'easy', route: false }, expected: { hard: 0.866, costPer1000: 13010 } },
  },
  initialPreset: 'start',
  simulate: simulateReasoning,
  outputs: [
    { kind: 'meter', label: 'Hard files correct', value: (r) => r.hard, detail: (r) => `= ${p1(r.hard)}${r.gainPoints !== null ? ` · ${r.gainPoints >= 0 ? '+' : ''}${r.gainPoints.toFixed(1)} points vs the previous budget` : ''}`, emphasis: (r) => (r.hard < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Easy files correct', value: (r) => r.easy, detail: (r) => `= ${p1(r.easy)}` },
    { kind: 'value', label: 'Output tokens per file', value: (r) => formatCount(Math.round(r.tokensPerFile)), detail: (r) => `easy ${formatCount(Math.round(r.easyTokens))} · hard ${formatCount(Math.round(r.hardTokens))}` },
    { kind: 'value', label: 'Cost per 1,000 files', value: (r) => `₹${formatCount(Math.round(r.costPer1000))}`, detail: (r) => `same budget for every file: ₹${formatCount(Math.round(r.flatCostPer1000))}` },
    { kind: 'value', label: 'p95 latency', value: (r) => `${r.p95S.toFixed(0)} s` },
  ],
  verdict: (r, s) => (r.hard >= 0.85
    ? (s.route || s.mix === 'hard' ? { tone: 'ok', headline: 'Accurate where it matters, cheap elsewhere.', detail: 'The budget follows difficulty.' } : { tone: 'mid', headline: 'Accurate, but paying to think on easy files.', detail: 'Route easy files to no thinking.' })
    : { tone: 'no', headline: 'Hard files are still failing.', detail: 'Raise the budget for hard files.' }),
  narrate: (r, s) => [
    s.budget === 0 ? `With thinking off, easy files are already ${p1(r.easy)} correct but hard ones only ${p1(r.hard)}.` : `At a ${k(s.budget)} budget hard files reach ${p1(r.hard)}.`,
    s.budget && !s.route ? `Easy files also think, using ${formatCount(Math.round(r.easyTokens - 350))} thinking tokens each for almost no gain.` : '',
    s.route && s.budget ? `Routing sends easy files without thinking, so average output falls to ${formatCount(Math.round(r.tokensPerFile))} tokens and cost drops ${formatWholePercent(1 - r.costPer1000 / r.flatCostPer1000)}; 2% of hard files are misjudged as easy.` : '',
    s.budget === 32000 && r.gainPoints !== null ? `Doubling from 16k to 32k adds only ${r.gainPoints.toFixed(1)} points on hard files while their output nearly doubles.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    hard: ({ result }) => result.hard >= 0.85,
    routed: ({ state, result }) => state.route && result.hard >= 0.85 && result.costPer1000 <= 0.6 * result.flatCostPer1000,
    flat: ({ state, result }) => state.budget === 32000 && result.gainPoints !== null && result.gainPoints < 1,
  },
});
