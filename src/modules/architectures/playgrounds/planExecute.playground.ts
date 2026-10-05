import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulatePlanExecute, type Architecture, type PlanExecuteResult, type PlanExecuteState } from '../simulators/planExecute';

const ARCH: Readonly<Record<Architecture, string>> = { react: 'ReAct', pe: 'Plan-and-execute', rewoo: 'ReWOO' };
const st = (architecture: Architecture, stepFails = false, replan = true): PlanExecuteState => ({ architecture, planner: 'large', executor: 'small', stepFails, replan });

export const planExecutePlayground = definePlayground<PlanExecuteState, PlanExecuteResult>({
  techniqueId: 'planexec',
  title: 'Rebook a passenger after a cancellation',
  intro: '5 steps: fetch PNR, find flights, hold seat, reissue ticket, notify. Large-model call about 2.5 s, small 0.8 s, tool 0.5 s.',
  controls: [
    { kind: 'choice', key: 'architecture', label: 'Architecture', options: (Object.keys(ARCH) as Architecture[]).map((k) => ({ value: k, label: ARCH[k] })) },
    { kind: 'select', key: 'planner', label: 'Planner (or ReAct model)', options: [{ value: 'large', label: 'Large model' }, { value: 'small', label: 'Small model' }] },
    { kind: 'select', key: 'executor', label: 'Executor (plan-and-execute only)', options: [{ value: 'small', label: 'Small model' }, { value: 'large', label: 'Large model' }] },
    { kind: 'toggle', key: 'stepFails', label: 'Step 3 fails: the held seat is lost' },
    { kind: 'toggle', key: 'replan', label: 'Replan on failure', isEnabled: (s) => s.architecture !== 'react' },
  ],
  presets: {
    start: { state: st('react'), expected: { largeCalls: 6, tokens: 17400, latencyS: 17.5, ok: true } },
    pe: { state: st('pe'), expected: { largeCalls: 2, smallCalls: 5, tokens: 10500, latencyS: 12, ok: true } },
    rewoo: { state: st('rewoo'), expected: { largeCalls: 2, tokens: 5000, latencyS: 8, ok: true } },
    fail: { state: st('rewoo', true, false), expected: { ok: false } },
  },
  initialPreset: 'start',
  simulate: simulatePlanExecute,
  outputs: [
    { kind: 'check', label: 'Rebooked', value: (r) => r.ok, detail: (r) => r.failure },
    { kind: 'value', label: 'Large-model calls', value: (r) => String(r.largeCalls), detail: (r) => `plus ${r.smallCalls} small-model calls` },
    { kind: 'meter', label: 'Tokens vs ReAct', value: (r) => Math.min(1, r.ratio), detail: (r) => `= ${formatCount(r.tokens)} vs ${formatCount(r.reactTokens)} for ReAct`, emphasis: (r) => (r.ratio > 0.4 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Latency', value: (r) => `${r.latencyS.toFixed(1)} s` },
    { kind: 'badges', items: (r) => r.calls.map((c) => ({ text: c, emphasis: c === 'large' ? 'warn' : 'normal' })) },
  ],
  verdict: (r) => (r.ok
    ? (r.largeCalls <= 2 ? { tone: 'ok', headline: 'Planned once, executed cheaply.', detail: 'The large model only plans and answers.' } : { tone: 'mid', headline: 'Works, but pays for many large calls.', detail: 'Try planning up front with cheap execution.' })
    : { tone: 'no', headline: 'The rebooking failed.', detail: r.failure }),
  narrate: (r, s) => [
    s.architecture === 'react' ? `ReAct calls the ${s.planner} model ${r.calls.length} times, deciding each step after reading the last result and resending the growing history: ${formatCount(r.tokens)} tokens.`
      : `The ${s.planner} planner writes all five steps once. ${s.architecture === 'pe' ? `A ${s.executor} executor model runs each step` : 'Tools run straight from the plan, with placeholders filled from earlier results and no model call in between'}, and one final call writes the answer.`,
    s.stepFails ? (s.architecture === 'react' ? 'When the seat hold fails, ReAct reads the error and tries another flight: two extra calls.' : s.replan ? 'When the seat hold fails, the planner is called once more with the evidence so far and writes a new route from step 3.' : 'When the seat hold fails nobody replans, so the run stops.') : '',
    r.ok && s.architecture !== 'react' ? `That is ${r.largeCalls} large-model calls and ${formatWholePercent(r.ratio)} of ReAct’s tokens.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    two: ({ result }) => result.ok && result.largeCalls <= 2,
    survive: ({ state, result }) => state.stepFails && result.ok && state.architecture !== 'react',
    lean: ({ result }) => result.ok && result.ratio < 0.4,
  },
});
