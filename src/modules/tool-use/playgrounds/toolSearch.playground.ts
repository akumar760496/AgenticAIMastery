import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent, formatWholePercent } from '@/shared/format';
import { simulateToolSearch, type ToolSearchResult, type ToolSearchState } from '../simulators/toolSearch';

const inr = (v: number) => `₹${formatCount(Math.round(v))}`;
const base: ToolSearchState = { tools: 240, search: false, method: 'bm25', keep: 0, descriptions: 'full' };

export const toolSearchPlayground = definePlayground<ToolSearchState, ToolSearchResult>({
  techniqueId: 'toolsearch',
  title: 'Nivesh Setu back office · 100 client requests (fictional)',
  intro: 'Each request takes 3 model calls. A search adds about 1.2 seconds. Input tokens cost ₹250 per million.',
  controls: [
    { kind: 'steps', key: 'tools', label: 'Tools connected', values: Array.from({ length: 20 }, (_, i) => (i + 1) * 20), format: String },
    { kind: 'toggle', key: 'search', label: 'Defer tools behind a search tool' },
    { kind: 'select', key: 'method', label: 'Search method', options: [{ value: 'regex', label: 'Regex on names and descriptions' }, { value: 'bm25', label: 'BM25 keyword search' }, { value: 'embed', label: 'Your own embedding search' }] },
    { kind: 'steps', key: 'keep', label: 'Common tools kept loaded', values: Array.from({ length: 11 }, (_, i) => i), format: String },
    { kind: 'select', key: 'descriptions', label: 'Descriptions', options: [{ value: 'terse', label: 'Terse: “SIP ops” (about 70 tokens)' }, { value: 'full', label: 'Full: what, when, words users say (about 180)' }] },
  ],
  presets: {
    start: { state: base, expected: { definitionTokens: 43200, accuracy: 0.61, costPer1000: 33525 } },
    search: { state: { ...base, search: true }, expected: { tokensPerRequest: 9600, accuracy: 0.8652, addedS: 1.2 } },
    tuned: { state: { ...base, search: true, method: 'embed', keep: 5 }, expected: { accuracy: 0.9521, tokensPerRequest: 10503 } },
    terse: { state: { ...base, search: true, keep: 5, descriptions: 'terse' }, expected: { accuracy: 0.8667 } },
  },
  initialPreset: 'start',
  simulate: simulateToolSearch,
  outputs: [
    { kind: 'meter', label: 'Right tool chosen', value: (r) => r.accuracy, detail: (r) => `= ${formatPercent(r.accuracy, 1)}`, emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Definition tokens per call', value: (r) => formatCount(Math.round(r.definitionTokens)) },
    { kind: 'value', label: 'Input tokens per request', value: (r) => formatCount(Math.round(r.tokensPerRequest)) },
    { kind: 'value', label: 'Cost per 1,000 requests', value: (r) => inr(r.costPer1000) },
    { kind: 'value', label: 'Extra time from searching', value: (r) => `${r.addedS.toFixed(2)} s`, detail: (r) => `${formatWholePercent(1 - r.coverage)} of requests need a search` },
  ],
  verdict: (r, s) => {
    if (r.accuracy >= 0.92 && r.tokensPerRequest < 12000) return { tone: 'ok', headline: 'Finds the right tool, cheaply.', detail: 'Common tasks skip the search and the rest find their tool.' };
    const detail = !s.search && s.tools > 50 ? 'The list is too long to choose from well: defer tools behind a search.' : s.descriptions === 'terse' ? 'Terse descriptions give the search little to match.' : s.keep < 3 && s.search ? 'Keep the most common tools loaded so most requests skip the search.' : r.tokensPerRequest >= 12000 ? 'Definitions still cost a lot per call.' : 'Try a better search method.';
    return { tone: r.accuracy < 0.8 ? 'no' : 'mid', headline: r.accuracy < 0.8 ? 'Too many wrong tools.' : 'Works, with room to improve.', detail };
  },
  narrate: (r, s) => [
    s.search ? `With ${s.tools} tools deferred behind ${s.method === 'embed' ? 'an embedding' : s.method === 'bm25' ? 'a BM25' : 'a regex'} search, only ${formatCount(Math.round(r.definitionTokens))} definition tokens are sent per call.` : `All ${s.tools} tools are in the prompt on every call: ${formatCount(r.definitionTokens)} tokens of definitions${s.tools > 50 ? ', and so many similar tools blur together' : ''}.`,
    s.search ? `The ${s.keep} kept tools cover ${formatWholePercent(r.coverage)} of requests without any search; for the rest, the search puts the right tool in the top 5 ${formatWholePercent(r.recall)} of the time.` : '',
    `Overall the agent picks the right tool ${formatWholePercent(r.accuracy)} of the time, at ${inr(r.costPer1000)} per 1,000 requests.`,
  ].filter(Boolean).join(' '),
  missions: {
    scale: ({ state, result }) => state.tools >= 200 && state.search && result.accuracy >= 0.9,
    lean: ({ state, result }) => state.search && result.tokensPerRequest < 10000 && result.accuracy >= 0.9,
    fast: ({ state, result }) => state.search && state.keep >= 4 && result.addedS <= 0.6 && result.accuracy >= 0.92,
  },
});
