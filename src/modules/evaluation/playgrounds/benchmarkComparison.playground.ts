import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatDollars, formatWholePercent } from '@/shared/format';
import { simulateBenchmark, type BenchmarkResult, type BenchmarkState } from '../simulators/benchmarkComparison';

const usCount = (n: number) => n.toLocaleString('en-US');
const state = (scoreSource: BenchmarkState['scoreSource'], rankBy: BenchmarkState['rankBy']): BenchmarkState => ({ scoreSource, rankBy, tasksPerMonth: 10_000 });

export const benchmarkPlayground = definePlayground<BenchmarkState, BenchmarkResult>({
  techniqueId: 'bench',
  title: 'Pick a coding model for your repositories',
  controls: [
    { kind: 'choice', key: 'scoreSource', label: 'Scores from', options: [{ value: 'public', label: 'Public scoreboard' }, { value: 'internal', label: 'Your internal eval' }] },
    { kind: 'choice', key: 'rankBy', label: 'Rank by', options: [{ value: 'resolveRate', label: 'Resolve rate' }, { value: 'costPerResolved', label: 'Cost per resolved task' }] },
    { kind: 'steps', key: 'tasksPerMonth', label: 'Tasks per month', values: Array.from({ length: 50 }, (_, i) => (i + 1) * 1000), format: usCount },
  ],
  presets: {
    board: { state: state('public', 'resolveRate'), expected: { topModel: 'Alpha' } },
    own: { state: state('internal', 'resolveRate'), expected: { topModel: 'Beta' } },
    budget: { state: state('internal', 'costPerResolved'), expected: { topModel: 'Gamma' } },
  },
  initialPreset: 'board',
  simulate: simulateBenchmark,
  outputs: [
    {
      kind: 'table',
      columns: ['Model', 'Resolve rate', 'Cost / task', 'Cost / resolved', 'Monthly cost', 'Resolved / month'],
      highlightFirstRow: true,
      rows: (r) => r.ranking.map((m, i) => [
        `${i === 0 ? '★ ' : ''}${m.name}`, formatWholePercent(m.resolveRate), formatDollars(m.costPerTask),
        `${formatDollars(m.costPerResolved)} (= ${m.costPerTask.toFixed(2)} ÷ ${m.resolveRate.toFixed(2)})`,
        formatDollars(m.monthlyCost, 0), usCount(m.resolvedPerMonth),
      ]),
    },
  ],
  verdict: (r, s) => ({
    tone: s.scoreSource === 'internal' ? 'ok' : 'mid',
    headline: `${r.topModel} ranks first.`,
    detail: s.scoreSource === 'public' ? 'Scoreboard scores come from public repositories that may not resemble your code.' : 'Internal scores reflect your own issues.',
  }),
  narrate: (r, s) => {
    const top = r.ranking[0];
    if (!top) return '';
    const parts = [
      `Using ${s.scoreSource === 'public' ? 'public scoreboard' : 'your internal eval'} scores and ranking by ${s.rankBy === 'resolveRate' ? 'resolve rate' : 'cost per resolved task'}, ${top.name} comes first.`,
      `At ${usCount(s.tasksPerMonth)} tasks a month, ${top.name} costs ${formatDollars(top.monthlyCost, 0)} and resolves about ${usCount(top.resolvedPerMonth)} tasks, at ${formatDollars(top.costPerResolved)} per success.`,
      s.scoreSource === 'public' ? 'Scoreboard scores come from public repositories, which may not resemble your code.' : 'Internal scores reflect your own issues, which is why the ranking can differ from the scoreboard.',
    ];
    if (s.rankBy === 'costPerResolved') parts.push('Cheap models can win on cost per success even with a lower resolve rate.');
    return parts.join(' ');
  },
  missions: {
    gamma: ({ result }) => result.topModel === 'Gamma',
    flip: ({ state: s, result }) => s.scoreSource === 'internal' && s.rankBy === 'resolveRate' && result.topModel === 'Beta',
    beta5k: ({ result }) => result.topModel === 'Beta' && result.betaMonthlyCost > 5000,
  },
});
