import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatPercent, formatRupees } from '@/shared/format';
import { RECON_ACCURACY, simulateReasoningPrompt, type ReasoningPromptResult, type ReasoningPromptState } from '../simulators/reasoningPrompt';

const rupees = (v: number) => formatRupees(v, v < 10 ? 2 : 0);
const isFit = (r: ReasoningPromptResult) => r.accuracy >= 0.96 && r.dailyCost <= 30000 && r.lookup.p95 <= 3;

export const reasoningPromptPlayground = definePlayground<ReasoningPromptState, ReasoningPromptResult>({
  techniqueId: 'reasonprompt',
  title: 'Prompt RupeeRail’s reasoning model',
  intro: 'RupeeRail, a fictional payment aggregator, runs 10,000 tasks a day: 7,000 lookups (“has this UTR settled?”) and 3,000 reconciliations of a UPI settlement file. The reasoning model costs ₹170 per million input tokens and ₹850 per million output tokens, thinking included.',
  controls: [
    { kind: 'select', key: 'effort', label: 'Reconciliation effort', options: [{ value: 'low', label: 'Low (about 1,200 thinking tokens)' }, { value: 'medium', label: 'Medium (about 4,000)' }, { value: 'high', label: 'High (about 9,000)' }] },
    { kind: 'select', key: 'style', label: 'Prompt style', options: [{ value: 'scaffold', label: 'Scaffold: “think step by step”, numbered steps, 5 worked examples, show your working' }, { value: 'goals', label: 'Goals, constraints and a self-check; answer only' }] },
    { kind: 'select', key: 'lookups', label: 'Lookups go to', options: [{ value: 'same', label: 'The reasoning model, same effort' }, { value: 'low', label: 'The reasoning model, low effort' }, { value: 'fast', label: 'A fast non-reasoning model' }] },
    { kind: 'note', text: 'The fast model costs ₹20 per million input and ₹100 per million output tokens. Lookups are customer-facing and should answer within 3 seconds at the 95th percentile; reconciliations run in the background.' },
  ],
  presets: {
    start: { state: { effort: 'high', style: 'scaffold', lookups: 'same' }, expected: { accuracy: 0.9565, dailyCost: 41947.5 } },
    goals: { state: { effort: 'high', style: 'goals', lookups: 'same' }, expected: { accuracy: 0.9685, dailyCost: 36295 } },
    split: { state: { effort: 'high', style: 'goals', lookups: 'low' }, expected: { accuracy: 0.965, dailyCost: 28262.5 } },
    routed: { state: { effort: 'high', style: 'goals', lookups: 'fast' }, expected: { accuracy: 0.9615, dailyCost: 25900 } },
  },
  initialPreset: 'start',
  simulate: simulateReasoningPrompt,
  outputs: [
    { kind: 'meter', label: 'Accuracy, all tasks', value: (r) => r.accuracy, detail: (r) => `= lookups ${formatPercent(r.lookup.accuracy, 1)} · reconciliations ${formatPercent(r.reconciliation.accuracy, 1)}`, emphasis: (r) => (r.accuracy < 0.96 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Thinking tokens per task', value: (r) => formatCount(Math.round(r.thinkingPerTask)), detail: () => 'average across the mix; billed as output tokens' },
    { kind: 'value', label: 'Cost a day', value: (r) => rupees(r.dailyCost), detail: (r) => `${rupees(r.dailyCost * 30)} a month · lookup ${rupees(r.lookup.cost)} · reconciliation ${rupees(r.reconciliation.cost)}` },
    { kind: 'value', label: 'p95 latency, lookups', value: (r) => `${formatFixed(r.lookup.p95, 1)} s`, emphasis: (r) => (r.lookup.p95 > 3 ? 'warn' : 'normal') },
    { kind: 'value', label: 'p95 latency, reconciliations', value: (r) => `${Math.round(r.reconciliation.p95)} s` },
  ],
  verdict: (r, s) => {
    if (isFit(r)) return { tone: 'ok', headline: 'Right prompt, right effort, right model.', detail: 'Reconciliations get the thinking they need; lookups stay fast and cheap.' };
    const tone = r.accuracy < 0.94 || r.lookup.p95 > 10 ? 'no' : 'mid';
    if (r.lookup.p95 > 10) return { tone, headline: 'Lookups are waiting on thinking.', detail: 'A balance or status lookup does not need a plan. Lower its effort or send it to a fast model.' };
    if (s.style === 'scaffold') return { tone, headline: 'The scaffold is getting in the way.', detail: 'The fixed recipe and written-out working cost tokens and accuracy on reconciliations.' };
    if (r.accuracy < 0.94) return { tone, headline: 'Too little thinking for the hard cases.', detail: 'Raise the reconciliation effort.' };
    return { tone, headline: 'Close, but not there yet.', detail: r.dailyCost > 30000 ? 'Accuracy is fine; the spend is not. Handle lookups more cheaply.' : 'Raise the reconciliation effort or handle lookups differently.' };
  },
  narrate: (r, s) => {
    const scaffold = s.style === 'scaffold';
    return [
      scaffold ? 'The scaffold tells the model how to think, adds 1,100 tokens of worked examples and asks for the working in the answer.' : 'The prompt states the goal, the constraints and a check, and asks for the JSON only.',
      `At ${s.effort} effort, reconciliations are ${formatPercent(r.reconciliation.accuracy, 1)} right${scaffold && s.effort !== 'low' ? `, below the ${formatPercent(RECON_ACCURACY.goals[s.effort], 1)} the same effort reaches without the recipe` : ''}.`,
      s.lookups === 'fast'
        ? `Lookups go to a fast model: ${formatPercent(r.lookup.accuracy, 1)} right, ${formatFixed(r.lookup.p95, 1)} s at p95.`
        : `Lookups run on the reasoning model at ${s.lookups === 'low' ? 'low' : s.effort} effort: ${formatPercent(r.lookup.accuracy, 1)} right, ${formatFixed(r.lookup.p95, 1)} s at p95${r.lookup.p95 > 3 ? ', too slow for a customer waiting in the app' : ''}.`,
      `The day costs ${rupees(r.dailyCost)}, or ${rupees(r.dailyCost * 30)} a month.`,
    ].join(' ');
  },
  missions: {
    fit: ({ result }) => isFit(result),
    recon: ({ state, result }) => result.reconciliation.accuracy >= 0.93 && state.lookups !== 'same',
    cheap: ({ result }) => result.dailyCost <= 15000 && result.accuracy >= 0.94,
  },
});
