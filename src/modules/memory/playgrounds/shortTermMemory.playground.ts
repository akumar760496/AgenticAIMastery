import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { SHORT_TERM_START, simulateShortTerm, type ShortTermResult, type ShortTermState } from '../simulators/shortTermMemory';

const tokens = (k: number) => (k >= 1000 ? `${(k / 1000).toFixed(2).replace(/\.?0+$/, '')}M` : `${Math.round(k)}k`);

export const shortTermMemoryPlayground = definePlayground<ShortTermState, ShortTermResult>({
  techniqueId: 'stm',
  title: 'A loan-restructuring call: 1k of talk plus one tool result per turn',
  intro: 'The window is 200k. Five early facts: loan account, agreed EMI, NEFT mandate, restructuring date, co-borrower name. A keep-IDs summary survives three compactions; after that, summaries of summaries drift.',
  controls: [
    { kind: 'steps', key: 'turns', label: 'Turns', values: Array.from({ length: 12 }, (_, i) => (i + 1) * 10), format: String },
    { kind: 'steps', key: 'resultK', label: 'Tokens per tool result', values: Array.from({ length: 11 }, (_, i) => 1 + i * 0.5), format: (v) => `${v}k` },
    { kind: 'select', key: 'clearAbove', label: 'Clear tool results above', options: [{ value: '0', label: 'never' }, { value: '60', label: '60k' }, { value: '100', label: '100k' }] },
    { kind: 'steps', key: 'keepLast', label: 'Keep the last N results', values: [1, 2, 3, 4, 5, 6], format: String },
    { kind: 'select', key: 'compaction', label: 'Compaction at 80k', options: [{ value: '0', label: 'off' }, { value: '1', label: 'generic summary' }, { value: '2', label: 'keep IDs and amounts' }] },
  ],
  presets: {
    start: { state: SHORT_TERM_START, expected: { truncated: true, totalK: 19829, factsLeft: 0 } },
    clear: { state: { ...SHORT_TERM_START, clearAbove: 60 }, expected: { factsLeft: 5, totalK: 9371, peakK: 134.5, clears: 85 } },
    generic: { state: { ...SHORT_TERM_START, compaction: 1 }, expected: { compactions: 7, peakK: 77.5, totalK: 5428.5, factsLeft: 0 } },
    ids: { state: { ...SHORT_TERM_START, compaction: 2 }, expected: { compactions: 7, factsLeft: 1 } },
  },
  initialPreset: 'start',
  simulate: simulateShortTerm,
  outputs: [
    { kind: 'meter', label: 'Peak context (of the 200k window)', value: (r) => r.peakK / 200, detail: (r) => `= ${Math.round(r.peakK * 10) / 10}k`, emphasis: (r) => (r.peakK >= 100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Input tokens over the session', value: (r) => tokens(r.totalK), detail: (r) => `${formatWholePercent(r.reduction)} less than the start` },
    { kind: 'value', label: 'Early facts still answerable', value: (r) => `${r.factsLeft} of 5`, emphasis: (r) => (r.factsLeft < 5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Compactions · clears', value: (r) => `${r.compactions} · ${r.clears}`, detail: (r) => (r.rewrites > 20 ? 'so many rewrites keep invalidating the prompt cache' : '') },
  ],
  verdict: (r) => {
    if (r.truncated) return { tone: 'no', headline: 'The session hit the window.', detail: 'The oldest messages, including the task, were cut.' };
    if (r.factsLeft < 5) return { tone: 'no', headline: 'The summary lost facts.', detail: 'Exact values did not survive compaction.' };
    return r.peakK < 100 ? { tone: 'ok', headline: 'Bounded and intact.', detail: 'Context stays under 100k with every early fact.' } : { tone: 'mid', headline: 'Intact, but the context keeps growing.', detail: 'Clearing alone cannot stop the talk itself from growing.' };
  },
  narrate: (r, s) => [
    `Over ${s.turns} turns the context peaked at ${Math.round(r.peakK)}k and the session sent ${tokens(r.totalK)} input tokens in total.`,
    r.truncated ? 'Without management it passed the 200k window, so the oldest messages, including the task and early facts, were cut.' : '',
    r.clears ? `Tool results were cleared ${r.clears} times, keeping the last ${s.keepLast}; low risk, but the talk itself still grows about 1k a turn.` : '',
    r.compactions ? `Compaction ran ${r.compactions} times; ${s.compaction === 1 ? 'a generic summary paraphrased exact values' : 'a summary told to keep IDs and amounts was used'}, leaving ${r.factsLeft} of 5 early facts answerable.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    peak: ({ state, result }) => state.turns === 120 && result.peakK < 100,
    total: ({ state, result }) => state.turns === 120 && result.reduction >= 0.6,
    both: ({ state, result }) => state.turns === 120 && result.peakK < 100 && result.reduction >= 0.6 && result.factsLeft === 5,
  },
});
