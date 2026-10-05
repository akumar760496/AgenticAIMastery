import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatPercent, formatWholePercent } from '@/shared/format';
import { simulateDebate, type DebateResult, type DebateState } from '../simulators/debateVoting';

const pts = (v: number) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)} pts`;
const st = (agents: number, rounds: number, aggregation: DebateState['aggregation']): DebateState => ({ agents, rounds, accuracyPct: 70, correlationPct: 20, aggregation });

export const debateVotingPlayground = definePlayground<DebateState, DebateResult>({
  techniqueId: 'debate',
  title: 'Health-claim coverage checks',
  intro: 'Each call costs about 2k tokens. Correlation is the chance that all agents share one blind spot on a case, so they are all right or all wrong together.',
  controls: [
    { kind: 'steps', key: 'agents', label: 'Agents', values: [1, 2, 3, 4, 5], format: String },
    { kind: 'steps', key: 'rounds', label: 'Debate rounds', values: [0, 1, 2, 3], format: String },
    { kind: 'steps', key: 'accuracyPct', label: 'Accuracy of each agent', values: [50, 55, 60, 65, 70, 75, 80, 85, 90], format: (v) => `${v}%` },
    { kind: 'steps', key: 'correlationPct', label: 'Error correlation', values: Array.from({ length: 11 }, (_, i) => i * 10), format: (v) => `${v}%` },
    { kind: 'select', key: 'aggregation', label: 'Final answer', options: [{ value: 'last', label: 'The last agent to speak' }, { value: 'maj', label: 'Majority vote of the final round' }, { value: 'judge', label: 'A judge with a rubric' }] },
  ],
  presets: {
    start: { state: st(1, 0, 'maj'), expected: { accuracy: 0.7, calls: 1 } },
    vote: { state: st(3, 0, 'maj'), expected: { accuracy: 0.7672, calls: 3 } },
    debate: { state: st(3, 1, 'maj'), expected: { accuracy: 0.7821, calls: 6 } },
    last: { state: st(3, 2, 'last'), expected: { accuracy: 0.718, calls: 9 } },
  },
  initialPreset: 'start',
  simulate: simulateDebate,
  outputs: [
    { kind: 'meter', label: 'Final accuracy', value: (r) => r.accuracy, detail: (r) => `= ${formatPercent(r.accuracy, 1)}` },
    { kind: 'value', label: 'Gain over one agent', value: (r) => pts(r.gainOverSingle) },
    { kind: 'value', label: 'Gain over plain voting', value: (r) => pts(r.gainOverVote) },
    { kind: 'value', label: 'Model calls', value: (r) => String(r.calls), detail: (r) => `${r.calls * 2}k tokens` },
    { kind: 'value', label: 'Accuracy per 10k tokens', value: (r) => `${(r.per10kTokens * 100).toFixed(1)} pts` },
  ],
  verdict: (r, s) => {
    const tone = r.gainOverVote > 0.02 ? 'ok' : r.gainOverSingle >= 0.1 ? 'mid' : 'no';
    const headline = s.agents === 1 ? 'One agent, no check.' : r.gainOverVote > 0.02 ? 'Debate beats voting here.' : r.gainOverSingle > 0.02 ? 'Voting does most of the work.' : 'The ensemble adds almost nothing.';
    const detail = s.correlationPct >= 60 && s.agents > 1 ? 'The agents share blind spots, so they agree on the same mistakes.' : s.aggregation === 'last' && s.agents > 1 ? 'Taking the last speaker throws the group away.' : r.effectiveRounds > 0 && r.gainOverVote <= 0.02 ? 'The rounds cost more than they add.' : 'Accuracy, calls and correlation together decide the value.';
    return { tone, headline, detail };
  },
  narrate: (r, s) => [
    s.agents === 1 ? `A single agent is right ${s.accuracyPct}% of the time and nothing checks it.` : `${s.agents} agents, each right ${s.accuracyPct}% of the time, answer ${r.effectiveRounds ? `and debate for ${r.effectiveRounds} rounds, lifting each to about ${(r.perAgentAfterDebate * 100).toFixed(1)}%` : 'independently'}.`,
    s.agents > 1 ? (s.aggregation === 'last' ? 'The last speaker’s answer is taken, which ignores what the others concluded.' : s.aggregation === 'maj' ? 'The majority of the final round decides.' : 'A judge settles the answer and breaks ties.') : '',
    s.agents > 1 && s.correlationPct > 0 ? `On ${formatWholePercent(s.correlationPct / 100)} of cases they share a blind spot, where no vote or debate can help.` : '',
    `Final accuracy ${(r.accuracy * 100).toFixed(1)}% in ${r.calls} calls: ${pts(r.gainOverSingle)} over one agent and ${pts(r.gainOverVote)} over plain voting.`,
  ].filter(Boolean).join(' '),
  missions: {
    ten: ({ result }) => result.gainOverSingle >= 0.1 - 1e-9,
    beatvote: ({ result }) => result.gainOverVote > 0.02,
    corr: ({ state, result }) => state.agents >= 3 && result.effectiveRounds >= 1 && state.correlationPct >= 60 && state.aggregation !== 'last' && result.gainOverSingle < 0.02,
  },
});
