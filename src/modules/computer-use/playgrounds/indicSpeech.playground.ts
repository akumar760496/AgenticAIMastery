import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatRupees, formatWholePercent } from '@/shared/format';
import { CALL_MIX, LANGUAGE_NAMES, simulateIndicSpeech, type CallLanguage, type IndicSpeechResult, type IndicSpeechState } from '../simulators/indicSpeech';

const isGood = (r: IndicSpeechResult) => r.amountsRight >= 0.9 && r.needPerson <= 0.2;

export const indicSpeechPlayground = definePlayground<IndicSpeechState, IndicSpeechResult>({
  techniqueId: 'indicspeech',
  title: 'Hear Kavach Bima’s callers',
  intro: 'Kavach Bima, a fictional insurer. Calls are 45% Hindi, 20% Hinglish, 15% Tamil, 10% Bengali and 10% English, over 8 kHz phone lines. Callers ask about premiums, lapsed policies and claims, and say amounts such as “saadhe teen hazaar”. Figures are illustrative.',
  controls: [
    { kind: 'select', key: 'asr', label: 'Speech model', options: [{ value: 'global', label: 'English-first global model' }, { value: 'multi', label: 'Multilingual general model' }, { value: 'indic', label: 'Indic-tuned model' }] },
    { kind: 'toggle', key: 'languageId', label: 'Identify the language on every turn' },
    { kind: 'toggle', key: 'vocabulary', label: 'Custom vocabulary for policy terms and amounts' },
    { kind: 'toggle', key: 'telephonyTuned', label: 'Fine-tuned for 8 kHz telephony audio' },
    { kind: 'note', text: 'Without per-turn identification the language is fixed at the start of the call. A minute handled by a person costs about ₹12.' },
  ],
  presets: {
    start: { state: { asr: 'global', languageId: false, vocabulary: false, telephonyTuned: false }, expected: { blendedWer: 41.16, amountsRight: 0.55304, needPerson: 0.548064 } },
    multi: { state: { asr: 'multi', languageId: true, vocabulary: false, telephonyTuned: false }, expected: { blendedWer: 22, rupeesPerMinute: 6.4856 } },
    indic: { state: { asr: 'indic', languageId: false, vocabulary: false, telephonyTuned: false }, expected: { blendedWer: 18.645 } },
    full: { state: { asr: 'indic', languageId: true, vocabulary: true, telephonyTuned: true }, expected: { blendedWer: 12.16, amountsRight: 0.90704, rupeesPerMinute: 4.993568 } },
  },
  initialPreset: 'start',
  simulate: simulateIndicSpeech,
  outputs: [
    { kind: 'table', columns: ['Language', 'Share of calls', 'Words misheard'], rows: (r) => (Object.keys(CALL_MIX) as CallLanguage[]).map((k) => [LANGUAGE_NAMES[k], formatWholePercent(CALL_MIX[k]), `${formatFixed(r.wer[k], 0)}%`]) },
    { kind: 'meter', label: 'Blended word error rate', value: (r) => r.blendedWer / 100, emphasis: (r) => (r.blendedWer > 20 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Amounts captured correctly', value: (r) => r.amountsRight, emphasis: (r) => (r.amountsRight < 0.9 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Calls needing a person', value: (r) => r.needPerson, emphasis: (r) => (r.needPerson > 0.2 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per minute', value: (r) => formatRupees(r.rupeesPerMinute, 2), detail: (r) => `speech stack ${formatRupees(r.stackRupees, 2)} · people ${formatRupees(r.peopleRupees, 2)}` },
  ],
  verdict: (r, s) => {
    if (isGood(r)) return { tone: 'ok', headline: 'Heard in every language.', detail: 'Each language is recognised well enough, and amounts are captured and confirmed.' };
    if (s.asr === 'global') return { tone: 'no', headline: 'Most callers are misheard.', detail: 'An English-first model cannot carry Hindi, Tamil and Bengali calls.' };
    const detail = !s.vocabulary ? 'Amounts and policy terms still come out wrong.' : !s.languageId ? 'Callers who switch language are misheard.' : !s.telephonyTuned ? 'Phone audio is still costing accuracy.' : 'Try the Indic-tuned model.';
    return { tone: 'mid', headline: 'Better, not there yet.', detail };
  },
  narrate: (r) => `Across the call mix ${formatFixed(r.blendedWer, 0)}% of words are misheard, with Tamil at ${formatFixed(r.wer.ta, 0)}% and Hinglish at ${formatFixed(r.wer.hg, 0)}%. ${formatWholePercent(r.amountsRight)} of amounts are captured correctly and ${formatWholePercent(r.needPerson)} of calls need a person, so a minute costs ${formatRupees(r.rupeesPerMinute, 2)}.`,
  missions: {
    amounts: ({ result }) => isGood(result),
    tamil: ({ result }) => result.wer.ta <= 20,
    lid: ({ state, result }) => state.asr === 'indic' && !state.languageId && result.wer.hg > 20,
  },
});
