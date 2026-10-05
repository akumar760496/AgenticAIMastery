import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { WRITERS, simulateSharedState, type SharedStateResult, type SharedStateState } from '../simulators/sharedState';

export const sharedStatePlayground = definePlayground<SharedStateState, SharedStateResult>({
  techniqueId: 'sharedstate',
  title: 'Shipment-risk board',
  intro: 'Writers run in parallel and produce 4, 3, 5, 4, 3 and 5 findings of about 0.75k tokens each. Each agent then reads what it needs to decide.',
  controls: [
    { kind: 'select', key: 'mode', label: 'How agents share', options: [{ value: 'board', label: 'Shared board (typed state)' }, { value: 'chat', label: 'Free-text group chat' }, { value: 'typed', label: 'Typed messages to named agents' }] },
    { kind: 'steps', key: 'writers', label: 'Parallel writers', values: [2, 3, 4, 5, 6], format: (v) => `${v} (${WRITERS.slice(0, v).map((w) => w.name).join(', ')})` },
    { kind: 'select', key: 'reducer', label: 'Reducer for findings (board only)', options: [{ value: 'replace', label: 'None: each write replaces the list' }, { value: 'append', label: 'operator.add: append' }] },
    { kind: 'select', key: 'readScope', label: 'What each agent reads (board only)', options: [{ value: 'all', label: 'Everything on the board' }, { value: 'own', label: 'Only the fields it needs' }] },
    { kind: 'toggle', key: 'sourceFields', label: 'Every entry carries agent and source fields' },
  ],
  presets: {
    start: { state: { mode: 'board', writers: 3, reducer: 'replace', readScope: 'all', sourceFields: false }, expected: { lost: 7, total: 12, conflicts: 2, readK: 3.75, fullReadK: 9, provenance: 0.5 } },
    append: { state: { mode: 'board', writers: 4, reducer: 'append', readScope: 'all', sourceFields: false }, expected: { lost: 0, total: 16, readK: 12 } },
    chat: { state: { mode: 'chat', writers: 4, reducer: 'append', readScope: 'all', sourceFields: false }, expected: { lost: 3, readK: 19.2, conflicts: 2, provenance: 0.3 } },
    typed: { state: { mode: 'typed', writers: 3, reducer: 'append', readScope: 'own', sourceFields: false }, expected: { lost: 0, readK: 6, provenance: 0.6 } },
  },
  initialPreset: 'start',
  simulate: simulateSharedState,
  outputs: [
    { kind: 'value', label: 'Findings lost', value: (r) => `${r.lost} of ${r.total}`, emphasis: (r) => (r.lost ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Tokens each agent reads', value: (r) => (r.fullReadK ? Math.min(1, r.readK / r.fullReadK) : 0), detail: (r) => `= ${r.readK.toFixed(1)}k vs ${r.fullReadK.toFixed(1)}k for reading every finding once` },
    { kind: 'value', label: 'Write conflicts or contradictions', value: (r) => String(r.conflicts) },
    { kind: 'meter', label: 'Entries with provenance', value: (r) => r.provenance, emphasis: (r) => (r.provenance < 1 ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    const tone = r.lost === 0 && r.readK <= r.fullReadK * 0.5 + 1e-9 && r.provenance >= 1 ? 'ok' : r.lost ? 'no' : 'mid';
    const detail = s.mode === 'board' && s.reducer === 'replace' ? 'Add an append reducer (in LangGraph, same-step writes with no reducer raise InvalidUpdateError).' : s.mode === 'chat' ? 'Free text buries findings; use typed state or typed messages.' : r.readK > r.fullReadK * 0.5 + 1e-9 ? 'Scope reads to cut tokens.' : r.provenance < 1 ? 'Add source fields for audit.' : 'Typed, merged, scoped and sourced.';
    return { tone, headline: r.lost ? `${r.lost} findings lost.` : 'Nothing lost.', detail };
  },
  narrate: (r, s) => [
    `${s.writers} agents write ${r.total} findings in parallel.`,
    s.mode === 'board' ? (s.reducer === 'replace' ? `With no reducer each write replaces the list, so only the last writer’s ${r.lastWriterFindings} survive and ${r.lost} are lost.` : 'The append reducer merges every write, so all findings survive.')
      : s.mode === 'chat' ? `In free-text chat nothing is overwritten, but about ${r.lost} findings are buried in prose, and everyone reads the whole chat.` : 'Typed messages go to named recipients, so nothing is overwritten and each agent receives only what is addressed to it.',
    `Each agent reads ${r.readK.toFixed(1)}k tokens against ${r.fullReadK.toFixed(1)}k for everything. ${formatWholePercent(r.provenance)} of entries say who wrote them and from which source.`,
  ].join(' '),
  missions: {
    nolost: ({ state, result }) => state.writers >= 4 && result.lost === 0,
    half: ({ result }) => result.lost === 0 && result.readK <= result.fullReadK * 0.5 + 1e-9,
    prov: ({ state, result }) => state.mode === 'typed' && result.provenance >= 1,
  },
});
