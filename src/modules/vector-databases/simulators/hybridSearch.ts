/** Hybrid search over a small IT wiki: dense, BM25, RRF and weighted fusion, with tenant filtering before or after ranking. */
export type FusionMethod = 'dense' | 'sparse' | 'rrf' | 'weighted';
export type TenantFilter = 'none' | 'post' | 'pre';
export type WikiQuery = 'q1' | 'q2' | 'q3';
type Tenant = 'eng' | 'fin' | 'hr';

export const WIKI_PAGES: Readonly<Record<string, readonly [title: string, tenant: Tenant]>> = {
  D1: ['VPN setup guide for Windows laptops', 'eng'], D2: ['Working from home: reaching office systems', 'eng'], D3: ['Slow Wi-Fi in the office', 'eng'],
  D4: ['Error 809: L2TP VPN blocked by NAT', 'eng'], D5: ['Okta Verify: re-enrol MFA on a new phone', 'eng'], D6: ['Finance VPN for Tally and SAP', 'fin'],
  D7: ['Reset your Okta password', 'eng'], D8: ['Payroll portal MFA for finance staff', 'fin'], D9: ['Remote desktop gateway error 0x3', 'eng'],
  D10: ['Windows update error codes', 'eng'], D11: ['HR portal: new-joiner laptop request', 'hr'],
};

type Scores = Readonly<Record<string, number>>;
export const WIKI_QUERIES: Readonly<Record<WikiQuery, { readonly text: string; readonly relevant: string; readonly style: string; readonly dense: Scores; readonly sparse: Scores }>> = {
  q1: { text: 'VPN error 809 on Windows', relevant: 'D4', style: 'code-style',
    dense: { D1: 0.82, D6: 0.8, D2: 0.74, D9: 0.71, D4: 0.7, D10: 0.66, D3: 0.52, D7: 0.31, D5: 0.3, D8: 0.28, D11: 0.25 }, sparse: { D4: 14.2, D10: 8.1, D1: 6.3, D6: 4.0, D9: 3.1 } },
  q2: { text: 'working remotely, cannot open internal sites', relevant: 'D2', style: 'meaning-style',
    dense: { D2: 0.79, D6: 0.77, D1: 0.72, D3: 0.65, D9: 0.6, D4: 0.5, D11: 0.35, D10: 0.3, D5: 0.22, D7: 0.21, D8: 0.18 }, sparse: { D9: 5.2, D11: 4.4, D3: 3.9, D2: 3.0, D6: 2.2 } },
  q3: { text: 'new phone, need Okta MFA again', relevant: 'D5', style: 'mixed',
    dense: { D7: 0.78, D5: 0.76, D8: 0.7, D2: 0.4, D1: 0.35, D11: 0.33, D3: 0.28, D4: 0.22, D6: 0.21, D9: 0.2, D10: 0.18 }, sparse: { D5: 7.5, D8: 7.1, D7: 5.0, D11: 2.0 } },
};
const SHOWN = 5;
const isEngineering = (id: string) => WIKI_PAGES[id]?.[1] === 'eng';

export interface HybridState { readonly query: WikiQuery; readonly method: FusionMethod; readonly rrfK: number; readonly alpha: number; readonly filter: TenantFilter }

function rank(query: WikiQuery, s: HybridState) {
  const q = WIKI_QUERIES[query];
  const allowed = (id: string) => s.filter !== 'pre' || isEngineering(id);
  const order = (o: Scores) => Object.keys(o).filter(allowed).sort((a, b) => (o[b] ?? 0) - (o[a] ?? 0));
  const denseList = order(q.dense);
  const sparseList = order(q.sparse);
  const scores: Record<string, number> = {};
  if (s.method === 'dense') denseList.forEach((d) => { scores[d] = q.dense[d] ?? 0; });
  else if (s.method === 'sparse') sparseList.forEach((d) => { scores[d] = q.sparse[d] ?? 0; });
  else if (s.method === 'rrf') {
    for (const list of [denseList, sparseList]) list.forEach((d, i) => { scores[d] = (scores[d] ?? 0) + 1 / (s.rrfK + i + 1); });
  } else {
    const normaliser = (o: Scores, list: readonly string[]) => {
      const v = list.map((d) => o[d] ?? 0);
      const max = Math.max(...v);
      const min = Math.min(...v);
      return (d: string) => (o[d] === undefined ? 0 : ((o[d] ?? 0) - min) / (max - min || 1));
    };
    const nd = normaliser(q.dense, denseList);
    const ns = normaliser(q.sparse, sparseList);
    new Set([...denseList, ...sparseList]).forEach((d) => { scores[d] = s.alpha * nd(d) + (1 - s.alpha) * ns(d); });
  }
  const full = Object.keys(scores).sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0) || +a.slice(1) - +b.slice(1));
  let top = full.slice(0, SHOWN);
  if (s.filter === 'post') top = top.filter(isEngineering);
  return { top, scores, relevantRank: full.indexOf(q.relevant) + 1, leaks: top.filter((id) => !isEngineering(id)).length };
}

export interface HybridResult {
  readonly top: readonly { readonly id: string; readonly score: number }[];
  readonly relevantRank: number;
  readonly ranksAllQueries: readonly number[];
  readonly hits: number;
  readonly shown: number;
  readonly leaks: number;
}

export function simulateHybrid(s: HybridState): HybridResult {
  const current = rank(s.query, s);
  const ranksAllQueries = (['q1', 'q2', 'q3'] as const).map((k) => rank(k, s).relevantRank);
  return {
    top: current.top.map((id) => ({ id, score: current.scores[id] ?? 0 })),
    relevantRank: current.relevantRank,
    ranksAllQueries,
    hits: ranksAllQueries.filter((r) => r >= 1 && r <= 3).length,
    shown: current.top.length,
    leaks: current.leaks,
  };
}
