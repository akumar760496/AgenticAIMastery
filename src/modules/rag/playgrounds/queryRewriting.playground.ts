import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, pluralise } from '@/shared/format';
import { LATENCY_BUDGET_MS, simulateQueryRewriting, type QueryRewritingResult, type QueryRewritingState } from '../simulators/queryRewriting';

const rankText = (n: number) => (n > 100 ? '> 100' : String(n));

export const queryRewritingPlayground = definePlayground<QueryRewritingState, QueryRewritingResult>({
  techniqueId: 'llm',
  title: 'Answer the user’s follow-up',
  intro: 'The user asks: “and what about the other one, the balanced fund?” The answer is in one passage: “Balanced Advantage Fund: exit load 1% if redeemed within 12 months.” Only the top 5 passages reach the prompt.',
  controls: [
    { kind: 'toggle', key: 'rewrite', label: 'Rewrite the follow-up with an LLM (+350 ms, 1 LLM call)' },
    { kind: 'toggle', key: 'multiQuery', label: 'Multi-query: 3 extra phrasings (+400 ms LLM call, +20 ms searches)' },
    { kind: 'toggle', key: 'rerank', label: 'Re-rank candidates with a cross-encoder (+20 ms + 2 ms per candidate)' },
    { kind: 'steps', key: 'candidates', label: 'Candidates retrieved', values: [5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], format: (v) => String(v) },
  ],
  presets: {
    start: { state: { rewrite: false, multiQuery: false, rerank: false, candidates: 10 }, expected: { firstRank: 140, found: false, latencyMs: 40 } },
    norerank: { state: { rewrite: true, multiQuery: false, rerank: false, candidates: 50 }, expected: { firstRank: 23, hit: false, latencyMs: 390 } },
    mq: { state: { rewrite: false, multiQuery: true, rerank: false, candidates: 50 }, expected: { firstRank: 41, hit: false, latencyMs: 460 } },
    all: { state: { rewrite: true, multiQuery: true, rerank: true, candidates: 100 }, expected: { finalRank: 2, hit: true, latencyMs: 1030 } },
  },
  initialPreset: 'start',
  simulate: simulateQueryRewriting,
  outputs: [
    { kind: 'code', label: 'Search query', value: (r) => r.query },
    { kind: 'value', label: 'First-stage rank of the right passage', value: (r) => rankText(r.firstRank) },
    { kind: 'check', label: 'In the candidate pool', value: (r) => r.found },
    { kind: 'value', label: 'Final rank', value: (r) => (r.finalRank === null ? 'not retrieved' : String(r.finalRank)), emphasis: (r) => (r.hit ? 'normal' : 'warn') },
    { kind: 'value', label: 'Latency', value: (r) => `${formatCount(r.latencyMs)} ms`, detail: () => `budget ${LATENCY_BUDGET_MS} ms`, emphasis: (r) => (r.latencyMs > LATENCY_BUDGET_MS ? 'warn' : 'normal') },
    { kind: 'value', label: 'LLM calls per query', value: (r) => String(r.llmCalls) },
  ],
  verdict: (r) => (r.hit && r.latencyMs <= LATENCY_BUDGET_MS
    ? { tone: 'ok', headline: 'Right passage reaches the prompt, within budget.', detail: 'Rewrite where needed, re-rank a modest pool.' }
    : r.hit ? { tone: 'mid', headline: 'Right passage reaches the prompt, but too slowly.', detail: 'Drop a step or score fewer candidates.' }
      : { tone: 'no', headline: 'The right passage does not reach the prompt.', detail: !r.found ? 'Retrieval never found it.' : 'It was retrieved but ranked below 5.' }),
  narrate: (r, s) => [
    s.rewrite ? 'The LLM turned the follow-up into “exit load Balanced Advantage Fund” using the chat history.' : 'The raw follow-up names no fund and no fee, so search has almost nothing to match.',
    s.multiQuery ? 'Extra phrasings catch documents that say “redemption charge” instead of “exit load”.' : '',
    `First-stage retrieval puts the right passage at rank ${r.firstRank > 100 ? 'beyond 100' : r.firstRank}, ${r.found ? 'inside' : 'outside'} the pool of ${s.candidates}.`,
    !r.found && s.rerank ? 'Re-ranking can only reorder what was retrieved, so it cannot rescue this passage.' : '',
    r.found && s.rerank ? 'The cross-encoder reads the query and each passage together and moves it to rank 2.' : '',
    r.found && !s.rerank && !r.hit ? 'Without re-ranking it stays below the top 5 and never reaches the prompt.' : '',
    `The pipeline takes ${formatCount(r.latencyMs)} ms with ${r.llmCalls} LLM ${pluralise(r.llmCalls, 'call')}${r.latencyMs > LATENCY_BUDGET_MS ? `, over the ${LATENCY_BUDGET_MS} ms budget` : ''}.`,
  ].filter(Boolean).join(' '),
  missions: {
    hit: ({ result }) => result.hit && result.latencyMs <= LATENCY_BUDGET_MS,
    blind: ({ state, result }) => state.rerank && !result.found,
    lean: ({ result }) => result.hit && result.latencyMs < 500,
  },
});
