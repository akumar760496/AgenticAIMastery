import { definePlayground, type ListItem } from '@/domain/playground/PlaygroundDefinition';
import { joinWithAnd, pluralise } from '@/shared/format';
import { DEFECTIVE_COUNT, DRAFTS, MODEL_CALL_MS, OUTPUT_CHECKS, simulateOutputRail, type DraftOutcome, type OutputRailResult, type OutputRailState } from '../simulators/outputRail';

const ALL_ON = { schema: true, grounding: true, toxicity: true, leakage: true } as const;
const OUTCOME_VIEW: Readonly<Record<DraftOutcome, Pick<ListItem, 'status' | 'tone'>>> = {
  sent: { status: 'sent', tone: 'ok' },
  defectSent: { status: 'defect sent', tone: 'no' },
  fallback: { status: 'fallback sent', tone: 'mid' },
  toPerson: { status: 'to a person', tone: 'human' },
  fixedOnRetry: { status: 'fixed on retry', tone: 'ok' },
  retryFailed: { status: 'retry failed: fallback', tone: 'mid' },
};

export const outputRailPlayground = definePlayground<OutputRailState, OutputRailResult>({
  techniqueId: 'post',
  title: 'Checks on each draft',
  controls: [
    { kind: 'flagSet', key: 'checks', label: 'Checks', options: OUTPUT_CHECKS.map((c) => ({ value: c.kind, label: `${c.label} (+${c.latencyMs} ms)` })) },
    { kind: 'select', key: 'onFailure', label: 'On failure', options: [
      { value: 'block', label: 'Block and send a safe fallback' },
      { value: 'retry', label: 'Retry once with the failure reason' },
      { value: 'human', label: 'Escalate to a person' },
    ] },
    { kind: 'toggle', key: 'stream', label: 'Stream tokens to the customer while checks run' },
  ],
  presets: {
    start: { state: { checks: { schema: true, grounding: false, toxicity: true, leakage: false }, onFailure: 'retry', stream: false }, expected: { defectsSeen: 3, goodAnswers: 7, modelCalls: 13, addedWaitMs: 391 } },
    all: { state: { checks: ALL_ON, onFailure: 'retry', stream: false }, expected: { defectsSeen: 0, goodAnswers: 9, modelCalls: 16, addedWaitMs: 1039 } },
    block: { state: { checks: ALL_ON, onFailure: 'block', stream: false }, expected: { defectsSeen: 0, goodAnswers: 4, modelCalls: 10, addedWaitMs: 237 } },
    stream: { state: { checks: ALL_ON, onFailure: 'retry', stream: true }, expected: { defectsSeen: 6, glimpsed: 6, goodAnswers: 9, addedWaitMs: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateOutputRail,
  outputs: [
    { kind: 'meter', label: 'Defective replies seen by customers', value: (r) => r.defectsSeen / DEFECTIVE_COUNT, detail: (r) => `= ${r.defectsSeen} of ${DEFECTIVE_COUNT} defective drafts${r.glimpsed ? ` (${r.glimpsed} glimpsed while streaming)` : ''}`, emphasis: (r) => (r.defectsSeen ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Good answers delivered', value: (r) => r.goodAnswers / DRAFTS.length, detail: (r) => `= ${r.goodAnswers} of ${DRAFTS.length} drafts sent correct` },
    { kind: 'value', label: 'Added wait before text appears', value: (r) => (r.stream ? '0 ms (streaming)' : `+${r.addedWaitMs} ms`), detail: (r) => (r.stream ? 'Text is shown before any check finishes.' : `= ${r.checkMs} ms of checks${r.retries ? ` + ${r.retries} ${pluralise(r.retries, 'retry', 'retries')} × ${MODEL_CALL_MS + r.checkMs} ms ÷ ${DRAFTS.length} drafts` : ''}`) },
    { kind: 'value', label: 'Model calls', value: (r) => String(r.modelCalls) },
    { kind: 'value', label: 'Fallback messages · sent to a person', value: (r) => `${r.fallbacks} · ${r.toPerson}` },
    {
      kind: 'itemList', title: 'Ten drafts from the claims bot',
      items: (r) => r.drafts.map((d, i) => ({
        label: `#${i + 1}`, text: d.draft.text, ...OUTCOME_VIEW[d.outcome],
        ...(d.glimpsed ? { status: `glimpsed · ${OUTCOME_VIEW[d.outcome].status}`, tone: 'no' as const } : {}),
        ...(d.draft.defect ? { detail: `defect: ${d.draft.reason}${d.caught ? ' · caught' : ' · not checked'}` } : {}),
        flagged: d.outcome === 'defectSent' || d.glimpsed,
      })),
    },
  ],
  verdict: (r) => {
    if (r.defectsSeen) return { tone: 'no', headline: `${r.defectsSeen} defective ${pluralise(r.defectsSeen, 'reply', 'replies')} reached customers.`, detail: r.uncheckedDefects.length ? `${pluralise(r.uncheckedDefects.length, 'Draft')} ${joinWithAnd(r.uncheckedDefects.map(String))} had no matching check.` : 'Streaming showed the text before the checks finished.' };
    return r.goodAnswers >= 9
      ? { tone: 'ok', headline: 'No defect reached a customer.', detail: 'And nearly every customer got a correct answer.' }
      : { tone: 'mid', headline: 'No defect reached a customer.', detail: `But only ${r.goodAnswers} of ${DRAFTS.length} customers got a real answer.` };
  },
  narrate: (r, s) => {
    const enabled = OUTPUT_CHECKS.filter((c) => s.checks[c.kind]).length;
    const stubbornCaught = r.drafts.some((d) => d.outcome === 'retryFailed');
    const parts = [`${enabled} of ${OUTPUT_CHECKS.length} checks are on, adding ${r.checkMs} ms to every draft.`];
    parts.push(r.uncheckedDefects.length ? `${pluralise(r.uncheckedDefects.length, 'Draft')} ${joinWithAnd(r.uncheckedDefects.map(String))} ${r.uncheckedDefects.length > 1 ? 'have defects' : 'has a defect'} no enabled check looks for, so ${r.uncheckedDefects.length > 1 ? 'they go' : 'it goes'} straight to the customer.` : 'Every defect is caught by a check.');
    if (r.glimpsed) parts.push(`Because tokens stream, customers read ${r.glimpsed} bad ${pluralise(r.glimpsed, 'draft')} before the check fails and the text is retracted.`);
    if (r.retries) parts.push(`${r.retries} failed ${pluralise(r.retries, 'draft')} ${r.retries > 1 ? 'are' : 'is'} retried with the reason as feedback: ${r.retries - (stubbornCaught ? 1 : 0)} fixed${stubbornCaught ? ', and the flood-cover claim fails again, so a fallback is sent instead of looping' : ''}. That costs ${r.retries} extra model ${pluralise(r.retries, 'call')}.`);
    if (s.onFailure === 'block' && r.fallbacks) parts.push(`${r.fallbacks} ${pluralise(r.fallbacks, 'customer')} get a safe fallback instead of an answer: safe, fast, but unhelpful.`);
    if (r.toPerson) parts.push(`${r.toPerson} ${pluralise(r.toPerson, 'draft')} go to a person, which is safe but slow and costs staff time.`);
    if (!r.stream) parts.push(`The customer waits ${r.addedWaitMs} ms longer on average.`);
    return parts.join(' ');
  },
  missions: {
    zero: ({ result }) => result.defectsSeen === 0,
    nine: ({ result }) => result.defectsSeen === 0 && result.goodAnswers >= 9,
    fast: ({ result }) => result.defectsSeen === 0 && !result.stream && result.addedWaitMs <= 300,
  },
});
