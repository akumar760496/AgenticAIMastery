import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { PATHS, simulateMemoryTools, type MemoryToolsResult, type MemoryToolsState } from '../simulators/memoryTools';

export const memoryToolsPlayground = definePlayground<MemoryToolsState, MemoryToolsResult>({
  techniqueId: 'memtools',
  title: 'ITR checklist for client 114: 30 items over up to 3 sessions',
  intro: 'A session fits 12 items (16 with context editing). Each item costs 10k tokens (7k with editing); start-up costs 40k without memory, 4k to view memory; each progress write costs 1k.',
  controls: [
    { kind: 'toggle', key: 'memoryTool', label: 'Memory tool (progress.md under /memories)' },
    { kind: 'toggle', key: 'contextEditing', label: 'Context editing: clear old tool results' },
    { kind: 'select', key: 'writeEvery', label: 'Write progress every', options: [{ value: '1', label: 'item' }, { value: '5', label: '5 items' }, { value: '10', label: '10 items' }, { value: '0', label: 'never' }] },
    { kind: 'select', key: 'pathCheck', label: 'Path check', options: [{ value: 'prefix', label: 'startswith("/memories")' }, { value: 'resolve', label: 'resolve, then check the root' }] },
    { kind: 'select', key: 'pathIndex', label: 'Path the agent sends', options: PATHS.map((p, i) => ({ value: String(i), label: p })) },
  ],
  presets: {
    start: { state: { memoryTool: false, contextEditing: false, writeEvery: 5, pathCheck: 'prefix', pathIndex: 1 }, expected: { totalK: 480, success: false, escaped: true } },
    mem10: { state: { memoryTool: true, contextEditing: false, writeEvery: 10, pathCheck: 'prefix', pathIndex: 1 }, expected: { totalK: 355, redone: 4, finishedInSession: 3 } },
    sparse: { state: { memoryTool: true, contextEditing: true, writeEvery: 10, pathCheck: 'resolve', pathIndex: 3 }, expected: { totalK: 309, redone: 12, blocked: true } },
    safe: { state: { memoryTool: true, contextEditing: false, writeEvery: 5, pathCheck: 'resolve', pathIndex: 2 }, expected: { totalK: 358, redone: 4, allowed: true } },
  },
  initialPreset: 'start',
  simulate: simulateMemoryTools,
  outputs: [
    { kind: 'value', label: 'Tokens per session', value: (r) => r.sessionTokensK.map((v) => `${v}k`).join(' · '), detail: (r) => `${r.totalK}k in total` },
    { kind: 'value', label: 'Items done', value: (r) => `${r.done} of 30`, emphasis: (r) => (r.success ? 'normal' : 'warn') },
    { kind: 'value', label: 'Items redone', value: (r) => String(r.redone), emphasis: (r) => (r.redone ? 'warn' : 'normal') },
    { kind: 'value', label: 'Path resolves to', value: (r) => r.resolved, detail: (r) => (r.escaped ? 'allowed, but outside /memories' : r.blocked ? 'refused' : 'allowed, inside /memories') },
  ],
  verdict: (r) => {
    if (r.escaped) return { tone: 'no', headline: 'Escaped the memory root.', detail: 'startswith passed a path that resolves outside /memories.' };
    if (!r.success) return { tone: 'no', headline: 'The checklist never finishes.', detail: 'Save progress so each session resumes where the last stopped.' };
    if (r.redone) return { tone: 'mid', headline: 'Finished, with items redone.', detail: 'Write progress more often.' };
    return { tone: 'ok', headline: 'Resumed cleanly and stayed inside the root.', detail: 'Frequent progress writes and a resolve-then-check path guard.' };
  },
  narrate: (r, s) => [
    s.memoryTool ? `With the memory tool the agent views progress.md first and resumes from ${s.writeEvery ? 'the last saved checkpoint' : 'item 1, because nothing was ever written'}.` : 'Without memory every session starts from item 1 and re-reads the client’s documents, so the checklist never gets past item 12.',
    `The three sessions use ${r.sessionTokensK.map((v) => `${v}k`).join(', ')} tokens: ${r.totalK}k in total${r.redone ? `, and ${r.redone} items were done twice` : ''}.`,
    s.contextEditing ? 'Context editing clears old tool results, so each session fits more items.' : '',
    `The path ${r.path} resolves to ${r.resolved}; ${r.escaped ? 'the startswith check let it through, which is a traversal.' : r.blocked ? 'the check refused it.' : 'it stays inside the memory root.'}`,
  ].filter(Boolean).join(' '),
  missions: {
    resume: ({ state, result }) => state.memoryTool && result.success && result.redone === 0,
    block: ({ state, result }) => state.pathIndex === 1 && result.blocked,
    lean: ({ result }) => result.success && result.totalK < 240,
  },
});
