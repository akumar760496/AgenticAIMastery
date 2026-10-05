import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateReranking, type RerankingResult, type RerankingState } from '../simulators/reranking';

const isGood = (r: RerankingResult, s: RerankingState) => r.recall >= 0.85 && r.hinglish >= 0.8 && r.latencyMs <= 500 && s.threshold;

export const rerankingPlayground = definePlayground<RerankingState, RerankingResult>({
  techniqueId: 'rerank',
  title: 'Re-rank Vyapar Mart’s help centre',
  intro: 'Vyapar Mart is a fictional marketplace. 8,000 seller help articles. 200 test questions: 140 in English, 60 in Hinglish, and 20 more with no answer in the help centre. Hybrid search takes 40 ms; the latency budget is 500 ms.',
  controls: [
    { kind: 'select', key: 'reranker', label: 'Re-ranker', options: [{ value: 'none', label: 'None: keep the search order' }, { value: 'en', label: 'English cross-encoder (1.5 ms a candidate)' }, { value: 'multi', label: 'Multilingual cross-encoder (2.5 ms a candidate)' }, { value: 'llm', label: 'LLM re-ranker (900 ms + 8 ms a candidate)' }] },
    { kind: 'steps', key: 'scored', label: 'Candidates scored', values: [10, 20, 50, 100, 200], format: (v) => String(v) },
    { kind: 'steps', key: 'kept', label: 'Passages kept for the prompt', values: [3, 5, 10], format: (v) => String(v) },
    { kind: 'toggle', key: 'threshold', label: 'Drop passages scoring under 0.20 and say “not found” if none are left' },
  ],
  presets: {
    start: { state: { reranker: 'none', scored: 50, kept: 5, threshold: false }, expected: { recall: 0.5626, latencyMs: 40 } },
    english: { state: { reranker: 'en', scored: 50, kept: 5, threshold: false }, expected: { recall: 0.7749, hinglish: 0.63, latencyMs: 115 } },
    multi: { state: { reranker: 'multi', scored: 100, kept: 5, threshold: true }, expected: { recall: 0.85275, latencyMs: 290, declined: 16 } },
    llm: { state: { reranker: 'llm', scored: 100, kept: 5, threshold: true }, expected: { recall: 0.87405, latencyMs: 1740 } },
  },
  initialPreset: 'start',
  simulate: simulateReranking,
  outputs: [
    { kind: 'meter', label: 'Right article in the prompt', value: (r) => r.recall, emphasis: (r) => (r.recall < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'English questions', value: (r) => r.english, detail: () => '140 questions' },
    { kind: 'meter', label: 'Hinglish questions', value: (r) => r.hinglish, detail: () => '60 questions', emphasis: (r) => (r.hinglish < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Latency', value: (r) => `${formatCount(r.latencyMs)} ms`, emphasis: (r) => (r.latencyMs > 500 ? 'warn' : 'normal') },
    { kind: 'value', label: 'No-answer questions declined', value: (r) => `${r.declined} of 20` },
  ],
  verdict: (r, s) => {
    if (isGood(r, s)) return { tone: 'ok', headline: 'The right article is on top, in time.', detail: 'Wide retrieval, a multilingual re-ranker and a threshold.' };
    const tone = r.recall < 0.7 ? 'no' : 'mid';
    if (r.latencyMs > 500) return { tone, headline: 'Too slow.', detail: 'Score fewer candidates or use a cross-encoder.' };
    if (s.reranker === 'none') return { tone, headline: 'The search order is not good enough.', detail: 'Add a re-ranker.' };
    if (r.hinglish < 0.8) return { tone, headline: 'Hinglish questions lose out.', detail: 'Use a multilingual re-ranker.' };
    if (!s.threshold) return { tone, headline: 'It never says “not found”.', detail: 'Add the score threshold.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Score more candidates.' };
  },
  narrate: (r, s) => [
    `Hybrid search puts the right article somewhere in the top ${s.scored} for ${formatWholePercent(r.poolRecall)} of questions.`,
    s.reranker === 'none' ? `Without re-ranking, the first-stage order is kept and only ${formatWholePercent(r.recall)} have it in the top ${s.kept}.` : `After re-ranking, ${formatWholePercent(r.recall)} have it in the top ${s.kept} (Hinglish ${formatWholePercent(r.hinglish)}).`,
    s.scored <= 10 && s.reranker !== 'none' ? 'It cannot rescue articles the first stage never retrieved.' : '',
    r.declined ? 'The threshold lets the bot decline 16 of the 20 questions the help centre cannot answer.' : 'With no threshold, every question gets an answer, even the 20 with none in the help centre.',
    `Total latency is ${formatCount(r.latencyMs)} ms.`,
  ].filter(Boolean).join(' '),
  missions: {
    good: ({ state, result }) => isGood(result, state),
    shallow: ({ state }) => state.reranker !== 'none' && state.scored === 10,
    hinglish: ({ state, result }) => state.reranker === 'en' && result.hinglish < 0.75,
  },
});
