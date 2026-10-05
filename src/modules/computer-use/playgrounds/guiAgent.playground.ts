import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatPercent, formatRupees, formatWholePercent } from '@/shared/format';
import { simulateGuiAgent, type GuiAgentResult, type GuiAgentState } from '../simulators/guiAgent';

export const guiAgentPlayground = definePlayground<GuiAgentState, GuiAgentResult>({
  techniqueId: 'gui',
  title: 'Automate a legacy back-office app',
  intro: 'An NEFT-return case takes 18 actions in a desktop app with no API. Each action is a screenshot and a model call.',
  controls: [
    { kind: 'select', key: 'perception', label: 'The agent sees', options: [{ value: 'shot', label: 'Screenshots only' }, { value: 'zoom', label: 'Screenshots plus zoom' }, { value: 'hybrid', label: 'Accessibility data plus screenshots' }] },
    { kind: 'select', key: 'size', label: 'Screenshot size', options: [{ value: 'low', label: '1024 × 768: small text' }, { value: 'mid', label: '1280 × 800: fits the model' }, { value: 'high', label: '1920 × 1080, downscaled' }] },
    { kind: 'select', key: 'budget', label: 'Step budget', options: [{ value: '20', label: '20' }, { value: '40', label: '40' }, { value: '80', label: '80' }] },
    { kind: 'toggle', key: 'verify', label: 'Check the screen after each action' },
  ],
  presets: {
    start: { state: { perception: 'shot', size: 'mid', budget: 40, verify: false }, expected: { perStep: 0.955, success: 0.43658, rupees: 10.8 } },
    zoom: { state: { perception: 'zoom', size: 'mid', budget: 40, verify: false }, expected: { success: 0.57795 } },
    tight: { state: { perception: 'hybrid', size: 'mid', budget: 20, verify: true }, expected: { perStep: 0.997, outOfSteps: true, success: 0 } },
    low: { state: { perception: 'shot', size: 'low', budget: 80, verify: false }, expected: { perStep: 0.94, success: 0.32832 } },
  },
  initialPreset: 'start',
  simulate: simulateGuiAgent,
  outputs: [
    { kind: 'meter', label: 'Each action right', value: (r) => r.perStep },
    { kind: 'meter', label: 'Whole case right', value: (r) => r.success, detail: () => '= per-action accuracy over 18 actions', emphasis: (r) => (r.success < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Actions needed · budget', value: (r) => formatFixed(r.actionsNeeded, 0), emphasis: (r) => (r.outOfSteps ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time and cost per case', value: (r) => `${Math.round(r.seconds)} s · ${formatRupees(r.rupees, 2)}` },
  ],
  verdict: (r) => (r.success >= 0.9
    ? { tone: 'ok', headline: 'Reliable enough for a pilot.', detail: 'The rest go to staff; keep asking for an API.' }
    : r.outOfSteps ? { tone: 'no', headline: 'Out of steps.', detail: 'Checking each screen needs more actions than the budget allows.' }
      : { tone: 'mid', headline: 'Errors compound.', detail: 'Small per-step error rates multiply over 18 steps.' }),
  narrate: (r, s) => [
    `Each action is right ${formatPercent(r.perStep, 1)} of the time${s.size === 'low' ? ', with small text often misread' : ''}.`,
    r.outOfSteps ? `Checking every screen needs about ${Math.round(r.actionsNeeded)} actions, but the budget is ${s.budget}, so no case finishes.` : `Over 18 actions that compounds to ${formatWholePercent(r.success)} of cases done correctly.`,
    `Each case takes about ${Math.round(r.seconds)} s and ${formatRupees(r.rupees, 2)}.`,
  ].join(' '),
  missions: {
    reliable: ({ result }) => result.success >= 0.9,
    budget: ({ state, result }) => state.verify && result.outOfSteps,
    tiny: ({ state, result }) => state.perception === 'shot' && state.size === 'low' && result.success < 0.35,
  },
});
