import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent, joinWithAnd } from '@/shared/format';
import { REQUIREMENTS, simulateAgentJudge, type AgentJudgeResult, type AgentJudgeState } from '../simulators/agentJudge';

const verified = (r1: boolean, r2: boolean, r3: boolean, r4: boolean): AgentJudgeState => ({ verified: { R1: r1, R2: r2, R3: r3, R4: r4 } });

export const agentJudgePlayground = definePlayground<AgentJudgeState, AgentJudgeResult>({
  techniqueId: 'agentjudge',
  title: 'What does the evidence show?',
  intro: 'The agent’s summary claims all four requirements are done. Tick only what the checks confirm.',
  controls: [
    { kind: 'flagSet', key: 'verified', label: 'Verified by running or inspecting the work', options: REQUIREMENTS.map((r) => ({
      value: r.id, label: `${r.id} ${r.text}${r.dependsOn.length ? ` (needs ${r.dependsOn.join(', ')})` : ''}`,
    })) },
  ],
  presets: {
    start: { state: verified(true, false, true, true), expected: { naiveScore: 0.75, dependencyAwareScore: 0.5 } },
    done: { state: verified(true, true, true, true), expected: { dependencyAwareScore: 1 } },
    foundation: { state: verified(false, true, true, true), expected: { naiveScore: 0.75, dependencyAwareScore: 0.25 } },
  },
  initialPreset: 'start',
  simulate: simulateAgentJudge,
  outputs: [
    { kind: 'meter', label: 'LLM judge reading the summary', value: () => 1, detail: () => '= trusts “all 4 done”', emphasis: () => 'muted' },
    { kind: 'meter', label: 'Agent judge, no dependencies', value: (r) => r.naiveScore, detail: (r) => `= ${r.naiveScore * 4} verified ÷ 4`, emphasis: () => 'warn' },
    { kind: 'meter', label: 'Agent judge, dependency-aware', value: (r) => r.dependencyAwareScore, detail: (r) => `= ${r.dependencyAwareScore * 4} verified with prerequisites ÷ 4` },
    { kind: 'badges', items: (r) => REQUIREMENTS.map(({ id }) => ({ text: `${id}: ${r.status[id]}`, emphasis: r.status[id] === 'pass' ? 'normal' : 'warn' })) },
  ],
  verdict: (r) =>
    r.dependencyAwareScore === 1 ? { tone: 'ok', headline: 'The work matches the claim.', detail: 'Every requirement is verified with its prerequisites.' }
      : { tone: r.dependencyAwareScore >= 0.5 ? 'mid' : 'no', headline: `The summary overstates the work by ${formatWholePercent(1 - r.dependencyAwareScore)}.`, detail: 'Trust verified evidence, not the agent’s own report.' },
  narrate: (r) => {
    const parts = [`The agent claimed 4 of 4, so a judge that only reads the summary reports 100%. Checking the work verifies ${r.naiveScore * 4} of 4.`];
    if (r.failed.length) parts.push(`${joinWithAnd(r.failed)} failed when the judge ran or inspected ${r.failed.length > 1 ? 'them' : 'it'}.`);
    if (r.blocked.length) parts.push(`${joinWithAnd(r.blocked)} ${r.blocked.length > 1 ? 'look fine on their own but depend' : 'looks fine on its own but depends'} on a failed requirement, so ${r.blocked.length > 1 ? 'they don’t' : 'it doesn’t'} count.`);
    parts.push(`The honest score is ${formatWholePercent(r.dependencyAwareScore)}${r.dependencyAwareScore < 1 ? `, so the summary overstated the work by ${formatWholePercent(1 - r.dependencyAwareScore)}` : ''}.`);
    return parts.join(' ');
  },
  missions: {
    agree: ({ result }) => result.dependencyAwareScore === 1,
    gap: ({ result }) => Math.abs(result.naiveScore - 0.75) < 1e-9 && Math.abs(result.dependencyAwareScore - 0.25) < 1e-9,
    zero: ({ result }) => result.dependencyAwareScore === 0,
  },
});
