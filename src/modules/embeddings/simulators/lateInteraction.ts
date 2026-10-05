/** Single-vector vs ColBERT vs ColPali retrieval over 10 lakh claim pages, with optional token-vector compression. */
export type Retriever = 'dense' | 'colbert' | 'colpali';
export const VISUAL_SHARES = [0.2, 0.5, 0.8] as const;
export type VisualShare = (typeof VISUAL_SHARES)[number];

const RECALL: Readonly<Record<Retriever, readonly [text: number, visual: number]>> = { dense: [0.78, 0.6], colbert: [0.88, 0.66], colpali: [0.84, 0.86] };
const SIZE_GB: Readonly<Record<Retriever, readonly [raw: number, compressed: number]>> = { dense: [4, 4], colbert: [32, 6], colpali: [260, 40] };
const LATENCY_MS: Readonly<Record<Retriever, readonly [raw: number, compressed: number]>> = { dense: [20, 20], colbert: [60, 45], colpali: [120, 90] };

export interface LateInteractionState { readonly retriever: Retriever; readonly visualShare: VisualShare; readonly compress: boolean }
export interface LateInteractionResult { readonly textRecall: number; readonly visualRecall: number; readonly recall: number; readonly sizeGb: number; readonly latencyMs: number }

export function simulateLateInteraction({ retriever, visualShare, compress }: LateInteractionState): LateInteractionResult {
  const [textRecall, visualRecall] = RECALL[retriever];
  const i = compress ? 1 : 0;
  return {
    textRecall, visualRecall,
    recall: (1 - visualShare) * textRecall + visualShare * visualRecall,
    sizeGb: SIZE_GB[retriever][i],
    latencyMs: LATENCY_MS[retriever][i],
  };
}
