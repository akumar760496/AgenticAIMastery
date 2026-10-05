import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { STEPS, simulateDurable, type DurableResult, type DurableState } from '../simulators/durableExecution';

export const durableExecutionPlayground = definePlayground<DurableState, DurableResult>({
  techniqueId: 'durable',
  title: 'A ten-step health-claim workflow crashes',
  intro: 'Steps 3–6 are model calls of 6,000 tokens each. Step 7 waits for a surveyor; step 8 pays the hospital. A crash during step 8 happens after the hospital API accepted the payment but before the result was recorded.',
  controls: [
    { kind: 'select', key: 'mode', label: 'Runs as', options: [{ value: 'script', label: 'A plain script (restart from step 1)' }, { value: 'ckpt', label: 'LangGraph with a checkpointer' }, { value: 'durable', label: 'A Temporal workflow' }] },
    { kind: 'steps', key: 'crashStep', label: 'Crash during step', values: STEPS.map((_, i) => i + 1), format: (v) => `${v} · ${STEPS[v - 1]}` },
    { kind: 'toggle', key: 'idempotencyKey', label: 'Idempotency key on the payment' },
  ],
  presets: {
    start: { state: { mode: 'script', crashStep: 6, idempotencyKey: false }, expected: { rerun: 6, modelRepeats: 4, wastedTokens: 18000, resumeMin: 30 } },
    ckpt: { state: { mode: 'ckpt', crashStep: 8, idempotencyKey: false }, expected: { rerun: 1, paidTwice: true } },
    durable: { state: { mode: 'durable', crashStep: 8, idempotencyKey: true }, expected: { rerun: 1, paidTwice: false, resumeMin: 0.2 } },
    late: { state: { mode: 'durable', crashStep: 6, idempotencyKey: true }, expected: { modelRepeats: 1, wastedTokens: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateDurable,
  outputs: [
    { kind: 'badges', items: (r) => r.rerunSteps.map((i) => ({ text: `runs again: ${i} ${STEPS[i - 1]}`, emphasis: 'warn' as const })) },
    { kind: 'value', label: 'Steps run again', value: (r) => String(r.rerun) },
    { kind: 'value', label: 'Model calls repeated', value: (r) => String(r.modelRepeats), detail: (r) => (r.wastedTokens ? `${formatCount(r.wastedTokens)} tokens of completed work wasted` : 'no completed work wasted') },
    { kind: 'check', label: 'Hospital paid once', value: (r) => !r.paidTwice },
    { kind: 'check', label: 'Surveyor not asked again', value: (r) => !r.reasked },
    { kind: 'value', label: 'Time to resume', value: (r) => (r.resumeMin < 1 ? 'under a minute' : `${r.resumeMin} min`) },
  ],
  verdict: (r) => {
    if (r.paidTwice) return { tone: 'no', headline: 'The hospital is paid twice.', detail: 'Retried side effects need an idempotency key.' };
    if (r.rerun > 1) return { tone: 'no', headline: 'Completed work runs again.', detail: 'Record each step so a restart resumes instead of starting over.' };
    return r.resumeMin < 1 ? { tone: 'ok', headline: 'Resumed where it stopped.', detail: 'History replays completed steps; only the in-flight step runs again.' } : { tone: 'mid', headline: 'Resumable, but slowly.', detail: 'Something has to notice and call the graph again.' };
  },
  narrate: (r, s) => [
    s.mode === 'script' ? `The script restarts from step 1, so ${r.rerun} steps run again, including ${r.modelRepeats} model calls.` : `The ${s.mode === 'ckpt' ? 'checkpointer' : 'workflow history'} holds steps 1 to ${s.crashStep - 1}, so only step ${s.crashStep} runs again.`,
    r.wastedTokens ? `That wastes ${formatCount(r.wastedTokens)} tokens of completed work.` : '',
    r.reasked ? 'The pending approval is lost, so the surveyor is asked again.' : '',
    s.crashStep === 8 || (s.mode === 'script' && s.crashStep > 8) ? (s.idempotencyKey ? 'The payment call repeats with the same key, so the hospital API returns the first result: paid once.' : 'The payment call repeats with no key, and the hospital is paid twice.') : '',
    s.mode === 'durable' ? 'Temporal resumes on another worker automatically.' : s.mode === 'ckpt' ? 'Resuming needs something to call the graph again with the same thread id.' : 'Nobody resumes it until someone notices.',
  ].filter(Boolean).join(' '),
  missions: {
    one: ({ state, result }) => state.crashStep === 6 && result.rerun <= 1,
    paid: ({ state, result }) => state.crashStep === 8 && !result.paidTwice && !result.reasked,
    fast: ({ state, result }) => result.resumeMin < 1 && result.modelRepeats === 0 && state.crashStep >= 7,
  },
});
