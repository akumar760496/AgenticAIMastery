/**
 * Query planning over a 96-laptop catalogue. The planner is scripted: it writes “60k” as 60, and assumes “this year” is 2024
 * unless told the date. LLM call ≈ 700 ms, search ≈ 40 ms.
 */
export type RequestId = 'r1' | 'r2' | 'r3';
export interface Laptop { readonly id: number; readonly brand: string; readonly year: number; readonly price: number; readonly battery: number; readonly rtx: boolean; readonly kg: number }
export interface SearchPlan { readonly query: string; readonly max_price?: number; readonly year?: number; readonly rtx?: boolean; readonly brand?: string }
export interface QueryPlanningState { readonly request: RequestId; readonly extract: boolean; readonly validate: boolean; readonly giveDate: boolean; readonly retry: boolean }
export interface QueryPlanningResult {
  readonly plan: SearchPlan | null; readonly returned: number; readonly correct: number; readonly precision: number; readonly llmCalls: number; readonly searches: number;
  readonly latencyMs: number; readonly notes: readonly string[]; readonly silentlyWrong: boolean; readonly allRequestsCorrect: boolean;
}

const BRANDS = ['Acer', 'Apple', 'Asus', 'Dell', 'HP', 'Lenovo'];
export const CATALOGUE: readonly Laptop[] = Array.from({ length: 96 }, (_, i) => ({
  id: i, brand: BRANDS[i % 6] ?? 'Acer', year: 2023 + (Math.floor(i / 6) % 4), price: 24000 + ((i * 37) % 17) * 5000,
  battery: 6 + ((i * 11) % 9), rtx: i % 4 === 1 || i % 4 === 2, kg: Number((1.1 + ((i * 13) % 10) * 0.12).toFixed(2)),
}));

interface RequestSpec { readonly text: string; readonly relevance: (x: Laptop) => number; readonly meets: (x: Laptop) => boolean; readonly plan: (fixed: boolean, dated: boolean) => SearchPlan; readonly mistake: string | null }
export const REQUESTS: Readonly<Record<RequestId, RequestSpec>> = {
  r1: { text: '2024 laptops under INR 60k with long battery life', relevance: (x) => x.battery + (x.id % 3) * 0.1, meets: (x) => x.year === 2024 && x.price < 60000,
    plan: (fixed) => ({ query: 'long battery life laptop', max_price: fixed ? 60000 : 60, year: 2024 }), mistake: 'writes max_price = 60 (thousands) instead of 60,000' },
  r2: { text: 'gaming laptops with RTX, launched this year', relevance: (x) => (x.rtx ? 5 : 0) + x.battery * 0.05 - x.kg * 0.2 + (x.id % 5) * 0.01, meets: (x) => x.rtx && x.year === 2026,
    plan: (_fixed, dated) => ({ query: 'gaming laptop', rtx: true, year: dated ? 2026 : 2024 }), mistake: 'assumes “this year” is 2024 unless told the date' },
  r3: { text: 'Lenovo ultrabook under 1 lakh', relevance: (x) => (x.brand === 'Lenovo' ? 1.2 : 0) - x.kg * 2 + (x.id % 7) * 0.01, meets: (x) => x.brand === 'Lenovo' && x.price < 100000,
    plan: () => ({ query: 'thin and light ultrabook', brand: 'Lenovo', max_price: 100000 }), mistake: null },
};
const LLM_MS = 700; const SEARCH_MS = 40; const TOP_K = 10; const MIN_PRICE = 10000;

function run(request: RequestId, s: QueryPlanningState) {
  const spec = REQUESTS[request];
  let llmCalls = 0; let searches = 0; let plan: SearchPlan | null = null; const notes: string[] = [];
  const search = (p: Partial<SearchPlan>) => {
    searches += 1;
    return CATALOGUE.filter((x) => (p.max_price == null || x.price < p.max_price) && (p.year == null || x.year === p.year) && (!p.rtx || x.rtx) && (!p.brand || x.brand === p.brand))
      .sort((a, b) => spec.relevance(b) - spec.relevance(a)).slice(0, TOP_K);
  };
  let hits: Laptop[];
  if (!s.extract) { hits = search({}); notes.push('No plan: plain vector search over the whole catalogue.'); }
  else {
    llmCalls += 1; plan = spec.plan(false, s.giveDate);
    if (s.validate && plan.max_price != null && plan.max_price < MIN_PRICE) {
      notes.push(`Validation rejected max_price = ${plan.max_price} (below INR 10,000) before any search ran.`);
      llmCalls += 1; plan = spec.plan(true, s.giveDate);
    }
    hits = search(plan);
    if (s.retry && hits.length < 3) {
      notes.push(`Self-check: only ${hits.length} results, so the agent re-planned once.`);
      llmCalls += 1; plan = spec.plan(true, s.giveDate); hits = search(plan);
    }
  }
  const correct = hits.filter(spec.meets).length;
  return { plan, returned: hits.length, correct, precision: hits.length ? correct / hits.length : 0, llmCalls, searches, latencyMs: llmCalls * LLM_MS + searches * SEARCH_MS, notes, silentlyWrong: plan !== null && hits.length >= 3 && correct === 0 };
}

export function simulateQueryPlanning(s: QueryPlanningState): QueryPlanningResult {
  const current = run(s.request, s);
  const all = (Object.keys(REQUESTS) as RequestId[]).map((k) => run(k, s));
  return { ...current, allRequestsCorrect: all.every((r) => r.returned === TOP_K && r.precision === 1) };
}
