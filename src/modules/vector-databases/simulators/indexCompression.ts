/** float32, int8, PQ and binary encodings for 2 crore product vectors, with optional float32 rescoring from SSD. */
export type Encoding = 'fp32' | 'int8' | 'pq' | 'binary';
export const OVERSAMPLE_OPTIONS = [1, 2, 4] as const;
export type Oversample = (typeof OVERSAMPLE_OPTIONS)[number];

const BASE: Readonly<Record<Encoding, readonly [recall: number, ramGb: number, latencyMs: number]>> = { fp32: [0.98, 81.9, 40], int8: [0.96, 20.5, 15], pq: [0.82, 1.3, 8], binary: [0.74, 2.6, 5] };
const RECOVERED: Readonly<Record<Oversample, number>> = { 1: 0.4, 2: 0.75, 4: 0.9 };
const BEST_RECALL = 0.98;
const INR_PER_GB_MONTH = 600;
const SSD_ORIGINALS_INR = 820;

export interface IndexCompressionState { readonly encoding: Encoding; readonly rescore: boolean; readonly oversample: Oversample }
export interface IndexCompressionResult { readonly recall: number; readonly ramGb: number; readonly latencyMs: number; readonly costInr: number; readonly rescoring: boolean }

export function simulateIndexCompression(s: IndexCompressionState): IndexCompressionResult {
  const [baseRecall, ramGb, baseLatency] = BASE[s.encoding];
  const rescoring = s.rescore && s.encoding !== 'fp32';
  return {
    recall: rescoring ? Math.round((baseRecall + (BEST_RECALL - baseRecall) * RECOVERED[s.oversample]) * 1000) / 1000 : baseRecall,
    ramGb,
    latencyMs: baseLatency + (rescoring ? 2 * s.oversample : 0),
    costInr: Math.round(ramGb * INR_PER_GB_MONTH + (s.encoding !== 'fp32' ? SSD_ORIGINALS_INR : 0)),
    rescoring,
  };
}
