/** Few-shot complaint classification: refund 30%, delivery 30%, damage 20%, billing 20%; about 180 tokens per example. */
export type ExampleSelection = 'fixed' | 'retrieved';
export type ExampleOrder = 'random' | 'last';
export interface FewShotState { readonly k: number; readonly skew: boolean; readonly order: ExampleOrder; readonly selection: ExampleSelection; readonly diverse: boolean }
export interface FewShotResult { readonly accuracy: number; readonly refundShare: number; readonly tokens: number }

export const TRUE_REFUND_SHARE = 0.3;

export function simulateFewShot(s: FewShotState): FewShotResult {
  const has = s.k > 0;
  const gain = has ? 1 - Math.exp(-s.k / 2.5) : 0;
  const accuracy = 0.78 + (s.selection === 'retrieved' ? 0.14 : 0.1) * gain - (s.skew && has ? 0.06 : 0) - (s.order === 'last' && has ? 0.03 : 0) + (s.diverse && has ? 0.02 : 0);
  const refundShare = TRUE_REFUND_SHARE + (s.skew && has ? 0.22 : 0) + (s.order === 'last' && has ? 0.08 : 0);
  return { accuracy, refundShare, tokens: 400 + s.k * 180 };
}
