import { definePlayground, type ListItem } from '@/domain/playground/PlaygroundDefinition';
import { joinWithAnd, pluralise } from '@/shared/format';
import { ATTACK_COUNT, INCOMING_INPUTS, LEGITIMATE_COUNT, simulateInputRail, type InputOutcome, type InputRailResult, type InputRailState } from '../simulators/inputRail';

const THRESHOLDS = Array.from({ length: 14 }, (_, i) => 30 + i * 5);
const asScore = (v: number) => (v / 100).toFixed(2);

const OUTCOME_VIEW: Readonly<Record<InputOutcome, Pick<ListItem, 'status' | 'tone'>>> = {
  blocked: { status: 'blocked', tone: 'ok' },
  blockedLegitimate: { status: 'blocked: real user', tone: 'mid' },
  attackReachesModel: { status: 'reaches model', tone: 'no' },
  piiToModel: { status: 'PII → model', tone: 'mid' },
  maskedToModel: { status: 'masked → model', tone: 'ok' },
  toModel: { status: '→ model', tone: 'ok' },
};

export const inputRailPlayground = definePlayground<InputRailState, InputRailResult>({
  techniqueId: 'pre',
  title: 'Input rail settings',
  controls: [
    { kind: 'toggle', key: 'mask', label: 'Mask personal data (Presidio)' },
    { kind: 'toggle', key: 'screenUser', label: 'Screen user messages for injection' },
    { kind: 'toggle', key: 'screenDocuments', label: 'Screen documents and tool results too' },
    { kind: 'steps', key: 'threshold', label: 'Block when injection score ≥', values: THRESHOLDS, format: asScore },
  ],
  presets: {
    start: { state: { mask: false, screenUser: true, screenDocuments: false, threshold: 50 }, expected: { attacksStopped: 2, legitimateBlocked: 1, piiSentToModel: 5, latencyMs: 25 } },
    full: { state: { mask: true, screenUser: true, screenDocuments: true, threshold: 50 }, expected: { attacksStopped: 4, legitimateBlocked: 1, piiSentToModel: 0, latencyMs: 65 } },
    lenient: { state: { mask: true, screenUser: true, screenDocuments: true, threshold: 90 }, expected: { attacksStopped: 2, legitimateBlocked: 0, piiSentToModel: 0, latencyMs: 65 } },
  },
  initialPreset: 'start',
  simulate: simulateInputRail,
  outputs: [
    { kind: 'meter', label: 'Attacks stopped', value: (r) => r.attacksStopped / ATTACK_COUNT, detail: (r) => `= ${r.attacksStopped} of ${ATTACK_COUNT} injection attempts blocked` },
    { kind: 'meter', label: 'Real users blocked', value: (r) => r.legitimateBlocked / LEGITIMATE_COUNT, detail: (r) => `= ${r.legitimateBlocked} of ${LEGITIMATE_COUNT} legitimate inputs blocked`, emphasis: () => 'warn' },
    { kind: 'value', label: 'Personal data sent to the model', value: (r) => `${r.piiSentToModel} ${pluralise(r.piiSentToModel, 'value')}`, emphasis: (r) => (r.piiSentToModel ? 'warn' : 'normal') },
    { kind: 'value', label: 'Added latency per request', value: (r) => `+${r.latencyMs} ms` },
    {
      kind: 'itemList', title: 'Eight incoming inputs',
      items: (r) => r.inputs.map((j, i) => ({
        label: `${i + 1} · ${j.input.source}`, text: j.input.text, ...OUTCOME_VIEW[j.outcome],
        ...(j.outcome === 'piiToModel' ? { status: `${j.input.piiCount} PII → model` } : {}),
        detail: `injection score ${asScore(j.input.score)}${j.screened ? '' : ' · not screened'}`,
        flagged: j.outcome === 'attackReachesModel',
      })),
    },
  ],
  verdict: (r) => {
    const missed = ATTACK_COUNT - r.attacksStopped;
    const tone = r.attacksStopped === ATTACK_COUNT && r.legitimateBlocked <= 1 && !r.piiSentToModel ? 'ok' : r.attacksStopped >= 3 && !r.piiSentToModel ? 'mid' : 'no';
    return {
      tone,
      headline: missed ? `${missed} ${pluralise(missed, 'attack')} ${missed > 1 ? 'reach' : 'reaches'} the model.` : 'Every attack stopped.',
      detail: `${r.legitimateBlocked ? `${r.legitimateBlocked} real ${pluralise(r.legitimateBlocked, 'user')} blocked as well.` : 'No real user is blocked.'} ${r.piiSentToModel ? `${r.piiSentToModel} personal data values leave your systems.` : 'No raw personal data leaves your systems.'}`,
    };
  },
  narrate: (r, s) => {
    const indirect = r.missedAttacks.filter((n) => INCOMING_INPUTS[n - 1]?.source !== 'user');
    const parts = [`The rail blocks inputs whose injection score is at least ${asScore(s.threshold)}. It stops ${r.attacksStopped} of the ${ATTACK_COUNT} attacks${r.missedAttacks.length ? `; ${pluralise(r.missedAttacks.length, 'input')} ${joinWithAnd(r.missedAttacks.map(String))} still reach the model.` : '.'}`];
    if (indirect.length && !s.screenDocuments) parts.push('Documents and tool results are not screened, so the injected web page and PDF go straight into the prompt: this is indirect prompt injection.');
    if (r.blockedLegitimate.length) parts.push(`Input ${joinWithAnd(r.blockedLegitimate.map(String))} is a real customer whose message contains “ignore”, and it is blocked: a false positive.${s.threshold <= 62 ? ' Raising the threshold above 0.62 lets it through, at the cost of the subtle PDF note.' : ''}`);
    parts.push(s.mask ? 'Masking replaces names, the PAN, the email and the phone number with placeholders before the model sees them.' : `Masking is off, so ${r.piiSentToModel} personal data values go to the model provider and into its logs.`);
    parts.push(`Together these checks add ${r.latencyMs} ms to every request.`);
    return parts.join(' ');
  },
  missions: {
    all: ({ result }) => result.attacksStopped === ATTACK_COUNT && result.legitimateBlocked <= 1,
    clean: ({ result }) => result.attacksStopped === 3 && result.legitimateBlocked === 0,
    pii: ({ result }) => result.piiSentToModel === 0,
  },
});
