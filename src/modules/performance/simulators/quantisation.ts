/** Weight format and KV-cache precision for a self-hosted 70B or 8B model on 80 GB GPUs. */
export type ModelSize = '70b' | '8b';
export type WeightFormat = 'bf16' | 'fp8' | 'int4';
const WEIGHTS_GB: Readonly<Record<ModelSize, Readonly<Record<WeightFormat, number>>>> = { '70b': { bf16: 140, fp8: 70, int4: 38 }, '8b': { bf16: 16, fp8: 8, int4: 5 } };
const KV_GB: Readonly<Record<ModelSize, number>> = { '70b': 20, '8b': 8 };
const QUALITY: Readonly<Record<ModelSize, Readonly<Record<WeightFormat, number>>>> = { '70b': { bf16: 0.86, fp8: 0.857, int4: 0.845 }, '8b': { bf16: 0.74, fp8: 0.737, int4: 0.715 } };
const THROUGHPUT: Readonly<Record<ModelSize, Readonly<Record<WeightFormat, number>>>> = { '70b': { bf16: 1600, fp8: 1400, int4: 800 }, '8b': { bf16: 3000, fp8: 4800, int4: 3600 } };
const USABLE_GB_PER_GPU = 72;
const GPU_INR_PER_HOUR = 300;
const FP8_KV_QUALITY_COST = 0.002;
const FP8_KV_THROUGHPUT_GAIN = 1.25;

export interface QuantisationState { readonly model: ModelSize; readonly weights: WeightFormat; readonly fp8KvCache: boolean }
export interface QuantisationResult { readonly weightsGb: number; readonly gpus: number; readonly quality: number; readonly throughput: number; readonly costPerMillionInr: number }

export function simulateQuantisation(s: QuantisationState): QuantisationResult {
  const weightsGb = WEIGHTS_GB[s.model][s.weights];
  const kv = KV_GB[s.model] * (s.fp8KvCache ? 0.5 : 1);
  const need = Math.ceil((weightsGb + kv) / USABLE_GB_PER_GPU);
  const gpus = need <= 1 ? 1 : need <= 2 ? 2 : 4;
  const throughput = THROUGHPUT[s.model][s.weights] * (s.fp8KvCache ? FP8_KV_THROUGHPUT_GAIN : 1);
  return {
    weightsGb, gpus,
    quality: Math.round((QUALITY[s.model][s.weights] - (s.fp8KvCache ? FP8_KV_QUALITY_COST : 0)) * 1000) / 1000,
    throughput,
    costPerMillionInr: Math.round(((gpus * GPU_INR_PER_HOUR) / ((throughput * 3600) / 1e6)) * 10) / 10,
  };
}
