import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, pluralise } from '@/shared/format';
import { REQUESTS, simulateQueryPlanning, type QueryPlanningResult, type QueryPlanningState } from '../simulators/queryPlanning';

const isCorrect = (r: QueryPlanningResult) => r.precision === 1 && r.returned === 10;
const off: QueryPlanningState = { request: 'r1', extract: true, validate: false, giveDate: false, retry: false };
const requiresPlan = (s: QueryPlanningState) => s.extract;

export const queryPlanningPlayground = definePlayground<QueryPlanningState, QueryPlanningResult>({
  techniqueId: 'qoa',
  title: 'Plan a shopper’s search',
  intro: 'A 96-laptop catalogue. The planner is scripted: it writes “60k” as 60, and assumes “this year” is 2024 unless told the date. LLM call ≈ 700 ms, search ≈ 40 ms.',
  controls: [
    { kind: 'select', key: 'request', label: 'Shopper’s request', options: Object.entries(REQUESTS).map(([value, r]) => ({ value, label: r.text })) },
    { kind: 'toggle', key: 'extract', label: 'Extract filters into a plan (otherwise plain vector search)' },
    { kind: 'toggle', key: 'validate', label: 'Validate the plan in code before searching', isEnabled: requiresPlan },
    { kind: 'toggle', key: 'giveDate', label: 'Tell the agent today’s date', isEnabled: requiresPlan },
    { kind: 'toggle', key: 'retry', label: 'Self-check: re-plan once if fewer than 3 results', isEnabled: requiresPlan },
  ],
  presets: {
    start: { state: { ...off, extract: false }, expected: { returned: 10, correct: 1 } },
    agent: { state: off, expected: { returned: 0, llmCalls: 1 } },
    guarded: { state: { ...off, request: 'r2', validate: true, retry: true }, expected: { returned: 10, correct: 0, silentlyWrong: true } },
    full: { state: { ...off, validate: true, giveDate: true, retry: true }, expected: { correct: 10, llmCalls: 2, searches: 1, latencyMs: 1440, allRequestsCorrect: true } },
  },
  initialPreset: 'start',
  simulate: simulateQueryPlanning,
  outputs: [
    { kind: 'code', label: 'Plan sent to the database', value: (r) => (r.plan ? JSON.stringify(r.plan) : '(none: the raw request is embedded and searched)') },
    { kind: 'value', label: 'Results returned', value: (r) => String(r.returned) },
    { kind: 'meter', label: 'Precision', value: (r) => r.precision, detail: (r) => `= ${r.correct} meeting every constraint ÷ ${r.returned} returned`, emphasis: (r) => (r.precision < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'LLM calls · searches', value: (r) => `${r.llmCalls} · ${r.searches}` },
    { kind: 'value', label: 'Added latency', value: (r) => `${formatCount(r.latencyMs)} ms` },
    { kind: 'check', label: 'All three requests fully correct', value: (r) => r.allRequestsCorrect },
  ],
  verdict: (r) => (isCorrect(r)
    ? { tone: 'ok', headline: 'Correct results.', detail: 'Every result meets the request.' }
    : r.silentlyWrong ? { tone: 'no', headline: 'Silently wrong.', detail: 'The plan was valid and returned results, but a filter was wrong, so no check fired.' }
      : r.returned === 0 ? { tone: 'mid', headline: 'Nothing found.', detail: 'The plan was run as written and matched nothing.' }
        : { tone: 'mid', headline: 'Constraints ignored.', detail: 'Plain vector search treats price, year and brand as vague meaning.' }),
  narrate: (r, s) => {
    const spec = REQUESTS[s.request];
    if (!s.extract) return `Request: “${spec.text}”. Without a plan, the whole sentence is embedded, so price, year and brand only nudge similarity: ${r.correct} of ${r.returned} results meet them.`;
    return [
      `Request: “${spec.text}”. The agent turns it into a plan${spec.mistake ? `, but this planner ${spec.mistake}` : ''}.`,
      ...r.notes,
      r.silentlyWrong ? 'The results look fine, so neither validation nor the self-check notices; only giving the model the date fixes it.' : '',
      `${r.correct} of ${r.returned} results meet every constraint, after ${r.llmCalls} LLM ${pluralise(r.llmCalls, 'call')} and ${r.searches} ${pluralise(r.searches, 'search', 'searches')} (about ${formatCount(r.latencyMs)} ms).`,
    ].filter(Boolean).join(' ');
  },
  missions: {
    fix1: ({ state, result }) => state.request === 'r1' && isCorrect(result) && result.searches === 1,
    silent: ({ state, result }) => state.request === 'r2' && result.precision === 1,
    all: ({ result }) => result.allRequestsCorrect,
  },
});
