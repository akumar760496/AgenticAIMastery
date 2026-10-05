/**
 * Udaan Lend (fictional NBFC) training-set curation. 50,000 raw rows: 18% copies, 9% wrong labels,
 * 30% one intent, PII in 12%, and 400 near-copies of the 2,000-item eval set. Reviewers cost ₹40 a row.
 */
export type Dedup = 'off' | 'train' | 'eval';
export type Cleaning = 'none' | 'review';
export type Synthetic = 'none' | 'raw' | 'verified';
export interface DataCurationState { readonly dedup: Dedup; readonly clean: Cleaning; readonly rebalance: boolean; readonly scrub: boolean; readonly synthetic: Synthetic }
export interface DataCurationResult {
  readonly size: number; readonly real: number; readonly synthetic: number; readonly contaminated: number; readonly wrongLabels: number;
  readonly piiRows: number; readonly common: number; readonly rare: number; readonly honest: number; readonly reported: number; readonly reviewCost: number;
}

const ROWS_AFTER_DEDUP: Readonly<Record<Dedup, number>> = { off: 50000, train: 41000, eval: 40600 };

export function simulateDataCuration(s: DataCurationState): DataCurationResult {
  const reviewed = s.clean === 'review';
  const real = Math.round(ROWS_AFTER_DEDUP[s.dedup] * (s.rebalance ? 0.8 : 1));
  const synthetic = s.synthetic === 'none' ? 0 : 5000;
  const contaminated = s.dedup === 'eval' ? 0 : 400;
  const wrongLabels = Math.round(real * (reviewed ? 0.015 : 0.09)) + (s.synthetic === 'raw' ? 750 : s.synthetic === 'verified' ? 100 : 0);
  const withPii = Math.round(real * 0.12);
  const noDedup = s.dedup === 'off' ? 2 : 0;
  const common = 91 - (reviewed ? 1 : 5) + (s.rebalance ? 1 : 0) - noDedup;
  const rare = 66 - (reviewed ? 1 : 6) + (s.rebalance ? 8 : 0) + (s.synthetic === 'verified' ? 14 : s.synthetic === 'raw' ? 6 : 0) - noDedup;
  const honest = Math.round(9 * common + rare) / 10;
  return {
    size: real + synthetic, real, synthetic, contaminated, wrongLabels,
    piiRows: s.scrub ? Math.round(withPii * 0.02) : withPii,
    common, rare, honest,
    reported: contaminated ? Math.round(((4 * honest + 99) / 5) * 10) / 10 : honest,
    reviewCost: (reviewed ? 2000 * 40 : 0) + (s.synthetic === 'verified' ? 500 * 40 : 0),
  };
}
