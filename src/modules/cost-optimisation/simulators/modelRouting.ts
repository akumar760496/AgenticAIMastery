/** Model routing: send each request type to a small model, a large model, or a validated cascade. */
export type Route = 'small' | 'large' | 'cascade';
export interface RequestType { readonly key: RoutedType; readonly name: string; readonly share: number; readonly passSmall: number; readonly passLarge: number }
export type RoutedType = 'faq' | 'extraction' | 'tax' | 'complaints';

export const REQUEST_TYPES: readonly RequestType[] = [
  { key: 'faq', name: 'FAQs', share: 0.6, passSmall: 0.97, passLarge: 0.99 },
  { key: 'extraction', name: 'Extraction', share: 0.2, passSmall: 0.93, passLarge: 0.98 },
  { key: 'tax', name: 'Tax & portfolio', share: 0.15, passSmall: 0.6, passLarge: 0.95 },
  { key: 'complaints', name: 'Complaints', share: 0.05, passSmall: 0.75, passLarge: 0.96 },
];
export const DAILY_REQUESTS = 50000;
export const ALL_LARGE_DAILY_USD = 500;
const SMALL_COST = 0.05;
const SMALL_LATENCY_S = 0.6;
const LARGE_LATENCY_S = 2.4;

export type ModelRoutingState = Readonly<Record<RoutedType, Route>> & { readonly validatorCatch: number };

export interface RoutedRow { readonly type: RequestType; readonly route: Route; readonly relativeCost: number; readonly success: number; readonly escalated: number }
export interface ModelRoutingResult {
  readonly rows: readonly RoutedRow[];
  /** Spend relative to sending everything to the large model. */
  readonly spend: number;
  readonly success: number;
  readonly escalated: number;
  readonly latencyS: number;
  readonly allLargeSuccess: number;
  readonly allCascade: boolean;
  readonly allLarge: boolean;
}

function routeOne(type: RequestType, route: Route, validatorCatch: number): RoutedRow {
  if (route === 'small') return { type, route, relativeCost: SMALL_COST, success: type.passSmall, escalated: 0 };
  if (route === 'large') return { type, route, relativeCost: 1, success: type.passLarge, escalated: 0 };
  const escalated = (1 - type.passSmall) * validatorCatch;
  return { type, route, relativeCost: SMALL_COST + escalated, success: type.passSmall + validatorCatch * (type.passLarge - type.passSmall), escalated };
}

const weighted = (rows: readonly RoutedRow[], pick: (r: RoutedRow) => number) => rows.reduce((sum, r) => sum + r.type.share * pick(r), 0);

export function simulateModelRouting(state: ModelRoutingState): ModelRoutingResult {
  const rows = REQUEST_TYPES.map((t) => routeOne(t, state[t.key], state.validatorCatch));
  return {
    rows,
    spend: weighted(rows, (r) => r.relativeCost),
    success: weighted(rows, (r) => r.success),
    escalated: weighted(rows, (r) => r.escalated),
    latencyS: weighted(rows, (r) => (r.route === 'small' ? SMALL_LATENCY_S : r.route === 'large' ? LARGE_LATENCY_S : SMALL_LATENCY_S + r.escalated * LARGE_LATENCY_S)),
    allLargeSuccess: REQUEST_TYPES.reduce((sum, t) => sum + t.share * t.passLarge, 0),
    allCascade: rows.every((r) => r.route === 'cascade'),
    allLarge: rows.every((r) => r.route === 'large'),
  };
}
