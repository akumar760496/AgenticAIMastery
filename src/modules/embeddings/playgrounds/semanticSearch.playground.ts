import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, joinWithAnd, pluralise } from '@/shared/format';
import { QUERIES, simulateSemanticSearch, type HelpQuery, type SemanticSearchResult, type SemanticSearchState } from '../simulators/semanticSearch';

const st = (query: HelpQuery, k: number, mismatchedModel = false): SemanticSearchState => ({ query, k, minSimilarity: 0, mismatchedModel });

export const semanticSearchPlayground = definePlayground<SemanticSearchState, SemanticSearchResult>({
  techniqueId: 'semantic',
  title: 'Search the help centre',
  controls: [
    { kind: 'select', key: 'query', label: 'Customer question', options: (Object.keys(QUERIES) as HelpQuery[]).map((k) => ({ value: k, label: QUERIES[k].text })) },
    { kind: 'steps', key: 'k', label: 'Results returned (k)', values: [1, 2, 3, 4, 5], format: String },
    { kind: 'steps', key: 'minSimilarity', label: 'Minimum similarity', values: Array.from({ length: 17 }, (_, i) => Math.round(i * 5) / 100), format: (v) => v.toFixed(2) },
    { kind: 'toggle', key: 'mismatchedModel', label: 'Embed the query with a different model than the documents' },
  ],
  presets: {
    start: { state: st('refund', 2), expected: { recall: 2 / 3, precision: 1 } },
    strict: { state: st('login', 5), expected: { recall: 1, precision: 0.6 } },
    code: { state: st('code', 3), expected: { recall: 0 } },
    mismatch: { state: st('refund', 2, true), expected: { recall: 0, precision: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateSemanticSearch,
  outputs: [
    { kind: 'meter', label: 'Recall@k', value: (r) => r.recall, detail: (r) => `= ${r.relevantReturned} relevant returned ÷ ${r.relevantReturned + r.missed.length} relevant`, emphasis: (r) => (r.recall < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Precision@k', value: (r) => r.precision, detail: (r) => `= ${r.relevantReturned} relevant ÷ ${r.returned} returned`, emphasis: (r) => (r.precision < 1 ? 'warn' : 'normal') },
    { kind: 'check', label: 'Top result relevant', value: (r) => r.topRelevant },
    { kind: 'itemList', title: 'Ranked by cosine similarity', items: (r) => r.ranked.map((a, i) => ({ label: `${i + 1}`, text: `${a.article.id} · ${a.article.title}`, status: a.score.toFixed(2), tone: a.returned ? (a.relevant ? 'ok' : 'mid') : 'human', detail: `${a.relevant ? 'relevant' : 'not relevant'}${a.returned ? ' · returned' : ''}`, flagged: a.relevant && !a.returned })) },
  ],
  verdict: (r, s) => ({
    tone: r.recall === 1 && r.precision === 1 ? 'ok' : r.recall > 0 ? 'mid' : 'no',
    headline: r.recall === 1 && r.precision === 1 ? 'Every relevant article, nothing else.' : r.recall === 0 ? 'No relevant article returned.' : 'Partly right.',
    detail: s.mismatchedModel ? 'Query and document vectors come from different models, so the scores are noise.' : s.query === 'code' ? 'A bare code carries little meaning for a dense model.' : 'Scores are cosine similarities from one embedding model.',
  }),
  narrate: (r, s) => {
    const q = QUERIES[s.query];
    const parts = [`For ${q.text}, the search returns ${r.returned} ${pluralise(r.returned, 'article')}: ${r.relevantReturned} of the ${q.relevant.length} relevant (recall ${formatWholePercent(r.recall)}), precision ${formatWholePercent(r.precision)}.`];
    if (s.mismatchedModel) parts.push('The query was embedded by a different model, so its vector lives in another space: the similarities are meaningless, even though both vectors have the same length.');
    else if (s.query === 'code') parts.push('The right article, D8, scores only 0.37: an error code has almost no meaning for a dense model, which is why exact codes need BM25 alongside vectors.');
    else if (s.query === 'refund') parts.push('The refund articles score highest although none contains the words “money back”: that is semantic matching.');
    if (r.missed.length && !s.mismatchedModel) parts.push(`${joinWithAnd(r.missed)} ${r.missed.length > 1 ? 'were' : 'was'} left out by k or the similarity floor.`);
    return parts.join(' ');
  },
  missions: {
    full: ({ state: s, result }) => s.query === 'refund' && !s.mismatchedModel && result.recall === 1 && s.k <= 3,
    strict: ({ state: s, result }) => s.query === 'login' && !s.mismatchedModel && s.k === 5 && result.precision === 1 && result.recall === 1,
    mismatch: ({ state: s, result }) => s.mismatchedModel && s.k >= 3 && result.recall === 0,
  },
});
