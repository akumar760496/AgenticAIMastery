import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { MULTI_HOP_SHARES, simulateGraphMemory, type GraphMemoryResult, type GraphMemoryState, type GraphStore } from '../simulators/graphMemory';

const STORE_STORY: Readonly<Record<GraphStore, string>> = {
  vector: 'Facts are stored as separate sentences and found by similarity, so a question like “the nominee on the account opened after the move” rarely finds both facts.',
  graph: 'A graph links customers, accounts and nominees, so chained questions follow the edges.',
  temporal: 'A temporal graph links the facts and dates every link, so the agent knows which nominee is current.',
};

export const graphMemoryPlayground = definePlayground<GraphMemoryState, GraphMemoryResult>({
  techniqueId: 'graphmem',
  title: 'Kaveri Bank’s relationship-manager memory (fictional)',
  intro: 'Three years of notes: 5,000 facts, 18% since superseded.',
  controls: [
    { kind: 'select', key: 'store', label: 'Memory store', options: [{ value: 'vector', label: 'Vector store of fact sentences' }, { value: 'graph', label: 'Knowledge graph, no time' }, { value: 'temporal', label: 'Temporal knowledge graph' }] },
    { kind: 'toggle', key: 'closeSuperseded', label: 'Close superseded facts with an end date' },
    { kind: 'steps', key: 'multiHopShare', label: 'Questions that chain facts', values: MULTI_HOP_SHARES, format: formatWholePercent },
  ],
  presets: {
    start: { state: { store: 'vector', closeSuperseded: false, multiHopShare: 0.3 }, expected: { accuracy: 0.681, multiHop: 0.45, stalePer100: 16, costPer1000Facts: 75 } },
    inval: { state: { store: 'vector', closeSuperseded: true, multiHopShare: 0.3 }, expected: { accuracy: 0.765, stalePer100: 4 } },
    graph: { state: { store: 'graph', closeSuperseded: true, multiHopShare: 0.3 }, expected: { accuracy: 0.864, multiHop: 0.78, costPer1000Facts: 300 } },
    temporal: { state: { store: 'temporal', closeSuperseded: true, multiHopShare: 0.3 }, expected: { accuracy: 0.92, stalePer100: 1, latencyMs: 220 } },
  },
  initialPreset: 'start',
  simulate: simulateGraphMemory,
  outputs: [
    { kind: 'meter', label: 'Answers correct', value: (r) => r.accuracy, emphasis: (r) => (r.accuracy < 0.85 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Single-fact questions', value: (r) => r.simple },
    { kind: 'meter', label: 'Chained questions', value: (r) => r.multiHop, emphasis: (r) => (r.multiHop < 0.6 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Stale facts per 100 questions', value: (r) => String(r.stalePer100), emphasis: (r) => (r.stalePer100 > 2 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost · latency', value: (r) => `₹${r.costPer1000Facts} per 1,000 facts · ${r.latencyMs} ms` },
  ],
  verdict: (r) => {
    if (r.accuracy >= 0.9 && r.stalePer100 <= 2) return { tone: 'ok', headline: 'Current and connected.', detail: 'Dated links answer chained questions with current facts.' };
    if (r.multiHop < 0.6) return { tone: 'no', headline: 'Chained questions fail.', detail: 'Separate fact sentences cannot be joined by similarity alone.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: r.stalePer100 > 2 ? 'Close superseded facts with an end date.' : 'A temporal graph would cut stale answers further.' };
  },
  narrate: (r, s) => `${STORE_STORY[s.store]} ${s.closeSuperseded ? 'Superseded facts are closed with an end date.' : 'Old and new facts sit side by side with no dates, so stale answers keep appearing.'} Overall ${formatWholePercent(r.accuracy)} of answers are correct.`,
  missions: {
    best: ({ result }) => result.accuracy >= 0.9 && result.stalePer100 <= 2,
    multi: ({ state }) => state.multiHopShare === 0.5 && state.store === 'vector',
    cheap: ({ result }) => result.accuracy >= 0.85 && result.costPer1000Facts <= 300,
  },
});
