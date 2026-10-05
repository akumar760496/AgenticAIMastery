/** Matryoshka truncation, quantisation and rescoring for a large vector index against a 64 GB RAM budget. */
export type Precision = 'float32' | 'float16' | 'int8' | 'binary';
export const DIMENSIONS = [1536, 1024, 512, 256, 128] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export const RAM_GB = 64;
const FULL_BYTES = 6144;
const MATRYOSHKA_RECALL: Readonly<Record<Dimension, number>> = { 1536: 1, 1024: 0.995, 512: 0.99, 256: 0.97, 128: 0.93 };
const BINARY_RECALL: Readonly<Record<Dimension, number>> = { 1536: 0.82, 1024: 0.78, 512: 0.68, 256: 0.55, 128: 0.42 };
export const PRECISION_BITS: Readonly<Record<Precision, number>> = { float32: 32, float16: 16, int8: 8, binary: 1 };
const PRECISION_RECALL: Readonly<Record<Exclude<Precision, 'binary'>, number>> = { float32: 1, float16: 0.999, int8: 0.99 };

export interface VectorCompressionState { readonly dimensions: Dimension; readonly precision: Precision; readonly rescore: boolean; readonly oversampling: number; readonly millions: number }
export interface VectorCompressionResult {
  readonly bytesPerVector: number;
  readonly indexGb: number;
  readonly compressionRatio: number;
  readonly baseRecall: number;
  readonly recall: number;
  readonly fits: boolean;
  readonly candidates: number;
}

export function simulateVectorCompression(s: VectorCompressionState): VectorCompressionResult {
  const bytesPerVector = (s.dimensions * PRECISION_BITS[s.precision]) / 8;
  const indexGb = (bytesPerVector * s.millions * 1e6) / 1e9;
  const baseRecall = s.precision === 'binary' ? BINARY_RECALL[s.dimensions] : MATRYOSHKA_RECALL[s.dimensions] * PRECISION_RECALL[s.precision];
  return {
    bytesPerVector, indexGb, compressionRatio: FULL_BYTES / bytesPerVector, baseRecall,
    recall: s.rescore ? 1 - (1 - baseRecall) * Math.pow(0.5, s.oversampling - 1) : baseRecall,
    fits: indexGb <= RAM_GB,
    candidates: s.oversampling * 10,
  };
}
