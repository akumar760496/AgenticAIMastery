import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatRupees, formatWholePercent } from '@/shared/format';
import { simulateUserSimulation, type UserSimulationResult, type UserSimulationState } from '../simulators/userSimulation';

export const userSimulationPlayground = definePlayground<UserSimulationState, UserSimulationResult>({
  techniqueId: 'usersim',
  title: 'Test Paisa Setu’s refund agent',
  intro: '200 scenarios about failed UPI payments. About 71% of real conversations succeed; 20 known failure types are seeded.',
  controls: [
    { kind: 'select', key: 'userSide', label: 'User side', options: [{ value: 'scripted', label: 'Scripted turns (fixed messages)' }, { value: 'llm', label: 'LLM-simulated user with a scenario card' }] },
    { kind: 'toggle', key: 'difficultPersonas', label: 'Add difficult personas (Hinglish, impatient, withholding)', isEnabled: (s) => s.userSide === 'llm' },
    { kind: 'steps', key: 'runsPerScenario', label: 'Runs per scenario', values: [1, 4, 8], format: String },
  ],
  presets: {
    start: { state: { userSide: 'scripted', difficultPersonas: false, runsPerScenario: 1 }, expected: { reportedPassRate: 0.95, failureTypesFound: 5, suiteCostRupees: 100 } },
    llm: { state: { userSide: 'llm', difficultPersonas: false, runsPerScenario: 1 }, expected: { reportedPassRate: 0.8, failureTypesFound: 11, suiteCostRupees: 800 } },
    mixed: { state: { userSide: 'llm', difficultPersonas: true, runsPerScenario: 1 }, expected: { reportedPassRate: 0.71, failureTypesFound: 16, gapToRealUsers: 0 } },
    repeat: { state: { userSide: 'llm', difficultPersonas: true, runsPerScenario: 4 }, expected: { passHatK: 0.254, failureTypesFound: 18, suiteCostRupees: 3200 } },
  },
  initialPreset: 'start',
  simulate: simulateUserSimulation,
  outputs: [
    { kind: 'meter', label: 'Reported pass rate (pass^1)', value: (r) => r.reportedPassRate, emphasis: (r) => (r.gapToRealUsers > 0.05 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'pass^k (all runs succeed)', value: (r) => r.passHatK, emphasis: (r) => (r.passHatK < 0.5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Failure types found', value: (r) => `${r.failureTypesFound} of ${r.totalFailureTypes}`, emphasis: (r) => (r.failureTypesFound < 10 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Gap to real users', value: (r) => (r.gapToRealUsers > 0 ? `+${Math.round(r.gapToRealUsers * 100)} points` : 'none'), emphasis: (r) => (r.gapToRealUsers > 0.05 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Suite cost', value: (r) => formatRupees(r.suiteCostRupees) },
  ],
  verdict: (r, s) => {
    if (r.failureTypesFound >= 18 && r.suiteCostRupees <= 4000) return { tone: 'ok', headline: 'Realistic, repeated, affordable.', detail: 'Most failure types show up before users meet them.' };
    if (r.gapToRealUsers > 0.05) return { tone: 'no', headline: 'The tests flatter the agent.', detail: s.userSide === 'scripted' ? 'Fixed turns never react to what the agent says.' : 'Add the personas real users have.' };
    return { tone: 'mid', headline: 'Closer to real users.', detail: 'Repeat runs to see how reliable it is.' };
  },
  narrate: (r, s) => {
    const opening = s.userSide === 'scripted' ? 'Scripted turns send the same messages whatever the agent says, so missing questions go unnoticed'
      : s.difficultPersonas ? 'The simulated users hold back the UTR, switch to Hinglish and push back, like real customers'
      : 'An LLM user reacts to the agent, but only as a patient English speaker';
    return `${opening}. Reported ${formatWholePercent(r.reportedPassRate)}, pass^${s.runsPerScenario} ${formatWholePercent(r.passHatK)}, ${r.failureTypesFound} of ${r.totalFailureTypes} failure types found for ${formatRupees(r.suiteCostRupees)}.`;
  },
  missions: {
    best: ({ result }) => result.failureTypesFound >= 18 && result.suiteCostRupees <= 4000,
    honest: ({ result }) => result.gapToRealUsers <= 0.02,
    reliab: ({ result }) => result.passHatK < 0.3,
  },
});
