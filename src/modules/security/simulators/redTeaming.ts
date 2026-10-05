/** Automated red-teaming of 12 hidden weaknesses: budget, categories and attack strategies. */
export type Category = 'inj' | 'exf' | 'agy' | 'leak';
type Tier = 'e' | 'm' | 'h';
export const CATEGORY_LABELS: Readonly<Record<Category, string>> = { inj: 'Prompt hijacking', exf: 'Data exfiltration', agy: 'Excessive agency', leak: 'Prompt leakage' };
const WEAKNESSES: Readonly<Record<Category, readonly Tier[]>> = { inj: ['e', 'e', 'm', 'h'], exf: ['e', 'm', 'h'], agy: ['e', 'm', 'h'], leak: ['e', 'm'] };
const HIT_RATE: Readonly<Record<Tier, number>> = { e: 0.02, m: 0.006, h: 0.004 };
const INR_PER_ATTACK = 0.8;
export const weaknessCount = (c: Category) => WEAKNESSES[c].length;

export interface RedTeamState {
  readonly attacks: number; readonly inj: boolean; readonly exf: boolean; readonly agy: boolean; readonly leak: boolean;
  readonly single: boolean; readonly encodings: boolean; readonly multiTurn: boolean; readonly regressionSuite: boolean;
}
export interface RedTeamResult { readonly found: number; readonly hardFound: number; readonly perCategory: Readonly<Partial<Record<Category, number>>>; readonly costInr: number; readonly categories: number; readonly strategies: number }

export function simulateRedTeam(s: RedTeamState): RedTeamResult {
  const cats = (Object.keys(WEAKNESSES) as Category[]).filter((c) => s[c]);
  const k = [s.single, s.encodings, s.multiTurn].filter(Boolean).length;
  let found = 0; let hardFound = 0;
  const perCategory: Partial<Record<Category, number>> = {};
  for (const c of cats) {
    const perCat = s.attacks / cats.length;
    let f = 0;
    for (const t of WEAKNESSES[c]) {
      // Easy weaknesses yield to any strategy; medium ones need encodings or multi-turn; hard ones only multi-turn.
      const effective = k === 0 ? 0 : t === 'e' ? perCat : t === 'm' ? (perCat * ((s.encodings ? 1 : 0) + (s.multiTurn ? 1 : 0))) / k : (perCat * (s.multiTurn ? 1 : 0)) / k;
      const p = 1 - Math.pow(1 - HIT_RATE[t], effective);
      f += p;
      if (t === 'h') hardFound += p;
    }
    perCategory[c] = f; found += f;
  }
  return { found, hardFound, perCategory, costInr: s.attacks * INR_PER_ATTACK, categories: cats.length, strategies: k };
}
