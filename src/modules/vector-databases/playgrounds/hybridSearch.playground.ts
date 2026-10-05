import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { pluralise } from '@/shared/format';
import { WIKI_PAGES, WIKI_QUERIES, simulateHybrid, type FusionMethod, type HybridResult, type HybridState, type WikiQuery } from '../simulators/hybridSearch';

const st = (query: WikiQuery, method: FusionMethod, filter: HybridState['filter'] = 'none'): HybridState => ({ query, method, rrfK: 60, alpha: 0.5, filter });
const METHOD_LABEL: Readonly<Record<FusionMethod, string>> = { dense: 'Dense only', sparse: 'Sparse (BM25) only', rrf: 'Reciprocal Rank Fusion', weighted: 'Weighted (min–max normalised)' };
const TENANT_LABEL = { eng: 'Engineering', fin: 'Finance', hr: 'HR' } as const;

export const hybridSearchPlayground = definePlayground<HybridState, HybridResult>({
  techniqueId: 'hybrid',
  title: 'IT wiki search, user in the Engineering tenant',
  controls: [
    { kind: 'select', key: 'query', label: 'Query', options: (Object.keys(WIKI_QUERIES) as WikiQuery[]).map((k) => ({ value: k, label: `${WIKI_QUERIES[k].text} (${WIKI_QUERIES[k].style})` })) },
    { kind: 'select', key: 'method', label: 'Fusion', options: (Object.keys(METHOD_LABEL) as FusionMethod[]).map((k) => ({ value: k, label: METHOD_LABEL[k] })) },
    { kind: 'steps', key: 'rrfK', label: 'RRF constant k (RRF only)', values: Array.from({ length: 100 }, (_, i) => i + 1), format: String },
    { kind: 'steps', key: 'alpha', label: 'α, weight on dense (weighted only)', values: Array.from({ length: 11 }, (_, i) => i / 10), format: (v) => v.toFixed(1) },
    { kind: 'select', key: 'filter', label: 'Permissions', options: [{ value: 'none', label: 'No tenant filter' }, { value: 'post', label: 'Filter after ranking' }, { value: 'pre', label: 'Filter before ranking' }] },
    { kind: 'note', text: '11 wiki pages; D6 and D8 belong to Finance and D11 to HR. Scores are fixed so each method’s behaviour is visible.' },
  ],
  presets: {
    start: { state: st('q1', 'dense'), expected: { relevantRank: 5, hits: 2, leaks: 1 } },
    rrf: { state: st('q1', 'rrf'), expected: { relevantRank: 2, hits: 3, leaks: 1 } },
    sparse: { state: st('q2', 'sparse'), expected: { relevantRank: 4, leaks: 2 } },
    post: { state: st('q1', 'rrf', 'post'), expected: { leaks: 0, shown: 4 } },
  },
  initialPreset: 'start',
  simulate: simulateHybrid,
  outputs: [
    { kind: 'itemList', title: 'Top 5 returned', items: (r) => r.top.map((t, i) => {
      const [title, tenant] = WIKI_PAGES[t.id] ?? ['', 'eng'];
      return { label: `${i + 1}. ${t.id}`, text: `${title}${tenant !== 'eng' ? ` (${TENANT_LABEL[tenant]})` : ''}`, status: t.score < 1 ? t.score.toFixed(t.score < 0.1 ? 4 : 2) : t.score.toFixed(1), tone: tenant !== 'eng' ? 'no' : 'ok', flagged: tenant !== 'eng' };
    }) },
    { kind: 'value', label: 'Rank of the right page', value: (r) => (r.relevantRank ? `#${r.relevantRank}` : 'not found') },
    { kind: 'value', label: 'Right page in top 3, all queries', value: (r) => `${r.hits} of 3`, detail: (r) => r.ranksAllQueries.map((x, i) => `q${i + 1} #${x}`).join(' · ') },
    { kind: 'value', label: 'Results shown', value: (r) => `${r.shown} of 5`, emphasis: (r) => (r.shown < 5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Pages the user may not see', value: (r) => String(r.leaks), emphasis: (r) => (r.leaks ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (r.leaks) return { tone: 'no', headline: 'Permission leak.', detail: `${r.leaks} ${pluralise(r.leaks, 'result')} from another tenant.` };
    if (r.hits === 3 && r.shown === 5) return { tone: 'ok', headline: 'Relevant and allowed.', detail: 'Every query finds its page in the top 3 with a full page of allowed results.' };
    if (r.shown < 5) return { tone: 'mid', headline: 'Short page.', detail: 'Filtering after ranking removed results and left gaps.' };
    return { tone: 'mid', headline: 'Misses a query type.', detail: 'At least one query style ranks the right page below 3rd.' };
  },
  narrate: (r, s) => {
    const why: Readonly<Record<FusionMethod, string>> = {
      dense: 'Dense search matches meaning, so it blurs exact codes such as “809”.',
      sparse: 'BM25 matches exact words, so it misses pages that say the same thing in different words.',
      rrf: `RRF adds 1 ÷ (${s.rrfK} + rank) from each list, so pages found by both methods rise without comparing raw scores.`,
      weighted: `Weighted fusion normalises each list to 0–1 and adds ${s.alpha.toFixed(1)} × dense + ${(1 - s.alpha).toFixed(1)} × sparse; the right α depends on the query mix.`,
    };
    const q = WIKI_QUERIES[s.query];
    return [
      `For “${q.text}”, ${METHOD_LABEL[s.method].toLowerCase()} puts the right page, ${q.relevant}, at #${r.relevantRank}.`, why[s.method],
      `Across the three queries the right page is in the top 3 for ${r.hits}.`,
      s.filter === 'none' ? (r.leaks ? `Without a filter, ${r.leaks} Finance or HR ${pluralise(r.leaks, 'page')} reached this engineer’s results.` : '') : s.filter === 'post' ? `Filtering after ranking removed ${5 - r.shown}, leaving a short page.` : 'Filtering before ranking keeps every candidate allowed and still fills the page.',
    ].filter(Boolean).join(' ');
  },
  missions: {
    all3: ({ result }) => result.hits === 3,
    alpha: ({ state, result }) => state.method === 'weighted' && result.hits === 2,
    perm: ({ state, result }) => state.filter === 'pre' && result.shown === 5 && result.leaks === 0 && result.hits === 3,
  },
});
