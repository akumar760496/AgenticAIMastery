/** Deferring a large tool set behind a search tool: coverage of kept tools, search recall, tokens and cost. */
export type SearchMethod = 'regex' | 'bm25' | 'embed';
export type DescriptionStyle = 'terse' | 'full';
/** Share of requests covered by the k most common tools kept loaded. */
const KEPT_COVERAGE = [0, 0.22, 0.36, 0.46, 0.53, 0.58, 0.62, 0.65, 0.68, 0.7, 0.72];
const SEARCH_RECALL: Readonly<Record<SearchMethod, number>> = { regex: 0.8, bm25: 0.88, embed: 0.93 };
const SEARCH_S = 1.2;
const INR_PER_MILLION = 250;

export interface ToolSearchState { readonly tools: number; readonly search: boolean; readonly method: SearchMethod; readonly keep: number; readonly descriptions: DescriptionStyle }
export interface ToolSearchResult { readonly accuracy: number; readonly definitionTokens: number; readonly tokensPerRequest: number; readonly costPer1000: number; readonly addedS: number; readonly misses: number; readonly coverage: number; readonly recall: number }

export function simulateToolSearch(s: ToolSearchState): ToolSearchResult {
  const per = s.descriptions === 'full' ? 180 : 70;
  const cost = (tok: number) => (tok * 1000 * INR_PER_MILLION) / 1e6;
  if (!s.search) {
    const accuracy = Math.max(0.35, s.descriptions === 'full' ? 0.97 - 0.0018 * Math.max(0, s.tools - 40) : 0.9 - 0.0025 * Math.max(0, s.tools - 40));
    const definitionTokens = s.tools * per;
    const tokensPerRequest = 3 * (1500 + definitionTokens);
    return { accuracy, definitionTokens, tokensPerRequest, costPer1000: cost(tokensPerRequest), addedS: 0, misses: 0, coverage: 1, recall: 1 };
  }
  const coverage = KEPT_COVERAGE[s.keep] ?? 0;
  const recall = Math.min(0.99, SEARCH_RECALL[s.method] + (s.descriptions === 'full' ? 0.06 : -0.1) - 0.0002 * s.tools);
  const base = 1500 + 450 + s.keep * per;
  const tokensPerRequest = 3 * base + (1 - coverage) * (base + 2 * 5 * per);
  return {
    accuracy: coverage * 0.98 + (1 - coverage) * recall * 0.97,
    definitionTokens: 450 + s.keep * per, tokensPerRequest, costPer1000: cost(tokensPerRequest),
    addedS: (1 - coverage) * SEARCH_S, misses: (1 - coverage) * (1 - recall), coverage, recall,
  };
}
