import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateMultilingual, type MultilingualResult, type MultilingualState } from '../simulators/multilingualSearch';

const size = (mb: number) => (mb < 1000 ? `${mb.toFixed(1)} MB` : `${(mb / 1000).toFixed(2)} GB`);
const n = (v: number) => formatCount(Math.round(v));

export const multilingualPlayground = definePlayground<MultilingualState, MultilingualResult>({
  techniqueId: 'multiling',
  title: 'Kosh Bank’s support search (fictional bank)',
  controls: [
    { kind: 'select', key: 'model', label: 'Embedding model', options: [{ value: 'en', label: 'English-only, 384 dims' }, { value: 'multi', label: 'Multilingual, 1,024 dims' }] },
    { kind: 'toggle', key: 'transliterate', label: 'Normalise queries: NFC, then transliterate Roman Hindi to Devanagari' },
    { kind: 'select', key: 'index', label: 'Index', options: [{ value: 'en', label: 'English articles only' }, { value: 'enhi', label: 'English + Hindi translations' }] },
    { kind: 'toggle', key: 'perLanguage', label: 'Report recall for each language separately' },
    { kind: 'note', text: 'Recall@5 values are illustrative. Index size counts float32 vectors only. Embedding cost uses an illustrative ₹10 per million tokens.' },
  ],
  presets: {
    start: { state: { model: 'en', transliterate: false, index: 'en', perLanguage: false }, expected: { overall: 54.75, english: 88, hindi: 8, hinglish: 35, tokens: 72000000, costInr: 720 } },
    multi: { state: { model: 'multi', transliterate: false, index: 'en', perLanguage: true }, expected: { overall: 76.5, indexMb: 983.04 } },
    norm: { state: { model: 'multi', transliterate: true, index: 'en', perLanguage: true }, expected: { overall: 80, weakest: 72 } },
    full: { state: { model: 'multi', transliterate: true, index: 'enhi', perLanguage: true }, expected: { overall: 84.5, tokens: 187200000, costInr: 1872 } },
  },
  initialPreset: 'start',
  simulate: simulateMultilingual,
  outputs: [
    { kind: 'meter', label: 'Overall recall@5', value: (r) => r.overall / 100, detail: (r) => (r.perLanguage ? `= 0.5 × ${r.english}% + 0.25 × ${r.hindi}% + 0.25 × ${r.hinglish}% · ${r.overall.toFixed(1)}%` : `= ${r.overall.toFixed(1)}%`), emphasis: (r) => (r.overall < 80 ? 'warn' : 'normal') },
    { kind: 'badges', items: (r) => (!r.perLanguage ? [{ text: 'Per-language recall: hidden', emphasis: 'muted' as const }] : [{ text: `English ${r.english}%`, emphasis: r.english < 70 ? 'warn' : 'normal' }, { text: `Hindi ${r.hindi}%`, emphasis: r.hindi < 70 ? 'warn' : 'normal' }, { text: `Hinglish ${r.hinglish}%`, emphasis: r.hinglish < 70 ? 'warn' : 'normal' }]) },
    { kind: 'value', label: 'Index size', value: (r) => size(r.indexMb), detail: (r) => `= ${n(r.vectors)} vectors × ${n(r.dimensions)} dims × 4 B` },
    { kind: 'value', label: 'Tokens to embed the index', value: (r) => n(r.tokens), detail: (r) => `≈ ₹${n(r.costInr)}` },
  ],
  verdict: (r, s) => {
    const good = r.weakest >= 70 && r.overall >= 80;
    if (good) return { tone: 'ok', headline: 'Every language is served.', detail: `Every slice is at 70% or more and overall is ${r.overall.toFixed(1)}%.` };
    const detail = s.model === 'en' ? 'Switch to a multilingual model.' : !s.transliterate ? 'Normalise Hinglish before embedding.' : 'Hindi copies of the articles would lift Hindi and Hinglish further.';
    if (r.weakest < 30) return { tone: 'no', headline: s.perLanguage ? 'One language is barely served.' : 'The overall figure hides a failing language.', detail };
    return { tone: 'mid', headline: 'Close, but a slice is still weak.', detail };
  },
  narrate: (r, s) => [
    s.model === 'en' ? `The English-only model has almost no Hindi in its vocabulary, so only ${r.hindi}% of Hindi queries find the right article.` : `The multilingual model puts Hindi and English in one space, so a Hindi query finds the right article ${r.hindi}% of the time.`,
    s.transliterate ? `Transliteration turns Roman Hindi into Devanagari before embedding, and Hinglish recall is ${r.hinglish}%.` : `Hinglish is embedded as typed, with spellings like “aayega” and “ayega”, and recall is ${r.hinglish}%.`,
    `Overall recall@5 is ${r.overall.toFixed(1)}%${s.perLanguage ? '' : `, and with per-language results hidden nobody sees that the weakest slice is at ${r.weakest}%`}.`,
    `The index holds ${n(r.vectors)} vectors in ${size(r.indexMb)} and costs about ₹${n(r.costInr)} to embed${s.index === 'enhi' ? `; each Hindi chunk is about ${r.hindiChunkTokens} tokens because Devanagari splits into more tokens` : ''}.`,
  ].join(' '),
  missions: {
    hidden: ({ state, result }) => state.perLanguage && result.overall >= 50 && result.weakest < 15,
    lean: ({ state, result }) => state.index === 'en' && result.weakest >= 70,
    top: ({ result }) => result.overall >= 83,
  },
});
