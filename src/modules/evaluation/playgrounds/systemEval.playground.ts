import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatDollars, formatMoney, formatWholePercent, joinWithAnd, pluralise } from '@/shared/format';
import { runsNeededForGate, simulateSystemEval, type SystemEvalResult, type SystemEvalState } from '../simulators/systemEval';

const grid = (rows: string): boolean[][] => rows.split(' ').map((row) => [...row].map((cell) => cell === '1'));
const preset = (rows: string, expected: Partial<SystemEvalResult>) => ({ state: { runs: grid(rows), costPerRun: 0.05 }, expected });
const COST_STEPS = Array.from({ length: 20 }, (_, i) => Math.round((i + 1)) / 100);

export const systemEvalPlayground = definePlayground<SystemEvalState, SystemEvalResult>({
  techniqueId: 'system',
  title: 'Your 15 runs',
  controls: [
    { kind: 'booleanGrid', key: 'runs', label: 'Click a cell to flip pass or fail', rowLabel: (r) => `Task ${r + 1}`, columnLabel: (c) => `Run ${c + 1}` },
    { kind: 'steps', key: 'costPerRun', label: 'Cost per run', values: COST_STEPS, format: (v) => formatDollars(v) },
  ],
  presets: {
    start: preset('111 101 111 001 110', { passingRuns: 11, gatePasses: false }),
    reliable: preset('111 111 111 110 111', { passingRuns: 14, gatePasses: true, passHatK: 0.8 }),
    flaky: preset('011 101 110 011 101', { passAtK: 1, passHatK: 0 }),
    broken: preset('111 111 111 000 111', { successRate: 0.8, passAtK: 0.8, passHatK: 0.8 }),
  },
  initialPreset: 'start',
  simulate: simulateSystemEval,
  outputs: [
    { kind: 'meter', label: 'Success rate', value: (r) => r.successRate, detail: (r) => `= ${r.passingRuns} passing runs ÷ ${r.totalRuns}` },
    { kind: 'meter', label: 'pass@3', value: (r) => r.passAtK, detail: (r) => `= ${Math.round(r.passAtK * 5)} tasks passed at least once ÷ 5` },
    { kind: 'meter', label: 'pass^3', value: (r) => r.passHatK, detail: (r) => `= ${Math.round(r.passHatK * 5)} tasks passed every run ÷ 5`, emphasis: () => 'warn' },
    { kind: 'value', label: 'Cost per success', value: (r) => (r.passingRuns ? formatMoney(r.costPerSuccess) : 'no successes'), detail: (r) => `= ${formatDollars(r.totalSpend)} spent on ${r.totalRuns} runs ÷ ${r.passingRuns} successes` },
  ],
  verdict: (r) => {
    const needed = runsNeededForGate(r);
    return r.gatePasses
      ? { tone: 'ok', headline: 'Release gate passes.', detail: `Success ${formatWholePercent(r.successRate)} is at or above the 90% threshold.` }
      : { tone: 'no', headline: 'Release gate blocks.', detail: `Success ${formatWholePercent(r.successRate)} is below the 90% threshold; ${needed} more passing ${pluralise(needed, 'run')} needed.` };
  },
  narrate: (r) => {
    const parts = [
      `${r.passingRuns} of ${r.totalRuns} runs reached the correct end state, so the success rate is ${formatWholePercent(r.successRate)}.`,
      `${Math.round(r.passAtK * 5)} of 5 tasks worked at least once, but only ${Math.round(r.passHatK * 5)} worked every time.`,
    ];
    if (r.flakyTasks.length) parts.push(`${pluralise(r.flakyTasks.length, 'Task')} ${joinWithAnd(r.flakyTasks.map(String))} ${r.flakyTasks.length > 1 ? 'are' : 'is'} flaky: sometimes right, sometimes wrong.`);
    if (r.brokenTasks.length) parts.push(`${pluralise(r.brokenTasks.length, 'Task')} ${joinWithAnd(r.brokenTasks.map(String))} never succeeded, which is a capability gap rather than flakiness.`);
    parts.push(r.passingRuns ? `You spent ${formatDollars(r.totalSpend)} in total, so each success effectively cost ${formatMoney(r.costPerSuccess)}.` : 'Nothing passed, so every dollar was wasted.');
    parts.push(r.gatePasses ? 'The release can ship.' : 'The release is blocked until quality improves.');
    return parts.join(' ');
  },
  missions: {
    gate: ({ result }) => result.successRate >= 0.9,
    flaky: ({ result }) => result.passAtK === 1 && result.passHatK === 0,
    cost: ({ state, result }) => Math.abs(state.costPerRun - 0.05) < 1e-9 && result.costPerSuccess > 0.1,
  },
});
