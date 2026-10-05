/** Prompt vs RAG vs fine-tuning vs both, given the gap type, how fast facts change, examples, volume and baseline. Illustrative. */
export type GapKind = 'facts' | 'style' | 'skill' | 'both';
export type FactChange = 'daily' | 'monthly' | 'rarely';
export type AdaptationOption = 'P' | 'R' | 'F' | 'RF';
export interface AdaptationChoiceState { readonly task: GapKind; readonly change: FactChange; readonly examples: number; readonly volume: number; readonly baseline: number }
export interface OptionOutcome { readonly key: AdaptationOption; readonly label: string; readonly accuracy: number | null; readonly monthlyCost: number; readonly viable: boolean }
export interface AdaptationChoiceResult { readonly options: readonly OptionOutcome[]; readonly recommended: AdaptationOption; readonly blocked: boolean; readonly stale: boolean }

export const OPTION_LABELS: Readonly<Record<AdaptationOption, string>> = { P: 'Prompt only', R: 'RAG', F: 'Fine-tune', RF: 'RAG + fine-tune' };
const ORDER: readonly AdaptationOption[] = ['P', 'R', 'F', 'RF'];
const TUNING_FIXED_COST = 60000;
const MIN_TUNING_VOLUME = 100000;
const MARGIN = 2;

export function simulateAdaptationChoice(s: AdaptationChoiceState): AdaptationChoiceResult {
  const b = s.baseline; const small = s.examples === 200; const rarely = s.change === 'rarely';
  const acc: Partial<Record<AdaptationOption, number>> = {
    P: b,
    R: b + { facts: rarely ? 12 : 25, style: 2, skill: 2, both: rarely ? 8 : 15 }[s.task],
  };
  if (s.examples > 0) {
    acc.F = b + { facts: rarely ? 6 : -5, style: small ? 15 : 22, skill: small ? 10 : 18, both: small ? 6 : 12 }[s.task];
    acc.RF = s.task === 'facts' ? acc.R : (acc.R as number) + (acc.F - b);
  }
  for (const k of ORDER) if (acc[k] !== undefined) acc[k] = Math.min(98, acc[k] as number);
  const cost: Record<AdaptationOption, number> = { P: s.volume * 0.5, R: s.volume * 0.55, F: s.volume * 0.1 + TUNING_FIXED_COST, RF: s.volume * 0.15 + TUNING_FIXED_COST };
  const viable = (k: AdaptationOption) => acc[k] !== undefined && (k === 'P' || k === 'R' || s.volume >= MIN_TUNING_VOLUME);
  const pick = (allowed: (k: AdaptationOption) => boolean) => {
    let best: AdaptationOption | null = null;
    for (const k of ORDER) if (allowed(k) && (best === null || (acc[k] as number) > (acc[best] as number) + MARGIN)) best = k;
    return best as AdaptationOption;
  };
  const recommended = pick(viable);
  const unconstrained = pick((k) => acc[k] !== undefined);
  return {
    options: ORDER.map((key) => ({ key, label: OPTION_LABELS[key], accuracy: acc[key] ?? null, monthlyCost: cost[key], viable: viable(key) })),
    recommended,
    blocked: (unconstrained === 'F' || unconstrained === 'RF') && !viable(unconstrained),
    stale: (s.task === 'facts' || s.task === 'both') && !rarely,
  };
}
