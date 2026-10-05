/**
 * Kavach Bima (fictional insurer) helpline speech recognition. Calls: 45% Hindi, 20% Hinglish, 15% Tamil, 10% Bengali,
 * 10% English over 8 kHz lines. WER in %; a minute handled by a person costs about ₹12. Illustrative.
 */
export type AsrModel = 'global' | 'multi' | 'indic';
export type CallLanguage = 'hi' | 'hg' | 'ta' | 'bn' | 'en';
export interface IndicSpeechState { readonly asr: AsrModel; readonly languageId: boolean; readonly vocabulary: boolean; readonly telephonyTuned: boolean }
export interface IndicSpeechResult { readonly wer: Readonly<Record<CallLanguage, number>>; readonly blendedWer: number; readonly amountsRight: number; readonly needPerson: number; readonly stackRupees: number; readonly peopleRupees: number; readonly rupeesPerMinute: number }

export const CALL_MIX: Readonly<Record<CallLanguage, number>> = { hi: 0.45, hg: 0.2, ta: 0.15, bn: 0.1, en: 0.1 };
export const LANGUAGE_NAMES: Readonly<Record<CallLanguage, string>> = { hi: 'Hindi', hg: 'Hinglish', ta: 'Tamil', bn: 'Bengali', en: 'English' };
const BASE_WER: Readonly<Record<AsrModel, Readonly<Record<CallLanguage, number>>>> = {
  global: { hi: 30, hg: 38, ta: 55, bn: 50, en: 12 },
  multi: { hi: 18, hg: 26, ta: 30, bn: 28, en: 14 },
  indic: { hi: 13, hg: 18, ta: 21, bn: 19, en: 15 },
};
/** Penalty when the language is fixed at the start of the call instead of identified per turn. */
const NO_LID_PENALTY: Readonly<Record<CallLanguage, number>> = { hi: 1, hg: 1.35, ta: 1.2, bn: 1.2, en: 1.25 };
const STACK_RUPEES: Readonly<Record<AsrModel, number>> = { global: 2, multi: 2.2, indic: 2.5 };
const PERSON_RUPEES_PER_MINUTE = 12;

export function simulateIndicSpeech(s: IndicSpeechState): IndicSpeechResult {
  const languages = Object.keys(CALL_MIX) as CallLanguage[];
  const wer = Object.fromEntries(languages.map((k) => [k, BASE_WER[s.asr][k] * (s.languageId ? 1 : NO_LID_PENALTY[k]) * (s.telephonyTuned ? 0.8 : 1) * (s.vocabulary ? 0.95 : 1)])) as Record<CallLanguage, number>;
  const blendedWer = languages.reduce((a, k) => a + CALL_MIX[k] * wer[k], 0);
  const amountsRight = Math.max(0.2, Math.min(0.99, (s.vocabulary ? 0.98 : 0.8) - (0.6 * blendedWer) / 100));
  const needPerson = Math.min(1, 0.04 + (0.8 * blendedWer) / 100 + 0.4 * (1 - amountsRight));
  const stackRupees = STACK_RUPEES[s.asr] + (s.languageId ? 0.1 : 0) + (s.telephonyTuned ? 0.3 : 0);
  const peopleRupees = needPerson * PERSON_RUPEES_PER_MINUTE;
  return { wer, blendedWer, amountsRight, needPerson, stackRupees, peopleRupees, rupeesPerMinute: stackRupees + peopleRupees };
}
