import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateGraphRag, type GraphRagResult, type GraphRagState } from '../simulators/graphRag';

const isBest = (r: GraphRagResult) => r.overall >= 0.8 && r.indexRupees <= 20000 && r.per1000Rupees <= 1500;
const OPENING = {
  vector: 'Vector RAG finds single passages well but cannot see themes across 5,000 reports',
  local: 'Local search walks entity neighbours, so multi-hop joins work, but themes are still partial',
  global: 'Global search maps over community reports, so themes work, but every simple fact pays for map-reduce',
  route: 'The router sends each question to the cheapest path that can answer it',
} as const;

export const graphRagPlayground = definePlayground<GraphRagState, GraphRagResult>({
  techniqueId: 'graphrag',
  title: 'Question Sahayak Telecom’s reports',
  intro: 'Sahayak Telecom is fictional. 5,000 outage and complaint reports. Questions are simple facts, multi-hop joins (“which vendors are linked to Pune outages”) or themes across everything.',
  controls: [
    { kind: 'select', key: 'mode', label: 'Retrieval', options: [{ value: 'vector', label: 'Vector RAG only' }, { value: 'local', label: 'GraphRAG local search for all' }, { value: 'global', label: 'GraphRAG global search for all' }, { value: 'route', label: 'Router: facts to vector, multi-hop local, themes global' }] },
    { kind: 'steps', key: 'themeShare', label: 'Questions about themes', values: [0.1, 0.3, 0.6], format: (v) => formatWholePercent(v) },
    { kind: 'toggle', key: 'lazy', label: 'Lazy indexing: summarise at query time', isEnabled: (s) => s.mode !== 'vector' },
  ],
  presets: {
    start: { state: { mode: 'vector', themeShare: 0.3, lazy: false }, expected: { overall: 0.587, indexRupees: 300, per1000Rupees: 250 } },
    local: { state: { mode: 'local', themeShare: 0.3, lazy: false }, expected: { overall: 0.702, per1000Rupees: 600 } },
    global: { state: { mode: 'global', themeShare: 0.3, lazy: false }, expected: { overall: 0.646, per1000Rupees: 3000 } },
    route: { state: { mode: 'route', themeShare: 0.3, lazy: false }, expected: { overall: 0.815, indexRupees: 18000, per1000Rupees: 1370 } },
  },
  initialPreset: 'start',
  simulate: simulateGraphRag,
  outputs: [
    { kind: 'meter', label: 'Answer quality, all questions', value: (r) => r.overall, emphasis: (r) => (r.overall < 0.65 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Fact questions', value: (r) => r.facts },
    { kind: 'meter', label: 'Multi-hop questions', value: (r) => r.multiHop, emphasis: (r) => (r.multiHop < 0.6 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Theme questions', value: (r) => r.themes, emphasis: (r) => (r.themes < 0.6 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Indexing, once', value: (r) => `₹${formatCount(r.indexRupees)}` },
    { kind: 'value', label: 'Per 1,000 queries', value: (r) => `₹${formatCount(r.per1000Rupees)}`, emphasis: (r) => (r.per1000Rupees > 1500 ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (isBest(r)) return { tone: 'ok', headline: 'Right path for each question.', detail: 'Only the hard questions pay for the graph.' };
    if (r.overall < 0.65) return { tone: 'no', headline: 'Theme and multi-hop questions fail.', detail: 'Single chunks cannot answer questions about the whole corpus.' };
    if (r.per1000Rupees > 1500) return { tone: 'mid', headline: 'Good answers, costly queries.', detail: 'Route simple questions away from global search.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: 'Try routing by question type.' };
  },
  narrate: (r, s) => `${OPENING[s.mode]}. ${s.lazy && s.mode !== 'vector' ? 'Lazy indexing cuts the one-off cost with a small quality loss. ' : ''}Quality is ${formatWholePercent(r.overall)}; ₹${formatCount(r.per1000Rupees)} per 1,000 queries.`,
  missions: {
    best: ({ result }) => isBest(result),
    cheap: ({ state, result }) => state.mode === 'route' && state.lazy && result.overall >= 0.79 && result.indexRupees <= 2000,
    themes: ({ state, result }) => state.themeShare === 0.6 && result.themes >= 0.8,
  },
});
