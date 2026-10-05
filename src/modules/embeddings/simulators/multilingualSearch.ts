/** English-only vs multilingual embeddings for a (fictional) bank's English, Hindi and Hinglish queries. Recall values in percent. */
export type LanguageModel = 'en' | 'multi';
export type IndexLanguages = 'en' | 'enhi';

const RECALL: Readonly<Record<LanguageModel, { en: number; hi: Readonly<Record<IndexLanguages, number>>; hinglish: Readonly<Record<'off' | 'on', Readonly<Record<IndexLanguages, number>>>> }>> = {
  en: { en: 88, hi: { en: 8, enhi: 22 }, hinglish: { off: { en: 35, enhi: 36 }, on: { en: 30, enhi: 38 } } },
  multi: { en: 87, hi: { en: 74, enhi: 84 }, hinglish: { off: { en: 58, enhi: 62 }, on: { en: 72, enhi: 80 } } },
};
export const MODEL_DIMENSIONS: Readonly<Record<LanguageModel, number>> = { en: 384, multi: 1024 };
const HINDI_FERTILITY: Readonly<Record<LanguageModel, number>> = { en: 3, multi: 1.6 };
export const CHUNKS = 240000;
export const CHUNK_TOKENS = 300;
const INR_PER_MILLION_TOKENS = 10;

export interface MultilingualState { readonly model: LanguageModel; readonly transliterate: boolean; readonly index: IndexLanguages; readonly perLanguage: boolean }
export interface MultilingualResult {
  readonly english: number;
  readonly hindi: number;
  readonly hinglish: number;
  readonly overall: number;
  readonly weakest: number;
  readonly vectors: number;
  readonly dimensions: number;
  readonly indexMb: number;
  readonly hindiChunkTokens: number;
  readonly tokens: number;
  readonly costInr: number;
  /** Whether per-language recall is reported; when false only the overall figure is visible. */
  readonly perLanguage: boolean;
}

export function simulateMultilingual(s: MultilingualState): MultilingualResult {
  const r = RECALL[s.model];
  const english = r.en;
  const hindi = r.hi[s.index];
  const hinglish = r.hinglish[s.transliterate ? 'on' : 'off'][s.index];
  const vectors = CHUNKS * (s.index === 'enhi' ? 2 : 1);
  const dimensions = MODEL_DIMENSIONS[s.model];
  const hindiChunkTokens = Math.round(CHUNK_TOKENS * HINDI_FERTILITY[s.model]);
  const tokens = CHUNKS * CHUNK_TOKENS + (s.index === 'enhi' ? CHUNKS * hindiChunkTokens : 0);
  return {
    english, hindi, hinglish,
    overall: (2 * english + hindi + hinglish) / 4,
    weakest: Math.min(english, hindi, hinglish),
    vectors, dimensions, indexMb: (vectors * dimensions * 4) / 1e6,
    hindiChunkTokens, tokens, costInr: (tokens / 1e6) * INR_PER_MILLION_TOKENS,
    perLanguage: s.perLanguage,
  };
}
