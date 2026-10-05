/** SFT of a support-reply model: base size, full / LoRA / QLoRA, rank, target modules, data and epochs; memory estimate. */
export type TuningMethod = 'full' | 'lora' | 'qlora';
export type TargetModules = 'attn' | 'all';
export interface SftState { readonly size: number; readonly method: TuningMethod; readonly rank: number; readonly modules: TargetModules; readonly data: number; readonly epochs: number }
export interface SftResult { readonly accuracy: number; readonly trainAccuracy: number; readonly overfit: number; readonly trainableShare: number; readonly trainableBillions: number; readonly memoryGb: number; readonly fitsOn: string }

const BASE_ACCURACY: Readonly<Record<number, number>> = { 1: 0.55, 8: 0.7, 70: 0.8 };
const DATA_FACTOR: Readonly<Record<number, number>> = { 500: 0.6, 5000: 0.9, 50000: 1 };

export function simulateSft(s: SftState): SftResult {
  const full = s.method === 'full';
  let gain = full ? 0.22 : s.modules === 'all' ? 0.2 : 0.17;
  if (s.method === 'qlora') gain -= 0.005;
  const rankFactor = full ? 1 : s.rank <= 4 ? 0.9 : s.rank <= 8 ? 0.95 : 1;
  const epochFactor = s.epochs === 1 ? 0.85 : s.epochs === 2 ? 0.97 : 1;
  const overfit = s.data === 500 && s.epochs >= 3 ? 0.03 * (s.epochs - 2) : s.data === 5000 && s.epochs >= 4 ? 0.02 * (s.epochs - 3) : 0;
  const accuracy = Math.min(0.97, (BASE_ACCURACY[s.size] ?? 0) + gain * (DATA_FACTOR[s.data] ?? 0) * rankFactor * epochFactor - overfit);
  const trainableShare = full ? 1 : (s.rank / 16) * (s.modules === 'all' ? 0.0052 : 0.0017) * (s.size === 1 ? 1.5 : s.size === 70 ? 0.6 : 1);
  const trainableBillions = s.size * trainableShare;
  const activations = 0.25 * s.size;
  const memoryGb = full ? 16 * s.size + activations : s.method === 'lora' ? 2 * s.size + 16 * trainableBillions + activations : 0.55 * s.size + 16 * trainableBillions + activations;
  const fitsOn = memoryGb <= 24 ? 'one 24 GB GPU' : memoryGb <= 48 ? 'one 48 GB GPU' : memoryGb <= 80 ? 'one 80 GB GPU' : `several GPUs (${Math.ceil(memoryGb / 80)} × 80 GB)`;
  return { accuracy, trainAccuracy: Math.min(0.995, accuracy + overfit * 3 + 0.02), overfit, trainableShare, trainableBillions, memoryGb, fitsOn };
}
