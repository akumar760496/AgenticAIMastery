import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { STEP_NAMES, simulateExecutionGraph, type ExecutionGraphResult, type ExecutionGraphState } from '../simulators/executionGraph';

const base: ExecutionGraphState = { parallel: false, dependency: 'none', bS: 3, cS: 2, dS: 4, dFailsOnce: false, checkpoints: true };
const SECONDS = [1, 2, 3, 4, 5, 6];

export const executionGraphPlayground = definePlayground<ExecutionGraphState, ExecutionGraphResult>({
  techniqueId: 'graphs',
  title: 'Loan underwriting: A → (B, C, D) → E',
  intro: `A and E take 1 s each. ${Object.entries(STEP_NAMES).map(([k, v]) => `${k}: ${v}`).join(' · ')}.`,
  controls: [
    { kind: 'toggle', key: 'parallel', label: 'Run independent steps in parallel (execution graph)' },
    { kind: 'steps', key: 'bS', label: 'B duration', values: SECONDS, format: (v) => `${v} s` },
    { kind: 'steps', key: 'cS', label: 'C duration', values: SECONDS, format: (v) => `${v} s` },
    { kind: 'steps', key: 'dS', label: 'D duration', values: SECONDS, format: (v) => `${v} s` },
    { kind: 'select', key: 'dependency', label: 'Does C need B’s credit score?', options: [{ value: 'none', label: 'No, C is independent' }, { value: 'declared', label: 'Yes, and the graph declares it' }, { value: 'hidden', label: 'Yes, but nobody declared it' }] },
    { kind: 'toggle', key: 'dFailsOnce', label: 'D fails on its first attempt and is retried' },
    { kind: 'toggle', key: 'checkpoints', label: 'Checkpoint finished steps' },
  ],
  presets: {
    start: { state: base, expected: { totalS: 11, correct: true } },
    graph: { state: { ...base, parallel: true }, expected: { totalS: 6, criticalPath: 'A → D → E' } },
    hidden: { state: { ...base, parallel: true, dependency: 'hidden' }, expected: { totalS: 6, correct: false } },
    retry: { state: { ...base, parallel: true, dFailsOnce: true, checkpoints: false }, expected: { totalS: 11 } },
  },
  initialPreset: 'start',
  simulate: simulateExecutionGraph,
  outputs: [
    { kind: 'value', label: 'Total time', value: (r) => `${r.totalS} s`, detail: (r) => `sequential with no failures: ${r.sequentialCleanS} s → speed-up ${r.speedUp.toFixed(2)}×` },
    { kind: 'value', label: 'Critical path', value: (r) => r.criticalPath },
    { kind: 'check', label: 'Result correct', value: (r) => r.correct, detail: (r) => (r.correct ? 'No step reads another’s output early.' : 'C ran before B finished and read an empty credit score.') },
  ],
  verdict: (r, s) => {
    if (!r.correct) return { tone: 'no', headline: 'Fast but wrong: a race condition.', detail: 'Declare the dependency; the graph then orders B before C.' };
    if (r.totalS < r.sequentialCleanS) return { tone: 'ok', headline: `${r.sequentialCleanS - r.totalS} s saved.`, detail: 'Total time equals the critical path.' };
    return { tone: 'mid', headline: 'No time saved.', detail: s.dFailsOnce && !s.checkpoints ? 'Without checkpoints the failure reruns finished steps.' : 'Enable parallel execution.' };
  },
  narrate: (r, s) => [
    s.parallel ? `B, C and D start as soon as A finishes${s.dependency === 'declared' ? ', except C, which waits for B as declared' : ''}.` : 'Each step waits for the one before it, even though B, C and D do not depend on each other.',
    s.parallel && s.dependency === 'hidden' ? 'C actually needs B’s credit score, but the graph does not say so, so C runs early on missing data.' : '',
    s.dFailsOnce ? (s.checkpoints ? 'D fails once; its retry reruns only D because finished steps are checkpointed.' : 'D fails once and, with no checkpoints, the whole workflow restarts from A.') : '',
    `Total time is ${r.totalS} s against ${r.sequentialCleanS} s for a clean sequential run; the critical path is ${r.criticalPath}.`,
  ].filter(Boolean).join(' '),
  missions: {
    six: ({ result }) => result.totalS <= 6 && result.correct,
    bc: ({ state, result }) => state.parallel && state.dependency === 'declared' && state.bS + state.cS > state.dS && result.correct && !state.dFailsOnce,
    retry: ({ state, result }) => state.dFailsOnce && state.checkpoints && state.parallel && result.correct && result.totalS < 9,
  },
});
