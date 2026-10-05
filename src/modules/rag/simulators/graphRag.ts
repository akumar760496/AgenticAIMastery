/** Sahayak Telecom (fictional): 5,000 outage and complaint reports; facts, multi-hop joins and corpus-wide themes. ₹ costs illustrative. */
export type GraphMode = 'vector' | 'local' | 'global' | 'route';
export interface GraphRagState { readonly mode: GraphMode; readonly themeShare: number; readonly lazy: boolean }
export interface GraphRagResult { readonly facts: number; readonly multiHop: number; readonly themes: number; readonly overall: number; readonly indexRupees: number; readonly per1000Rupees: number }

const QUALITY: Readonly<Record<GraphMode, readonly [number, number, number]>> = { vector: [0.85, 0.5, 0.3], local: [0.83, 0.78, 0.45], global: [0.6, 0.55, 0.8], route: [0.85, 0.78, 0.8] };
const QUERY_COST: Readonly<Partial<Record<GraphMode, number>>> = { vector: 250, local: 600, global: 3000 };
const round2 = (v: number) => Math.round(v * 100) / 100;

export function simulateGraphRag(s: GraphRagState): GraphRagResult {
  const [f, m, t] = QUALITY[s.mode];
  const lazyLoss = s.lazy && s.mode !== 'vector' ? 0.03 : 0;
  const facts = s.mode === 'route' ? f : f - lazyLoss; const multiHop = m - lazyLoss; const themes = t - lazyLoss;
  const g = s.themeShare;
  return {
    facts: round2(facts), multiHop: round2(multiHop), themes: round2(themes),
    overall: Math.round(((1 - g) * (0.6 * facts + 0.4 * multiHop) + g * themes) * 1000) / 1000,
    indexRupees: s.mode === 'vector' ? 300 : s.lazy ? 1500 : 18000,
    per1000Rupees: Math.round(QUERY_COST[s.mode] ?? (1 - g) * 600 + g * 3000 + 50),
  };
}
