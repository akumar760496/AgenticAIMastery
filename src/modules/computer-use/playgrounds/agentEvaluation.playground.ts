import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatWholePercent } from '@/shared/format';
import { simulateAgentEvaluation, type AgentEvaluationResult, type AgentEvaluationState } from '../simulators/agentEvaluation';

const base: AgentEvaluationState = { evidence: 'mock', tasks: 100, runs: 1, adversarial: false };

export const agentEvaluationPlayground = definePlayground<AgentEvaluationState, AgentEvaluationResult>({
  techniqueId: 'agenteval',
  title: 'Will the vendor’s agent work on our loans?',
  intro: 'Hidden truth: in production it completes 78% of tasks on one run. Your evaluation estimates that number.',
  controls: [
    { kind: 'select', key: 'evidence', label: 'Evidence', options: [{ value: 'board', label: 'Public benchmark score' }, { value: 'mock', label: 'Static page snapshots' }, { value: 'staging', label: 'Staging replica of our systems' }, { value: 'shadow', label: 'Production shadow (read-only)' }] },
    { kind: 'select', key: 'tasks', label: 'Tasks', options: [{ value: '20', label: '20' }, { value: '100', label: '100' }, { value: '400', label: '400' }] },
    { kind: 'select', key: 'runs', label: 'Runs per task', options: [{ value: '1', label: '1' }, { value: '3', label: '3' }, { value: '5', label: '5' }] },
    { kind: 'toggle', key: 'adversarial', label: 'Include pages with injected instructions' },
  ],
  presets: {
    start: { state: { ...base, evidence: 'board', tasks: 20 }, expected: { estimate: 0.85, gapPoints: 7 } },
    mock: { state: base, expected: { estimate: 0.92, margin: 5.3173 } },
    staging: { state: { ...base, evidence: 'staging' }, expected: { estimate: 0.79, margin: 7.9832 } },
    shadow: { state: { ...base, evidence: 'shadow' }, expected: { estimate: 0.78, margin: 8.1192 } },
  },
  initialPreset: 'start',
  simulate: simulateAgentEvaluation,
  outputs: [
    { kind: 'value', label: 'Your estimate (one run)', value: (r) => `${formatWholePercent(r.estimate)}${r.margin === null ? '' : ` ± ${formatFixed(r.margin, 1)}`}`, emphasis: (r) => (r.gapPoints >= 5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Off from the truth', value: (r) => `${formatFixed(r.gapPoints, 0)} points` },
    { kind: 'value', label: 'Succeeds on every run', value: (r) => (r.estimateAllRuns === null ? 'not measured' : formatWholePercent(r.estimateAllRuns)) },
    { kind: 'check', label: 'Tested against injected pages', value: (r) => r.adversarialTested },
  ],
  verdict: (r, s) => {
    const board = s.evidence === 'board';
    if (r.gapPoints <= 2 && !board && s.tasks >= 400) return { tone: 'ok', headline: 'An honest estimate.', detail: 'Your tasks, your environment and enough of them.' };
    if (r.gapPoints >= 5) return { tone: 'no', headline: 'Too optimistic.', detail: board ? 'A public benchmark measures other tasks in other environments.' : 'Static snapshots skip logins, pop-ups and slow pages.' };
    return { tone: 'mid', headline: 'Close, but uncertain.', detail: 'More tasks narrow the interval.' };
  },
  narrate: (r, s) => [
    s.evidence === 'board' ? `The public benchmark suggests ${formatWholePercent(r.estimate)}, ${formatFixed(r.gapPoints, 0)} points above what the agent really does on your loans.`
      : `On ${s.tasks} tasks the estimate is ${formatWholePercent(r.estimate)} ± ${formatFixed(r.margin ?? 0, 1)} against a true 78%.`,
    s.runs > 1 && r.estimateAllRuns !== null ? `Asked to succeed on all ${s.runs} runs, it manages only about ${formatWholePercent(r.estimateAllRuns)}.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    honest: ({ state, result }) => state.evidence !== 'board' && state.tasks >= 400 && result.gapPoints <= 2,
    reliable: ({ state }) => state.evidence !== 'board' && state.runs >= 3,
    adversarial: ({ state, result }) => result.adversarialTested && state.tasks >= 100,
  },
});
