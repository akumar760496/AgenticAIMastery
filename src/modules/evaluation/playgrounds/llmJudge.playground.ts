import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateLlmJudge, type LlmJudgeResult, type LlmJudgeState } from '../simulators/llmJudge';

const settings = (s: Partial<LlmJudgeState['settings']>): LlmJudgeState => ({
  settings: { showBFirst: true, positionBias: true, lengthEarnsNothing: false, runBothOrders: false, ...s },
});

const scoreDetail = (r: LlmJudgeResult, answer: 'A' | 'B'): string => {
  const parts = [`${answer === 'A' ? '0.8' : '0.4'} quality`];
  if (answer === 'B' && r.score.verbosityBonus) parts.push('0.5 verbosity');
  if (r.firstShown === answer && r.score.positionBonus) parts.push('0.3 position');
  return `= ${parts.join(' + ')}`;
};

export const llmJudgePlayground = definePlayground<LlmJudgeState, LlmJudgeResult>({
  techniqueId: 'llmjudge',
  title: 'Two answers to “Summarise claim CLM-004471”',
  intro: 'A: Kitchen water damage approved. Payout INR 42,000 (correct). B: a long, polite answer with a payout of INR 24,000 (wrong amount).',
  controls: [
    { kind: 'flagSet', key: 'settings', label: 'Judge settings', options: [
      { value: 'showBFirst', label: 'Show B first' },
      { value: 'positionBias', label: 'Judge has position bias' },
      { value: 'lengthEarnsNothing', label: 'Rubric rule: length earns nothing' },
      { value: 'runBothOrders', label: 'Run both orders; accept only consistent wins' },
    ] },
  ],
  presets: {
    naive: { state: settings({}), expected: { verdict: 'B' } },
    rubric: { state: settings({ lengthEarnsNothing: true }), expected: { verdict: 'A' } },
    prod: { state: settings({ lengthEarnsNothing: true, runBothOrders: true }), expected: { verdict: 'A' } },
    tie: { state: settings({ runBothOrders: true }), expected: { verdict: 'tie' } },
  },
  initialPreset: 'naive',
  simulate: simulateLlmJudge,
  outputs: [
    { kind: 'meter', label: 'Answer A score', value: (r) => r.score.a / 1.6, detail: (r) => `${r.score.a.toFixed(1)} ${scoreDetail(r, 'A')}` },
    { kind: 'meter', label: 'Answer B score', value: (r) => r.score.b / 1.6, detail: (r) => `${r.score.b.toFixed(1)} ${scoreDetail(r, 'B')}`, emphasis: () => 'warn' },
  ],
  verdict: (r) =>
    r.verdict === 'A' ? { tone: 'ok', headline: 'Judge picks A.', detail: 'Matches the human reviewer.' }
      : r.verdict === 'B' ? { tone: 'no', headline: 'Judge picks B.', detail: 'Wrong: it disagrees with the human reviewer.' }
      : { tone: 'mid', headline: 'Tie: the verdict changed with the order.', detail: 'Send this case to a person.' },
  narrate: (r, s) => {
    const parts = [`The judge reads ${r.firstShown} first. A scores ${r.score.a.toFixed(1)} (${scoreDetail(r, 'A').slice(2)}); B scores ${r.score.b.toFixed(1)} (${scoreDetail(r, 'B').slice(2)}).`];
    parts.push(r.score.verbosityBonus ? 'Without a rubric rule, the long answer earns a verbosity bonus even though its amount is wrong.' : 'The rubric rule removed the verbosity bonus, so length no longer helps B.');
    if (r.score.positionBonus) parts.push(`Position bias adds 0.3 to whichever answer is read first${r.firstShown === 'B' ? ', which helps B here' : ''}.`);
    if (s.settings.runBothOrders) parts.push(r.verdict === 'tie' ? 'Running both orders exposed that the verdict depends on order, so it is flagged as a tie instead of trusted.' : 'Running both orders gave the same winner, so the verdict can be trusted.');
    if (r.verdict === 'A') parts.push('Result: the judge agrees with the human.');
    if (r.verdict === 'B') parts.push('Result: a biased judge rewarded the wrong answer.');
    return parts.join(' ');
  },
  missions: {
    keepbias: ({ state, result }) => result.verdict === 'A' && state.settings.positionBias,
    tie: ({ result }) => result.verdict === 'tie',
    margin: ({ result }) => result.verdict === 'A' && result.marginForA >= 0.5 - 1e-9,
  },
});
