/** KYC agent system card: 94% overall, 71% on scanned regional-language documents; an auditor brings 20 points of questions. */
import { type Flags } from '@/shared/flags';

export type CardAudience = 'regulator' | 'customer';
export const CARD_SECTIONS: readonly (readonly [string, string, number])[] = [
  ['use', 'Intended use and out-of-scope uses', 3], ['data', 'Data sources and legal basis', 3], ['evals', 'Results overall', 2], ['seg', 'Results by segment', 3],
  ['limits', 'Known limitations', 3], ['oversight', 'Human oversight and kill switch', 3], ['changes', 'Versions and change log', 2], ['contact', 'Grievance contact', 1],
];
export const CARD_SECTION_KEYS = CARD_SECTIONS.map(([k]) => k);

export interface SystemCardState { readonly audience: CardAudience; readonly sections: Flags }
export interface SystemCardResult { readonly score: number; readonly pages: number; readonly sectionCount: number; readonly hidesSegment: boolean; readonly disclosed: boolean }

export function simulateSystemCard(s: SystemCardState): SystemCardResult {
  const on = CARD_SECTIONS.filter(([k]) => s.sections[k]);
  const has = (k: string) => s.sections[k] === true;
  return {
    score: on.reduce((a, [, , pts]) => a + pts, 0),
    pages: on.length * (s.audience === 'customer' ? 0.25 : 0.8),
    sectionCount: on.length,
    hidesSegment: has('evals') && !has('seg'),
    disclosed: has('seg') && has('limits'),
  };
}
