import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { flagsFrom } from '@/shared/flags';
import { formatFixed, formatWholePercent } from '@/shared/format';
import { SAFETY_CONTROL_KEYS, SAFETY_CONTROLS, simulateActionSafety, type ActionSafetyResult, type ActionSafetyState } from '../simulators/actionSafety';

const controls = (on: readonly string[]): ActionSafetyState => ({ controls: flagsFrom(SAFETY_CONTROL_KEYS, on) });
const isSafe = (r: ActionSafetyResult) => r.harmPer1000 <= 1 && !r.passwordsSeen && r.recorded;

export const actionSafetyPlayground = definePlayground<ActionSafetyState, ActionSafetyResult>({
  techniqueId: 'actsafe',
  title: 'Make a back-office screen agent safe',
  intro: 'About 5% of pages it visits carry injected instructions, and some buttons move money. Harm rates are illustrative.',
  controls: [{ kind: 'flagSet', key: 'controls', label: 'Defences', options: SAFETY_CONTROLS.map(([value, label]) => ({ value, label })) }],
  presets: {
    start: { state: controls([]), expected: { harmPer1000: 40, passwordsSeen: true } },
    sandbox: { state: controls(['sandbox']), expected: { harmPer1000: 24 } },
    noconfirm: { state: controls(SAFETY_CONTROL_KEYS.filter((k) => k !== 'confirm')), expected: { harmPer1000: 3.84 } },
    all: { state: controls(SAFETY_CONTROL_KEYS), expected: { harmPer1000: 0.384, confirmationsPerTask: 1.2 } },
  },
  initialPreset: 'start',
  simulate: simulateActionSafety,
  outputs: [
    { kind: 'value', label: 'Harmful actions per 1,000 tasks', value: (r) => formatFixed(r.harmPer1000, 1), emphasis: (r) => (r.harmPer1000 > 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Tasks completed', value: (r) => r.completion },
    { kind: 'value', label: 'Confirmations per task', value: (r) => formatFixed(r.confirmationsPerTask, 1) },
    { kind: 'check', label: 'Passwords kept away from the model', value: (r) => !r.passwordsSeen },
    { kind: 'check', label: 'Sessions recorded', value: (r) => r.recorded },
  ],
  verdict: (r, s) => {
    if (isSafe(r)) return { tone: 'ok', headline: 'Defended in depth.', detail: 'Mistakes and injections rarely get through, and every session can be replayed.' };
    if (r.harmPer1000 >= 10) return { tone: 'no', headline: 'Unsafe.', detail: s.controls.sandbox ? 'A sandbox protects the machine, not the accounts the agent can reach.' : 'Injected banners and wrong clicks cause real harm.' };
    return { tone: 'mid', headline: 'Better, not enough.', detail: !s.controls.confirm ? 'Without confirmation, irreversible clicks still slip through.' : 'Close the remaining gaps.' };
  },
  narrate: (r) => [
    `About ${formatFixed(r.harmPer1000, 1)} harmful actions get through per 1,000 tasks, with ${formatWholePercent(r.completion)} of tasks completed.`,
    r.passwordsSeen ? 'Passwords pass through the model’s context.' : 'Credentials are filled from a vault, never shown to the model.',
    r.confirmationsPerTask ? `A person confirms about ${formatFixed(r.confirmationsPerTask, 1)} irreversible actions per task.` : '',
  ].filter(Boolean).join(' '),
  missions: {
    safe: ({ result }) => isSafe(result),
    sandbox: ({ state, result }) => state.controls.sandbox === true && !state.controls.allow && !state.controls.screen && !state.controls.confirm && result.harmPer1000 >= 19,
    confirm: ({ state, result }) => ['sandbox', 'allow', 'vault', 'screen', 'limits', 'record'].every((k) => state.controls[k]) && !state.controls.confirm && result.harmPer1000 > 3,
  },
});
