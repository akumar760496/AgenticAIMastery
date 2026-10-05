import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { BUDGET, simulateLatencyBudget, type LatencyBudgetResult, type LatencyBudgetState } from '../simulators/latencyBudget';

const sec = (ms: number) => `${(ms / 1000).toFixed(2).replace(/0$/, '')} s`;
const inBudget = (r: LatencyBudgetResult) => r.wordsOk && r.totalOk && r.degradedOk;

export const latencyBudgetPlayground = definePlayground<LatencyBudgetState, LatencyBudgetResult>({
  techniqueId: 'latbudget',
  title: 'Tejas Trade: “Why did my order fail?” (fictional broker)',
  intro: '10,000 questions a day. Budget at p95: first words ≤ 3 s, total ≤ 5.5 s, and no more than 10% of answers degraded by a fallback.',
  controls: [
    { kind: 'select', key: 'intent', label: 'Intent step', options: [{ value: 'large', label: 'Separate call, large model (600 / 900 ms)' }, { value: 'small', label: 'Separate call, small fast model (250 / 350 ms)' }, { value: 'merged', label: 'Merged into the answer call (+100 ms there)' }] },
    { kind: 'toggle', key: 'parallelTools', label: 'Run the three tool calls in parallel' },
    { kind: 'select', key: 'screen', label: 'On screen while waiting', options: [{ value: 'off', label: 'Spinner, then the full answer' }, { value: 'tokens', label: 'Stream answer tokens' }, { value: 'status', label: 'Status line at once, then stream tokens' }] },
    { kind: 'select', key: 'logTimeout', label: 'Exchange-log timeout', options: [{ value: '0', label: 'None (p95 2,400 ms)' }, { value: '1500', label: '1,500 ms (8% fall back)' }, { value: '1000', label: '1,000 ms (20% fall back)' }] },
    { kind: 'note', text: 'Stages, p50 / p95 in ms: order status 300 / 400, margin check 450 / 600, exchange log 800 / 2,400, retrieval 150 / 200 (runs after the tools), answer call 2,400 / 3,200 with its first token at 500 / 800.' },
  ],
  presets: {
    start: { state: { intent: 'large', parallelTools: false, screen: 'off', logTimeout: 0 }, expected: { total50: 4700, total95: 7700, abandonPct: 14.8 } },
    stream: { state: { intent: 'large', parallelTools: false, screen: 'tokens', logTimeout: 0 }, expected: { words50: 2800, words95: 5300, abandonPct: 7.2 } },
    budget: { state: { intent: 'merged', parallelTools: true, screen: 'status', logTimeout: 1500 }, expected: { words50: 1550, words95: 2600, total50: 3450, total95: 5000, abandonPct: 1.1, degradedShare: 0.08 } },
    tight: { state: { intent: 'merged', parallelTools: true, screen: 'status', logTimeout: 1000 }, expected: { total95: 4500, degradedShare: 0.2 } },
  },
  initialPreset: 'start',
  simulate: simulateLatencyBudget,
  outputs: [
    { kind: 'value', label: 'First visible text', value: (r) => `${sec(r.visible50)} · p95 ${sec(r.visible95)}` },
    { kind: 'value', label: 'First answer words', value: (r) => `${sec(r.words50)} · p95 ${sec(r.words95)}`, detail: (r) => `budget ≤ 3 s at p95 ${r.wordsOk ? '✓' : '✗'}`, emphasis: (r) => (r.wordsOk ? 'normal' : 'warn') },
    { kind: 'value', label: 'Total', value: (r) => `${sec(r.total50)} · p95 ${sec(r.total95)}`, detail: (r) => `budget ≤ 5.5 s at p95 ${r.totalOk ? '✓' : '✗'} · tools ${formatCount(r.tools50)} / ${formatCount(r.tools95)} ms`, emphasis: (r) => (r.totalOk ? 'normal' : 'warn') },
    { kind: 'meter', label: 'Users who give up', value: (r) => r.abandonPct / 100, detail: (r) => `≈ ${formatCount(r.abandonedPerDay)} of 10,000 a day`, emphasis: (r) => (r.abandonPct > 5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Answers degraded by the fallback', value: (r) => `${formatCount(r.degradedPerDay)} a day (${formatWholePercent(r.degradedShare)})`, emphasis: (r) => (r.degradedOk ? 'normal' : 'warn') },
  ],
  verdict: (r, s) => {
    if (inBudget(r)) return { tone: 'ok', headline: 'Inside the budget.', detail: 'A status line at once, words within 3 s and the full answer within 5.5 s for 95 of every 100 requests.' };
    if (!r.degradedOk) return { tone: 'no', headline: 'Fast, but too many thin answers.', detail: 'The timeout sends a fifth of users an answer without the exchange’s reason. Loosen it.' };
    const detail = s.screen === 'off' ? 'Nothing appears until the whole answer is ready. Stream it.' : !s.parallelTools ? 'The three tools still wait for each other.' : s.logTimeout === 0 ? 'The exchange log’s slow tail sets the p95. Cap it with a timeout.' : 'An extra LLM hop is still on the critical path.';
    if (!r.wordsOk && !r.totalOk) return { tone: 'no', headline: 'Over budget on both counts.', detail };
    return { tone: 'mid', headline: !r.wordsOk ? 'The first words come too late.' : 'The total is too long at p95.', detail };
  },
  narrate: (r, s) => [
    s.intent === 'merged' ? 'There is no separate intent call; the answer call reads the question and costs about 100 ms more.' : `A ${s.intent} model first classifies the question.`,
    `The three tools run ${s.parallelTools ? 'together, as long as the slowest' : 'one after another'}: ${formatCount(r.tools50)} ms at p50 and ${formatCount(r.tools95)} ms at p95.`,
    s.logTimeout ? `The exchange log is cut at ${formatCount(s.logTimeout)} ms, so ${formatWholePercent(r.degradedShare)} of answers (${formatCount(r.degradedPerDay)} a day) explain the failure without the exchange’s own reason.` : 'The exchange log may take 2,400 ms at p95, and nothing caps it.',
    s.screen === 'off' ? `The user watches a spinner for ${sec(r.total50)} at p50 and ${sec(r.total95)} at p95.` : `Words start at ${sec(r.words50)} and the answer finishes at ${sec(r.total50)} (p50).`,
    `About ${formatCount(r.abandonedPerDay)} of 10,000 users a day give up before the answer.`,
  ].join(' '),
  missions: {
    budget: ({ result }) => result.words95 <= BUDGET.firstWordsP95 && result.total95 <= BUDGET.totalP95 && result.degradedShare <= BUDGET.degradedShare,
    feel: ({ result }) => result.abandonPct <= 4 && result.total50 >= 4500,
    tight: ({ result }) => result.total95 < 5000 && result.degradedShare > BUDGET.degradedShare,
  },
});
