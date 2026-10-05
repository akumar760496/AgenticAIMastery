import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent, pluralise } from '@/shared/format';
import { simulateSft, type SftResult, type SftState } from '../simulators/supervisedFineTuning';

const base: SftState = { size: 8, method: 'lora', rank: 16, modules: 'all', data: 5000, epochs: 2 };
const METHOD_NAME = { full: 'Full fine-tuning', lora: 'LoRA', qlora: 'QLoRA' } as const;
const trainableText = (r: SftResult, s: SftState) => (s.method === 'full' ? '100%' : `${(r.trainableShare * 100).toFixed(2)}%`);
const paramsText = (billions: number) => (billions >= 1 ? `${billions.toFixed(1)}B` : `${formatCount(Math.round(billions * 1000))}M`);

export const supervisedFineTuningPlayground = definePlayground<SftState, SftResult>({
  techniqueId: 'sft',
  title: 'Fine-tune a support-reply model',
  intro: 'Replies must follow a four-part format. Accuracy is format and content correctness on a held-out 10%. Memory is an estimate for training with short sequences.',
  controls: [
    { kind: 'select', key: 'size', label: 'Base model', options: [{ value: '1', label: '1B' }, { value: '8', label: '8B' }, { value: '70', label: '70B' }] },
    { kind: 'select', key: 'method', label: 'Method', options: [{ value: 'full', label: 'Full fine-tuning (16-bit)' }, { value: 'lora', label: 'LoRA (16-bit base)' }, { value: 'qlora', label: 'QLoRA (4-bit base)' }] },
    { kind: 'select', key: 'rank', label: 'LoRA rank (ignored for full fine-tuning)', options: [4, 8, 16, 32, 64].map((v) => ({ value: String(v), label: String(v) })) },
    { kind: 'select', key: 'modules', label: 'Adapters on', options: [{ value: 'attn', label: 'Attention layers only' }, { value: 'all', label: 'All linear layers' }] },
    { kind: 'select', key: 'data', label: 'Examples', options: [{ value: '500', label: '500' }, { value: '5000', label: '5,000' }, { value: '50000', label: '50,000' }] },
    { kind: 'steps', key: 'epochs', label: 'Epochs', values: [1, 2, 3, 4, 5], format: (v) => String(v) },
  ],
  presets: {
    start: { state: { ...base, method: 'full', epochs: 1 }, expected: { accuracy: 0.8683, memoryGb: 130 } },
    lora: { state: base, expected: { accuracy: 0.8746, trainableShare: 0.0052, memoryGb: 18.6656 } },
    big: { state: { ...base, size: 70 }, expected: { accuracy: 0.97, memoryGb: 160.9944 } },
    over: { state: { ...base, data: 500, epochs: 5 }, expected: { accuracy: 0.73, trainAccuracy: 0.995 } },
  },
  initialPreset: 'start',
  simulate: simulateSft,
  outputs: [
    { kind: 'meter', label: 'Held-out accuracy', value: (r) => r.accuracy, detail: () => '= on the 10% never trained on', emphasis: (r) => (r.accuracy < 0.88 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Training accuracy', value: (r) => r.trainAccuracy, detail: (r) => (r.overfit > 0 ? '= far above held-out: overfitting' : '= close to held-out'), emphasis: (r) => (r.overfit > 0 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Trainable parameters', value: (r) => `${r.trainableShare === 1 ? '100%' : `${(r.trainableShare * 100).toFixed(2)}%`} (${paramsText(r.trainableBillions)})` },
    { kind: 'value', label: 'GPU memory', value: (r) => `${Math.round(r.memoryGb)} GB`, emphasis: (r) => (r.memoryGb > 80 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Fits on', value: (r) => r.fitsOn },
  ],
  verdict: (r) => (r.overfit > 0
    ? { tone: 'no', headline: 'Overfitting.', detail: 'Too many passes over too little data: held-out accuracy falls.' }
    : r.memoryGb > 80 ? { tone: 'mid', headline: 'Too big for one GPU.', detail: 'Full fine-tuning keeps 16 bytes of weights, gradients and optimiser state per parameter; a 16-bit 70B base is large even with LoRA.' }
      : r.accuracy >= 0.9 ? { tone: 'ok', headline: 'Accurate and it fits.', detail: 'An adapter learns the format without touching the base weights.' }
        : { tone: 'mid', headline: 'Fits, but not there yet.', detail: 'More data, more epochs or adapters on all layers would help.' }),
  narrate: (r, s) => [
    `${METHOD_NAME[s.method]} on the ${s.size}B model ${s.method === 'full' ? 'trains every parameter' : `trains ${trainableText(r, s)} of the parameters`} and needs about ${Math.round(r.memoryGb)} GB.`,
    `After ${s.epochs} ${pluralise(s.epochs, 'epoch')} on ${formatCount(s.data)} examples, held-out accuracy is ${formatWholePercent(r.accuracy)}${r.overfit > 0 ? `, while training accuracy is ${formatWholePercent(r.trainAccuracy)}: the model is memorising.` : '.'}`,
  ].join(' '),
  missions: {
    big: ({ state, result }) => state.size === 70 && result.memoryGb <= 80,
    acc: ({ result }) => result.accuracy >= 0.9 && result.overfit === 0,
    lean: ({ result }) => result.trainableShare < 0.01 && result.accuracy >= 0.875 && result.memoryGb <= 24,
  },
});
