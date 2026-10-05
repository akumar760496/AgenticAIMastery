/** Rangmanch Studio (fictional) AI media shared through apps that crop, screenshot and re-encode. */
export type Labelling = 'none' | 'visible' | 'meta';
export interface ProvenanceState { readonly labelling: Labelling; readonly watermark: boolean; readonly locked: boolean }
export interface ProvenanceResult { readonly survival: number; readonly requirementsMet: number; readonly costPer1000: number }

const LABEL_SURVIVAL: Readonly<Record<Labelling, number>> = { none: 0, visible: 0.6, meta: 0.7 };

export function simulateProvenance(s: ProvenanceState): ProvenanceResult {
  const base = LABEL_SURVIVAL[s.labelling] * (s.locked ? 1 : 0.7);
  const labelled = s.labelling !== 'none';
  return {
    survival: Math.round((1 - (1 - base) * (s.watermark ? 0.15 : 1)) * 1000) / 1000,
    requirementsMet: (labelled ? 1 : 0) + (s.labelling === 'meta' || s.watermark ? 1 : 0) + (s.locked && labelled ? 1 : 0),
    costPer1000: (s.labelling === 'meta' ? 20 : 0) + (s.watermark ? 60 : 0),
  };
}
