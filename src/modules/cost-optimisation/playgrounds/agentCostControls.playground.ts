import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { PLATFORM_STEP_CAP, STEPS_NEEDED, simulateAgentCostControls, type AgentCostControlsResult, type AgentCostControlsState } from '../simulators/agentCostControls';

const k = (n: number) => `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k`;
const st = (stepBudget: number, on: boolean): AgentCostControlsState => ({ stepBudget, pruneTools: on, trimResults: on, conciseOutput: on });
const noControls = (s: AgentCostControlsState) => s.stepBudget >= PLATFORM_STEP_CAP && !s.pruneTools && !s.trimResults && !s.conciseOutput;

export const agentCostControlsPlayground = definePlayground<AgentCostControlsState, AgentCostControlsResult>({
  techniqueId: 'controls',
  title: 'A KYC document agent',
  controls: [
    { kind: 'note', text: 'A task needs 5 steps. Some runs get stuck re-reading pages and loop until something stops them. $3 per million input tokens, $15 per million output tokens.' },
    { kind: 'steps', key: 'stepBudget', label: 'Step budget', values: Array.from({ length: 13 }, (_, i) => i + 3), format: (v) => (v >= PLATFORM_STEP_CAP ? 'none (platform stop at 15)' : `${v} steps`) },
    { kind: 'toggle', key: 'pruneTools', label: 'Load only the 3 KYC tools, not all 14' },
    { kind: 'toggle', key: 'trimResults', label: 'Trim tool results to the needed fields' },
    { kind: 'toggle', key: 'conciseOutput', label: 'Cap output: max_tokens 400 and JSON replies' },
  ],
  presets: {
    start: { state: st(15, false), expected: { averageCostUsd: 0.729, completion: 0.7 } },
    budget: { state: st(10, false), expected: { averageCostUsd: 0.466, completion: 0.7 } },
    all: { state: st(6, true), expected: { averageCostUsd: 0.086, completion: 0.95 } },
    tight: { state: st(4, true), expected: { averageCostUsd: 0.063, completion: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateAgentCostControls,
  outputs: [
    { kind: 'meter', label: 'Cost per task vs no controls', value: (r) => r.relativeCost, detail: (r) => `= $${r.averageCostUsd.toFixed(3)} on average`, emphasis: (r) => (r.relativeCost > 0.5 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Tasks completed', value: (r) => r.completion, detail: (r) => (r.completion === 0 ? '= 0%: the budget stops every run before step 5' : `= ${formatWholePercent(1 - r.loopRate)} finish in 5 steps; ${formatWholePercent(r.loopRate)} loop`), emphasis: (r) => (r.completion < 0.9 ? 'warn' : 'normal') },
    { kind: 'badges', items: (r) => r.typicalStepTokens.map((t, i) => ({ text: `typical step ${i + 1}: ${k(t)}`, emphasis: r.completion === 0 ? 'warn' : 'normal' })) },
    { kind: 'badges', items: (r) => r.loopingStepTokens.map((t, i) => ({ text: `loop step ${i + 1}: ${k(t)}`, emphasis: i >= STEPS_NEEDED ? 'warn' : 'normal' })) },
    { kind: 'value', label: 'Tokens per typical task', value: (r) => k(r.typicalTokens) },
  ],
  verdict: (r, s) => {
    if (noControls(s)) return { tone: 'no', headline: 'No controls yet.', detail: 'Same cost as the uncontrolled agent: set a step budget or switch on a control.' };
    if (r.completion < 0.5) return { tone: 'no', headline: 'The budget is too tight.', detail: 'Every run stops before the work is finished.' };
    if (r.completion >= 0.9 && r.saving >= 0.8) return { tone: 'ok', headline: 'Bounded and lean.', detail: 'Loops are rare, steps are small and the budget caps the rest.' };
    return { tone: 'mid', headline: 'Better, but not done.', detail: 'Combine the controls: each one shrinks a different part of the bill.' };
  },
  narrate: (r, s) => {
    const parts = [`A typical run takes ${r.typicalSteps} steps and ${k(r.typicalTokens)} tokens; each step is larger than the last because results and replies pile up in the context.`];
    parts.push(s.stepBudget < STEPS_NEEDED ? `A budget of ${s.stepBudget} stops every run before the 5 steps the task needs, so nothing completes.` : `${formatWholePercent(r.loopRate)} of runs loop${s.stepBudget < PLATFORM_STEP_CAP ? ` and are stopped at ${s.stepBudget} steps` : ' until the platform stops them at 15 steps'}.`);
    if (s.trimResults) parts.push('Trimmed results also confuse the agent less, so loops drop from 30% to 5% of runs.');
    parts.push(Math.abs(r.saving) < 0.005 ? 'Average cost per task is about the same as the uncontrolled agent.' : `Average cost per task is ${formatWholePercent(r.saving)} below the uncontrolled agent.`);
    return parts.join(' ');
  },
  missions: {
    budgetonly: ({ state: s, result }) => !s.pruneTools && !s.trimResults && !s.conciseOutput && result.saving >= 0.4 && result.completion >= 0.69,
    tightest: ({ state: s, result }) => s.stepBudget === STEPS_NEEDED && result.completion >= 0.9,
    toolsonly: ({ state: s, result }) => s.pruneTools && !s.trimResults && !s.conciseOutput && s.stepBudget === PLATFORM_STEP_CAP && result.saving > 0.1,
  },
});
