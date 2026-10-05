import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, joinWithAnd, pluralise } from '@/shared/format';
import { CONTEXT_LIMIT, UNPRUNED_TOKENS, simulateContextPruning, type ContextPruningResult, type ContextPruningState } from '../simulators/contextPruning';

const k = (n: number) => `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
const base: ContextPruningState = { mode: 'none', windowTurns: 6, thresholdTokens: 16000, detail: 'brief', clearExtracts: false };

export const contextPruningPlayground = definePlayground<ContextPruningState, ContextPruningResult>({
  techniqueId: 'pruning',
  title: 'A 20-turn advisor session',
  controls: [
    { kind: 'note', text: 'Each turn adds 900 tokens of conversation and a 1,000-token statement extract. At turn 20 the client asks a question that needs two early facts.' },
    { kind: 'select', key: 'mode', label: 'Strategy', options: [{ value: 'none', label: 'No pruning' }, { value: 'window', label: 'Sliding window: keep last N turns' }, { value: 'summarize', label: 'Summarize above a threshold' }] },
    { kind: 'steps', key: 'windowTurns', label: 'Window size N (sliding window)', values: Array.from({ length: 19 }, (_, i) => i + 2), format: (v) => `${v} turns` },
    { kind: 'steps', key: 'thresholdTokens', label: 'Threshold (summarize)', values: Array.from({ length: 13 }, (_, i) => 8000 + i * 2000), format: (v) => `${k(v)} tokens` },
    { kind: 'select', key: 'detail', label: 'Summary style', options: [{ value: 'brief', label: 'Brief: 300 tokens, keeps preferences' }, { value: 'detailed', label: 'Detailed: 1,200 tokens, keeps figures too' }] },
    { kind: 'toggle', key: 'clearExtracts', label: 'Clear statement extracts after their figures are recorded' },
  ],
  presets: {
    start: { state: base, expected: { paidTokens: 441000, peakContext: 40000, answerCorrect: true } },
    brief: { state: { ...base, mode: 'summarize' }, expected: { paidTokens: 263400, answerCorrect: false } },
    clear: { state: { ...base, clearExtracts: true }, expected: { paidTokens: 251000, peakContext: 21000, answerCorrect: true } },
  },
  initialPreset: 'start',
  simulate: simulateContextPruning,
  outputs: [
    { kind: 'meter', label: 'Input tokens vs no pruning', value: (r) => Math.min(1, r.relativeTokens), detail: (r) => `= ${k(r.paidTokens)} vs ${k(UNPRUNED_TOKENS)} over turns 0–20${r.summaryInputTokens ? `, incl. ${k(r.summaryInputTokens)} read by summary calls` : ''}`, emphasis: (r) => (r.relativeTokens > 0.8 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Peak context', value: (r) => r.peakContext / CONTEXT_LIMIT, detail: (r) => `= ${k(r.peakContext)} tokens at the largest turn` },
    { kind: 'value', label: 'Summaries written', value: (r) => String(r.summaries) },
    { kind: 'check', label: 'Turn 2: “prefers debt funds”', value: (r) => r.keepsPreference },
    { kind: 'check', label: 'Turn 5: “FD balance INR 4.2 lakh”', value: (r) => r.keepsFigure },
  ],
  verdict: (r) => (!r.answerCorrect
    ? { tone: 'no', headline: 'The turn-20 answer is wrong.', detail: 'A fact it needs has been pruned away.' }
    : { tone: r.saving >= 0.5 ? 'ok' : 'mid', headline: 'The turn-20 answer is correct.', detail: r.saving >= 0.5 ? `And you pay ${formatWholePercent(r.saving)} less for input.` : r.saving <= -0.005 ? `But input costs ${formatWholePercent(-r.saving)} more than no pruning.` : r.saving < 0.005 ? 'But nothing is saved on input yet.' : `Input savings: ${formatWholePercent(r.saving)}. There is room to prune harder.` }),
  narrate: (r, s) => {
    const parts = [s.mode === 'none' ? `Nothing is pruned, so the context grows to ${k(r.peakContext)} tokens and every turn pays again for everything before it.` : s.mode === 'window' ? `Only the last ${s.windowTurns} turns are sent, so context peaks at ${k(r.peakContext)} tokens.` : `Whenever context passes ${k(s.thresholdTokens)}, all but the last 4 turns become a ${s.detail} summary; that happened ${r.summaries} ${pluralise(r.summaries, 'time')}, and the summary calls read ${k(r.summaryInputTokens)} tokens themselves.`];
    if (s.clearExtracts) parts.push('Old statement extracts are cleared once used, removing 1,000 tokens per turn from the history.');
    parts.push(`Total input paid is ${k(r.paidTokens)}, ${r.saving >= 0 ? `${formatWholePercent(r.saving)} less` : `${formatWholePercent(-r.saving)} more`} than no pruning.`);
    const lost = [!r.keepsPreference && 'the turn-2 preference', !r.keepsFigure && 'the turn-5 FD balance'].filter((x): x is string => Boolean(x));
    parts.push(lost.length ? `But ${joinWithAnd(lost)} ${lost.length > 1 ? 'are' : 'is'} gone, so the answer at turn 20 is wrong.` : 'Both facts the final question needs are still available.');
    return parts.join(' ');
  },
  missions: {
    half: ({ result }) => result.saving >= 0.5 && result.answerCorrect,
    forget: ({ state, result }) => state.mode === 'window' && !result.answerCorrect,
    lean: ({ result }) => result.peakContext <= 10000 && result.answerCorrect,
  },
});
