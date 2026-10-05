import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatRupees } from '@/shared/format';
import { simulateRlvr, type RlvrResult, type RlvrState } from '../simulators/verifiableRewards';

const isReal = (r: RlvrResult) => r.trueAccuracy >= 65 && r.gap <= 3;

export const verifiableRewardsPlayground = definePlayground<RlvrState, RlvrResult>({
  techniqueId: 'rlvr',
  title: 'Train a maths tutor with GRPO',
  intro: 'A 1B model after SFT solves 40% of held-out school maths problems. Each step samples G answers per prompt; one sample costs about 0.02 GPU-hours at ₹250 an hour.',
  controls: [
    { kind: 'select', key: 'reward', label: 'Reward pays for', options: [{ value: 'fmt', label: 'A neatly boxed answer' }, { value: 'ans', label: 'Final answer matches the key' }, { value: 'work', label: 'Answer matches and the working checks out' }] },
    { kind: 'select', key: 'verifier', label: 'Verifier', options: [{ value: 'weak', label: 'Loose: any matching number in the text' }, { value: 'strong', label: 'Strict: parse one number, compare exactly' }] },
    { kind: 'select', key: 'group', label: 'Group size G', options: [2, 4, 8, 16].map((v) => ({ value: String(v), label: String(v) })) },
    { kind: 'steps', key: 'steps', label: 'Training steps', values: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000], format: (v) => String(v) },
  ],
  presets: {
    start: { state: { reward: 'ans', verifier: 'weak', group: 2, steps: 200 }, expected: { trueAccuracy: 45.902, gap: 6 } },
    format: { state: { reward: 'fmt', verifier: 'strong', group: 8, steps: 800 }, expected: { trueAccuracy: 42, observedReward: 91.9926 } },
    hack: { state: { reward: 'work', verifier: 'weak', group: 8, steps: 700 }, expected: { trueAccuracy: 61.1514, gap: 8.4 } },
    near: { state: { reward: 'work', verifier: 'strong', group: 8, steps: 600 }, expected: { trueAccuracy: 64.8598, gap: 1, cost: 24000 } },
  },
  initialPreset: 'start',
  simulate: simulateRlvr,
  outputs: [
    { kind: 'meter', label: 'Training reward', value: (r) => r.observedReward / 100, detail: () => '= what the trainer sees', emphasis: (r) => (r.gap > 10 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'True held-out accuracy', value: (r) => r.trueAccuracy / 100, detail: () => '= checked independently', emphasis: (r) => (r.trueAccuracy < 65 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Gap: reward − accuracy', value: (r) => `${formatFixed(r.gap, 1)} pts` },
    { kind: 'value', label: 'GPU cost', value: (r) => formatRupees(r.cost) },
  ],
  verdict: (r) => (isReal(r)
    ? { tone: 'ok', headline: 'Real learning.', detail: 'Reward and accuracy rise together because the verifier is hard to fool.' }
    : r.gap > 10 ? { tone: 'no', headline: 'Reward hacking.', detail: 'Reward climbs while accuracy does not: the model found a loophole.' }
      : { tone: 'mid', headline: 'Learning, slowly.', detail: 'More steps, a bigger group or a stronger reward would help.' }),
  narrate: (r, s) => [
    s.reward === 'fmt' ? 'The reward pays for a boxed answer, so the model learns the format:' : `The reward checks ${s.reward === 'ans' ? 'the final answer' : 'the answer and the working'} with a ${s.verifier === 'weak' ? 'loose' : 'strict'} verifier:`,
    `training reward ${formatFixed(r.observedReward, 1)}% against true accuracy ${formatFixed(r.trueAccuracy, 1)}% after ${s.steps} steps with ${s.group} samples each.`,
    s.group === 2 ? 'With only two samples, many groups are all right or all wrong and teach nothing.' : '',
    `The run costs ${formatRupees(r.cost)}.`,
  ].filter(Boolean).join(' '),
  missions: {
    acc: ({ result }) => result.trueAccuracy >= 65,
    cheap: ({ result }) => isReal(result) && result.cost <= 30000,
    hack: ({ state, result }) => state.reward !== 'fmt' && result.gap >= 10,
  },
});
