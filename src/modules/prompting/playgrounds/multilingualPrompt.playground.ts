import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateMultilingualPrompt, type MultilingualPromptResult, type MultilingualPromptState } from '../simulators/multilingualPrompt';

const isGood = (r: MultilingualPromptResult) => r.intent >= 0.92 && r.amounts >= 0.94 && r.schemaValid >= 0.98 && r.wrongLanguage <= 20;

export const multilingualPromptPlayground = definePlayground<MultilingualPromptState, MultilingualPromptResult>({
  techniqueId: 'mlprompt',
  title: 'Prompt for Kaveri Bank’s customers',
  intro: '1,000 support messages: 400 English, 300 Hinglish in Roman script, 300 Hindi in Devanagari. The model returns intent, amount and a reply as JSON. Kaveri Bank is fictional.',
  controls: [
    { kind: 'toggle', key: 'replyLanguage', label: 'Tell the model to reply in the customer’s language and script' },
    { kind: 'toggle', key: 'englishEnums', label: 'Keep keys and intent labels in English' },
    { kind: 'toggle', key: 'amountRules', label: 'Rules for amounts: “saadhe teen hazaar” → 3500' },
    { kind: 'toggle', key: 'codeMixedExamples', label: 'Add two code-mixed examples (Hinglish and Hindi)' },
  ],
  presets: {
    start: { state: { replyLanguage: false, englishEnums: false, amountRules: false, codeMixedExamples: false }, expected: { schemaValid: 0.9, intent: 0.866, amounts: 0.816, wrongLanguage: 132 } },
    enum: { state: { replyLanguage: false, englishEnums: true, amountRules: false, codeMixedExamples: false }, expected: { schemaValid: 0.99, intent: 0.878 } },
    lean: { state: { replyLanguage: true, englishEnums: true, amountRules: true, codeMixedExamples: false }, expected: { amounts: 0.945, wrongLanguage: 12, tokens: 530 } },
    full: { state: { replyLanguage: true, englishEnums: true, amountRules: true, codeMixedExamples: true }, expected: { intent: 0.926, hinglish: 0.9, hindi: 0.92, tokens: 880 } },
  },
  initialPreset: 'start',
  simulate: simulateMultilingualPrompt,
  outputs: [
    { kind: 'meter', label: 'Schema-valid JSON', value: (r) => r.schemaValid, emphasis: (r) => (r.schemaValid < 0.98 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Intent accuracy, all', value: (r) => r.intent },
    { kind: 'meter', label: 'Hinglish intent', value: (r) => r.hinglish, detail: () => '300 messages', emphasis: (r) => (r.hinglish < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Hindi intent', value: (r) => r.hindi, detail: () => '300 messages', emphasis: (r) => (r.hindi < 0.88 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Amounts captured', value: (r) => r.amounts, emphasis: (r) => (r.amounts < 0.94 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Replies in the wrong language', value: (r) => formatCount(r.wrongLanguage), emphasis: (r) => (r.wrongLanguage > 20 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Prompt tokens per message', value: (r) => formatCount(r.tokens) },
  ],
  verdict: (r) => {
    if (isGood(r)) return { tone: 'ok', headline: 'Every slice works.', detail: 'Stable labels, the right language, the right amounts.' };
    const tone = r.intent < 0.88 ? 'no' : 'mid';
    if (r.schemaValid < 0.98) return { tone, headline: 'Labels come back in Hindi.', detail: 'Keep enums in English.' };
    if (r.wrongLanguage > 20) return { tone, headline: 'Replies ignore the customer’s language.', detail: 'Say which language and script to reply in.' };
    if (r.amounts < 0.94) return { tone, headline: 'Spoken amounts are misread.', detail: 'Add amount rules with examples.' };
    return { tone, headline: 'Hinglish still lags.', detail: 'Add code-mixed examples.' };
  },
  narrate: (r, s) => [
    s.englishEnums ? 'Intent labels stay in English, so the JSON validates.' : 'Without fixed English labels, some intents come back as “refund sthiti” and fail the schema.',
    s.replyLanguage ? 'The reply matches the customer’s language and script.' : 'About one Hindi or Hinglish customer in five gets an English reply.',
    s.amountRules ? 'Amount rules turn “saadhe teen hazaar” into 3500.' : 'Spoken amounts are often misread or left as words.',
    s.codeMixedExamples ? 'Code-mixed examples lift Hinglish most, at 350 more tokens a message.' : 'With English-only examples, Hinglish trails English by 17 points.',
    `Overall intent accuracy is ${formatWholePercent(r.intent)}.`,
  ].join(' '),
  missions: {
    good: ({ result }) => isGood(result),
    lean: ({ result }) => result.wrongLanguage <= 20 && result.amounts >= 0.94 && result.tokens <= 600,
    enum: ({ result }) => result.schemaValid >= 0.98,
  },
});
