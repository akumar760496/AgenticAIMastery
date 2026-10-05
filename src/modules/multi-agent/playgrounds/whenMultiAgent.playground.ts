import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { WINDOW_K, simulateWhenMulti, type WhenMultiResult, type WhenMultiState } from '../simulators/whenMultiAgent';

const inr = (v: number) => `INR ${v.toFixed(1)}`;

export const whenMultiAgentPlayground = definePlayground<WhenMultiState, WhenMultiResult>({
  techniqueId: 'whenmulti',
  title: 'The job',
  intro: 'Each subtask takes 6 minutes. One agent uses about 4× the chat tokens, a team about 15×. Tokens cost INR 0.5 per 1,000; one context window holds 128k tokens; merging takes 1 minute.',
  controls: [
    { kind: 'steps', key: 'subtasks', label: 'Subtasks', values: Array.from({ length: 10 }, (_, i) => i + 1), format: String },
    { kind: 'steps', key: 'densityPct', label: 'Dependency density', values: Array.from({ length: 11 }, (_, i) => i * 10), format: (v) => `${v}%` },
    { kind: 'steps', key: 'tokensPerSubtaskK', label: 'Chat-equivalent tokens per subtask', values: Array.from({ length: 10 }, (_, i) => i + 1), format: (v) => `${v}k` },
    { kind: 'steps', key: 'inrPerMinute', label: 'Value of a minute saved', values: Array.from({ length: 51 }, (_, i) => i), format: (v) => `INR ${v}` },
  ],
  presets: {
    start: { state: { subtasks: 5, densityPct: 60, tokensPerSubtaskK: 2, inrPerMinute: 2 }, expected: { branches: 3, teamMinutes: 19, singleMinutes: 30, singleCostPerAnswer: 16, teamCostPerAnswer: 22.6, teamWins: false } },
    big: { state: { subtasks: 10, densityPct: 40, tokensPerSubtaskK: 8, inrPerMinute: 0 }, expected: { branches: 6, singleCoverage: 0.4, teamCoverage: 0.8, singleCostPerAnswer: 40, teamCostPerAnswer: 75 } },
    coupled: { state: { subtasks: 5, densityPct: 100, tokensPerSubtaskK: 4, inrPerMinute: 20 }, expected: { branches: 1, teamMinutes: 31 } },
    small: { state: { subtasks: 4, densityPct: 0, tokensPerSubtaskK: 1, inrPerMinute: 0 }, expected: { teamMinutes: 7, singleMinutes: 24, teamCostPerAnswer: 7.5, singleCostPerAnswer: 2 } },
  },
  initialPreset: 'start',
  simulate: simulateWhenMulti,
  outputs: [
    { kind: 'value', label: 'Parallel branches', value: (r) => String(r.branches), detail: (r) => `subtasks − chain of ${r.chain} + 1` },
    { kind: 'meter', label: 'Team wall time vs one agent', value: (r) => Math.min(1, r.timeRatio), detail: (r) => `= ${r.teamMinutes} min vs ${r.singleMinutes} min`, emphasis: (r) => (r.timeRatio >= 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Tokens: one agent · team', value: (r) => `${formatCount(r.singleTokensK)}k · ${formatCount(r.teamTokensK)}k` },
    { kind: 'meter', label: 'Subtasks one agent covers well', value: (r) => r.singleCoverage, detail: () => `${WINDOW_K}k window`, emphasis: (r) => (r.singleCoverage < 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Subtasks the team covers well', value: (r) => r.teamCoverage, emphasis: (r) => (r.teamCoverage < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Cost per useful answer: one · team', value: (r) => `${inr(r.singleCostPerAnswer)} · ${inr(r.teamCostPerAnswer)}` },
  ],
  verdict: (r) => (r.teamWins
    ? { tone: 'ok', headline: 'Split across agents.', detail: 'The time saved and extra coverage outweigh the extra tokens.' }
    : { tone: 'mid', headline: 'Stay with one agent.', detail: r.branches === 1 ? 'Everything is chained, so there is nothing to run in parallel.' : 'The extra tokens cost more than the time or coverage they buy.' }),
  narrate: (r, s) => [
    `${s.subtasks} subtasks with a chain of ${r.chain} leave ${r.branches} parallel branches.`,
    r.branches > 1 ? `A team finishes in ${r.teamMinutes} minutes instead of ${r.singleMinutes}, ${formatWholePercent(r.timeRatio)} of the time, but uses ${formatCount(r.teamTokensK)}k tokens instead of ${formatCount(r.singleTokensK)}k.` : 'With one branch a team only adds overhead: the chain still runs step by step.',
    r.singleCoverage < 1 ? `One agent’s context cannot hold all its working material, so it covers only ${formatWholePercent(r.singleCoverage)} of the subtasks well.` : '',
    `Per useful answer that is ${inr(r.singleCostPerAnswer)} for one agent and ${inr(r.teamCostPerAnswer)} for the team, so ${r.teamWins ? 'splitting pays' : 'one agent is the better choice'}.`,
  ].filter(Boolean).join(' '),
  missions: {
    wins: ({ result }) => result.teamWins,
    fast: ({ result }) => result.branches > 1 && result.timeRatio < 0.4,
    stay: ({ state, result }) => state.subtasks >= 6 && !result.teamWins,
  },
});
