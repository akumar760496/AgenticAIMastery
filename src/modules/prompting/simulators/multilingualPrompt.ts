/** Kaveri Bank (fictional): 1,000 messages — 400 English, 300 Hinglish (Roman), 300 Hindi (Devanagari). */
export interface MultilingualPromptState { readonly replyLanguage: boolean; readonly englishEnums: boolean; readonly amountRules: boolean; readonly codeMixedExamples: boolean }
export interface MultilingualPromptResult { readonly schemaValid: number; readonly hinglish: number; readonly hindi: number; readonly intent: number; readonly amounts: number; readonly wrongLanguage: number; readonly tokens: number }

export function simulateMultilingualPrompt(s: MultilingualPromptState): MultilingualPromptResult {
  const enumBonus = s.englishEnums ? 0.02 : 0;
  const hinglish = 0.78 + (s.codeMixedExamples ? 0.1 : 0) + enumBonus;
  const hindi = 0.84 + (s.codeMixedExamples ? 0.06 : 0) + enumBonus;
  const amountHinglish = s.amountRules ? 0.93 : 0.7;
  const amountHindi = s.amountRules ? 0.94 : 0.74;
  return {
    schemaValid: s.englishEnums ? 0.99 : 0.9,
    hinglish, hindi,
    intent: (400 * 0.95 + 300 * hinglish + 300 * hindi) / 1000,
    amounts: (400 * 0.96 + 300 * amountHinglish + 300 * amountHindi) / 1000,
    wrongLanguage: s.replyLanguage ? 12 : 132,
    tokens: 450 + (s.replyLanguage ? 20 : 0) + (s.amountRules ? 60 : 0) + (s.codeMixedExamples ? 350 : 0),
  };
}
