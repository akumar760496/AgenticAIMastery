import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { EXPLORE_STEPS, simulateProcedural, type ProceduralResult, type ProceduralState } from '../simulators/proceduralMemory';

export const proceduralMemoryPlayground = definePlayground<ProceduralState, ProceduralResult>({
  techniqueId: 'procmem',
  title: 'Skill library: add_api_endpoint, 4 steps',
  intro: 'This week’s 10 tasks, each with a similarity score to the saved skill. Exploring a task from scratch takes 9 steps; each step costs about 3k tokens.',
  controls: [
    { kind: 'toggle', key: 'library', label: 'Use the saved skill' },
    { kind: 'toggle', key: 'refactored', label: 'The codebase was refactored after the skill was saved' },
    { kind: 'toggle', key: 'check', label: 'Skill ends with a check (make test)' },
    { kind: 'steps', key: 'thresholdPct', label: 'Retrieval threshold', values: Array.from({ length: 56 }, (_, i) => 40 + i), format: (v) => (v / 100).toFixed(2) },
  ],
  presets: {
    start: { state: { library: true, thresholdPct: 60, refactored: false, check: true }, expected: { reused: 6, wrong: 2, averageSteps: 6.6, tokensK: 198, correctShare: 1 } },
    tuned: { state: { library: true, thresholdPct: 70, refactored: false, check: true }, expected: { reused: 6, wrong: 1, averageSteps: 6.3, tokensK: 189 } },
    strict: { state: { library: true, thresholdPct: 90, refactored: false, check: true }, expected: { reused: 1, missed: 5, averageSteps: 8.5 } },
    stale: { state: { library: true, thresholdPct: 75, refactored: true, check: false }, expected: { reused: 5, averageSteps: 6.5, correctShare: 0.5 } },
  },
  initialPreset: 'start',
  simulate: simulateProcedural,
  outputs: [
    { kind: 'itemList', title: 'This week’s 10 tasks', items: (r) => r.outcomes.map((o) => ({ label: o.similarity.toFixed(2), text: o.name, detail: o.note, status: `${o.steps} steps`, tone: !o.correct ? 'no' : o.steps > EXPLORE_STEPS ? 'mid' : 'ok', flagged: !o.correct })) },
    { kind: 'meter', label: 'Steps per task vs exploring', value: (r) => Math.min(1, r.averageSteps / EXPLORE_STEPS), detail: (r) => `= ${r.averageSteps.toFixed(1)} (exploring: 9.0)`, emphasis: (r) => (r.averageSteps >= EXPLORE_STEPS ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Tasks done correctly', value: (r) => r.correctShare, emphasis: (r) => (r.correctShare < 1 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Tokens for the 10 tasks', value: (r) => `${r.tokensK}k`, detail: () => 'exploring everything: 270k' },
    { kind: 'value', label: 'Reused · wrong · missed', value: (r) => `${r.reused} · ${r.wrong} · ${r.missed}` },
  ],
  verdict: (r) => {
    if (r.silent) return { tone: 'no', headline: `${r.silent} broken change${r.silent > 1 ? 's' : ''} shipped silently.`, detail: 'Without a check, a stale or wrong procedure looks like success.' };
    return r.averageSteps < EXPLORE_STEPS ? { tone: 'ok', headline: `Saving ${(EXPLORE_STEPS - r.averageSteps).toFixed(1)} steps per task.`, detail: 'Every reuse was verified by the skill’s check.' } : { tone: 'mid', headline: 'No saving over exploring.', detail: 'Lower the threshold or enable the skill.' };
  },
  narrate: (r, s) => [
    s.library ? `At threshold ${(s.thresholdPct / 100).toFixed(2)} the agent loads the skill for ${r.reused + r.wrong} of 10 tasks: ${r.reused} really are endpoint tasks and ${r.wrong} are not.` : 'With no skill library every task is explored from scratch in 9 steps.',
    r.missed ? `${r.missed} endpoint tasks fell below the threshold and were explored from scratch.` : '',
    r.wrong ? 'Each wrong retrieval costs 12 steps: the agent follows the wrong procedure, then backtracks.' : '',
    s.refactored && r.reused ? (s.check ? 'The refactor made the skill stale; its test caught the first failure, the skill was revised, and later reuses were fine.' : 'The refactor made the skill stale and nothing checked it, so every reuse looked fast but shipped a broken change.') : '',
    `Average: ${r.averageSteps.toFixed(1)} steps per task, ${r.tokensK}k tokens, ${Math.round(r.correctShare * 10)} of 10 correct.`,
  ].filter(Boolean).join(' '),
  missions: {
    best: ({ state, result }) => state.library && result.averageSteps <= 6.3 + 1e-9 && result.correctShare === 1,
    clean: ({ state, result }) => state.library && result.wrong === 0 && result.reused >= 5 && result.correctShare === 1,
    stale: ({ state, result }) => state.refactored && result.correctShare === 1 && result.reused > 0 && result.averageSteps < EXPLORE_STEPS,
  },
});
