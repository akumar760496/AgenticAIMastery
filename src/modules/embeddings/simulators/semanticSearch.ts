/** Dense semantic search over eight help-centre articles: top-k, a similarity floor and a mismatched query model. */
export type HelpQuery = 'refund' | 'order' | 'login' | 'code';
export interface HelpArticle { readonly id: string; readonly title: string }

export const ARTICLES: readonly HelpArticle[] = [
  { id: 'D1', title: 'Refund policy for returned items' }, { id: 'D2', title: 'Store credit instead of a refund' },
  { id: 'D3', title: 'Print a return shipping label' }, { id: 'D4', title: 'Track your parcel' },
  { id: 'D5', title: 'Delivery times by PIN code' }, { id: 'D6', title: 'Reset your password' },
  { id: 'D7', title: 'Log in with an OTP' }, { id: 'D8', title: 'Error E1045: session expired' },
];

interface QueryData { readonly text: string; readonly relevant: readonly string[]; readonly scores: readonly number[]; readonly mismatchedScores: readonly number[] }
export const QUERIES: Readonly<Record<HelpQuery, QueryData>> = {
  refund: { text: '“can I get my money back?”', relevant: ['D1', 'D2', 'D3'], scores: [0.71, 0.58, 0.44, 0.22, 0.12, 0.08, 0.1, 0.15], mismatchedScores: [0.09, 0.03, 0.05, 0.16, 0.21, 0.07, 0.18, 0.02] },
  order: { text: '“where is my order?”', relevant: ['D4', 'D5'], scores: [0.27, 0.18, 0.38, 0.74, 0.55, 0.09, 0.11, 0.12], mismatchedScores: [0.14, 0.22, 0.08, 0.04, 0.06, 0.19, 0.12, 0.17] },
  login: { text: '“I can’t sign in”', relevant: ['D6', 'D7', 'D8'], scores: [0.06, 0.09, 0.05, 0.07, 0.04, 0.63, 0.59, 0.41], mismatchedScores: [0.2, 0.17, 0.23, 0.08, 0.15, 0.05, 0.03, 0.11] },
  code: { text: '“E1045”', relevant: ['D8'], scores: [0.25, 0.39, 0.3, 0.28, 0.22, 0.43, 0.46, 0.37], mismatchedScores: [0.12, 0.18, 0.09, 0.21, 0.11, 0.14, 0.06, 0.04] },
};

export interface SemanticSearchState { readonly query: HelpQuery; readonly k: number; readonly minSimilarity: number; readonly mismatchedModel: boolean }
export interface RankedArticle { readonly article: HelpArticle; readonly score: number; readonly relevant: boolean; readonly returned: boolean }
export interface SemanticSearchResult {
  readonly ranked: readonly RankedArticle[];
  readonly returned: number;
  readonly relevantReturned: number;
  readonly recall: number;
  readonly precision: number;
  readonly topRelevant: boolean;
  readonly missed: readonly string[];
}

export function simulateSemanticSearch(s: SemanticSearchState): SemanticSearchResult {
  const q = QUERIES[s.query];
  const scores = s.mismatchedModel ? q.mismatchedScores : q.scores;
  const sorted = ARTICLES.map((article, i) => ({ article, score: scores[i] ?? 0, relevant: q.relevant.includes(article.id) })).sort((a, b) => b.score - a.score);
  const ranked = sorted.map((r, i) => ({ ...r, returned: i < s.k && r.score >= s.minSimilarity - 1e-9 }));
  const got = ranked.filter((r) => r.returned);
  const hit = got.filter((r) => r.relevant).length;
  return {
    ranked, returned: got.length, relevantReturned: hit,
    recall: hit / q.relevant.length,
    precision: got.length ? hit / got.length : 0,
    topRelevant: Boolean(got[0]?.relevant),
    missed: q.relevant.filter((id) => !got.some((g) => g.article.id === id)),
  };
}
