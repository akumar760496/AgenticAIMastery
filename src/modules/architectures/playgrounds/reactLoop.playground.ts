import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateReact, type ReactResult, type ReactState } from '../simulators/reactLoop';

const base: ReactState = { cap: 8, errorsAsObservations: false, verbosity: 'full', flakyTool: false };

export const reactLoopPlayground = definePlayground<ReactState, ReactResult>({
  techniqueId: 'react',
  title: 'Diagnose a failed SIM swap',
  intro: '“My SIM swap failed. Why?” The fix needs 4 tool calls and a final answer: 5 model calls. System prompt, tools and question: 1,200 tokens; each model turn writes 100 tokens.',
  controls: [
    { kind: 'steps', key: 'cap', label: 'Step cap (max model calls)', values: Array.from({ length: 11 }, (_, i) => i + 2), format: String },
    { kind: 'select', key: 'verbosity', label: 'Tool results', options: [{ value: 'full', label: 'Full payloads (1,500 tokens)' }, { value: 'compact', label: 'Compact fields (120 tokens)' }] },
    { kind: 'toggle', key: 'errorsAsObservations', label: 'Return tool errors to the model as observations' },
    { kind: 'toggle', key: 'flakyTool', label: 'Provisioning tool is flaky (times out once)' },
  ],
  presets: {
    start: { state: base, expected: { calls: 5, success: true, tokens: 22500 } },
    flaky: { state: { ...base, flakyTool: true }, expected: { success: false, crashed: true } },
    recover: { state: { ...base, flakyTool: true, errorsAsObservations: true }, expected: { calls: 6, success: true, tokens: 27420 } },
    tight: { state: { cap: 4, errorsAsObservations: true, verbosity: 'compact', flakyTool: false }, expected: { capped: true, tokens: 6520 } },
  },
  initialPreset: 'start',
  simulate: simulateReact,
  outputs: [
    { kind: 'check', label: 'Answered', value: (r) => r.success, detail: (r) => (r.success ? `in ${r.calls} model calls` : r.crashed ? 'a tool error was raised and ended the run' : `stopped at the cap after ${r.calls} calls`) },
    { kind: 'value', label: 'Model calls · needed', value: (r) => `${r.calls} · ${r.needed}` },
    { kind: 'value', label: 'Total tokens', value: (r) => formatCount(r.tokens), detail: () => 'every call resends the whole history' },
    { kind: 'value', label: 'Latency', value: (r) => `${r.latencyS.toFixed(1)} s` },
    { kind: 'itemList', title: 'Trace', items: (r) => r.trace.map((t, i) => ({ label: `${i + 1}`, text: t.action, detail: `${t.observation} · ${formatCount(t.tokens)} tokens sent`, status: t.kind, tone: t.kind === 'crash' ? 'no' : t.kind === 'error' ? 'mid' : 'ok', flagged: t.kind === 'crash' })) },
  ],
  verdict: (r, s) => {
    if (r.success) return r.tokens < 9000 ? { tone: 'ok', headline: 'Solved, and lean.', detail: 'Compact results keep every call small.' } : { tone: 'mid', headline: 'Solved, but heavy.', detail: 'Full payloads are resent on every later call.' };
    return r.crashed ? { tone: 'no', headline: 'Crashed on a tool error.', detail: 'Return the error as an observation so the model can retry.' } : { tone: 'no', headline: 'Ran out of steps.', detail: `The task needs ${r.needed} calls; the cap allows ${s.cap}.` };
  },
  narrate: (r, s) => [
    `The loop made ${r.calls} model calls and sent ${formatCount(r.tokens)} tokens in total; the last call alone sent ${formatCount(r.trace[r.trace.length - 1]?.tokens ?? 0)}, because each call resends everything before it.`,
    r.crashed ? 'The provisioning tool timed out and the exception ended the run, throwing away the progress so far.' : s.flakyTool ? 'The timeout came back as an observation, so the model simply called the tool again, at the cost of one extra step.' : '',
    r.capped ? `The cap of ${s.cap} stopped the run short of an answer, so the customer gets a hand-off instead.` : '',
    r.success && s.cap === r.needed ? 'The cap is exactly what the task needs: any lower and it fails.' : r.success && s.verbosity === 'full' ? 'Most of the tokens are full tool payloads being resent; compacting them is the biggest saving.' : '',
  ].filter(Boolean).join(' '),
  missions: {
    flaky: ({ state, result }) => state.flakyTool && result.success,
    lean: ({ result }) => result.success && result.tokens < 9000,
    cap: ({ state, result }) => result.success && state.cap === result.needed,
  },
});
