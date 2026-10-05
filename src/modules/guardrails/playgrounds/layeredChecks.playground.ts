import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { CLASSIFIER_THRESHOLDS, DAILY_TRAFFIC, simulateLayeredChecks, type ClassifierThreshold, type LayeredChecksResult, type LayeredChecksState } from '../simulators/layeredChecks';

const state = (exact: LayeredChecksState['exact'], meaning: LayeredChecksState['meaning'], threshold: ClassifierThreshold): LayeredChecksState => ({ exact, meaning, threshold });
const meetsTarget = (r: LayeredChecksResult) => r.exactCaught === DAILY_TRAFFIC.exactBreaks && r.meaningCaught >= 21 && r.innocentBlocked <= 10;

export const layeredChecksPlayground = definePlayground<LayeredChecksState, LayeredChecksResult>({
  techniqueId: 'det',
  title: 'Rules or a classifier?',
  controls: [
    { kind: 'select', key: 'exact', label: 'Exact rules are checked by', options: [
      { value: 'rules', label: 'Rules in code: limit, regex + Luhn' }, { value: 'classifier', label: 'The classifier' }, { value: 'off', label: 'Nothing' },
    ] },
    { kind: 'select', key: 'meaning', label: 'Harmful meaning is checked by', options: [
      { value: 'keywords', label: 'A keyword deny list' }, { value: 'classifier', label: 'The classifier' }, { value: 'off', label: 'Nothing' },
    ] },
    { kind: 'steps', key: 'threshold', label: 'Classifier block threshold', values: CLASSIFIER_THRESHOLDS, format: (v) => v.toFixed(1) },
    { kind: 'note', text: 'The classifier adds about 30 ms per request. Rules take well under a millisecond.' },
  ],
  presets: {
    start: { state: state('rules', 'off', 0.7), expected: { exactCaught: 70, meaningCaught: 0, harmfulLetThrough: 25 } },
    layered: { state: state('rules', 'classifier', 0.7), expected: { exactCaught: 70, meaningCaught: 21, innocentBlocked: 8, harmfulLetThrough: 4, latencyMs: 30 } },
    jumpy: { state: state('rules', 'classifier', 0.5), expected: { meaningCaught: 24, innocentBlocked: 36 } },
    rulesonly: { state: state('rules', 'keywords', 0.7), expected: { exactCaught: 70, meaningCaught: 6, harmfulLetThrough: 19 } },
  },
  initialPreset: 'start',
  simulate: simulateLayeredChecks,
  outputs: [
    { kind: 'meter', label: 'Exact-rule breaks caught', value: (r) => r.exactCaught / DAILY_TRAFFIC.exactBreaks, detail: (r) => `= ${r.exactCaught} of ${DAILY_TRAFFIC.exactBreaks}`, emphasis: (r) => (r.exactCaught < DAILY_TRAFFIC.exactBreaks ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Harmful paraphrases caught', value: (r) => r.meaningCaught / DAILY_TRAFFIC.harmfulParaphrases, detail: (r) => `= ${r.meaningCaught} of ${DAILY_TRAFFIC.harmfulParaphrases}`, emphasis: (r) => (r.meaningCaught < 21 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Harmful requests let through', value: (r) => String(r.harmfulLetThrough), emphasis: (r) => (r.harmfulLetThrough > 10 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Innocent requests blocked', value: (r) => String(r.innocentBlocked), detail: (r) => (r.innocentBlocked > 10 ? 'real customers turned away every day' : 'within a tolerable level') },
    { kind: 'value', label: 'Added latency per request', value: (r) => (r.latencyMs < 1 ? '< 0.1 ms' : `${r.latencyMs} ms`) },
  ],
  verdict: (r, s) => {
    if (meetsTarget(r)) return { tone: 'ok', headline: 'Each risk has the right check.', detail: 'Rules settle the exact cases in microseconds; the classifier catches the paraphrases.' };
    const tone = r.harmfulLetThrough > 20 ? 'no' : 'mid';
    if (s.exact !== 'rules') return { tone, headline: 'Exact rules need exact checks.', detail: 'A classifier guesses at amounts and card numbers; a rule gets them right every time.' };
    if (s.meaning !== 'classifier') return { tone, headline: 'Keywords cannot read intent.', detail: 'Polite paraphrases contain no banned word.' };
    if (r.innocentBlocked > 10) return { tone, headline: 'The threshold is too jumpy.', detail: 'Raise the threshold to block fewer innocent requests.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Lower the threshold a little to catch more paraphrases.' };
  },
  narrate: (r, s) => {
    const exact = {
      rules: 'Rules catch all 70 exact breaks: the limit refuses every refund over INR 50,000 and the regex with the Luhn check masks every card number, each in microseconds.',
      classifier: 'The classifier catches only 30 of the 70 exact breaks: it has no idea that 50,001 is over a limit, and it misses many card numbers. Exact shapes need rules.',
      off: 'Nothing checks the exact rules, so every over-limit refund and card number goes through.',
    }[s.exact];
    const meaning = {
      classifier: `At ${s.threshold.toFixed(1)} the classifier catches ${r.meaningCaught} of the 25 harmful paraphrases and blocks ${r.innocentBlocked} innocent requests.`,
      keywords: 'The keyword list catches only 6 of 25 paraphrases, because polite requests avoid the banned words, and it blocks 12 innocent messages that happen to contain them.',
      off: 'Nothing checks meaning, so all 25 harmful paraphrases get through.',
    }[s.meaning];
    return `${exact} ${meaning}`;
  },
  missions: {
    layer: ({ result }) => meetsTarget(result),
    keyword: ({ state: s, result }) => s.meaning === 'keywords' && result.meaningCaught < 10,
    numbers: ({ state: s, result }) => s.exact === 'classifier' && result.exactCaught < 40,
  },
});
