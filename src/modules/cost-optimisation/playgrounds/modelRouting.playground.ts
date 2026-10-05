import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent, formatWholePercent, joinWithAnd } from '@/shared/format';
import { ALL_LARGE_DAILY_USD, DAILY_REQUESTS, REQUEST_TYPES, simulateModelRouting, type ModelRoutingResult, type ModelRoutingState, type Route } from '../simulators/modelRouting';

const ROUTES = [{ value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }, { value: 'cascade', label: 'Cascade' }];
const routes = (faq: Route, extraction: Route, tax: Route, complaints: Route, validatorCatch = 0.9): ModelRoutingState => ({ faq, extraction, tax, complaints, validatorCatch });
const pct1 = (v: number) => formatPercent(v, 1);

export const modelRoutingPlayground = definePlayground<ModelRoutingState, ModelRoutingResult>({
  techniqueId: 'routing',
  title: 'Choose a route for each request type',
  controls: [
    ...REQUEST_TYPES.map((t) => ({ kind: 'choice' as const, key: t.key, label: `${t.name} · ${formatWholePercent(t.share)} of traffic · passes: small ${formatWholePercent(t.passSmall)}, large ${formatWholePercent(t.passLarge)}`, options: ROUTES })),
    { kind: 'steps', key: 'validatorCatch', label: 'Validator catches this share of bad small-model answers (Cascade only)', values: Array.from({ length: 21 }, (_, i) => i / 20), format: formatWholePercent },
  ],
  presets: {
    start: { state: routes('large', 'large', 'large', 'large'), expected: { spend: 1, success: 0.9805, latencyS: 2.4 } },
    naive: { state: routes('small', 'small', 'small', 'small'), expected: { spend: 0.05, success: 0.895 } },
    rules: { state: routes('small', 'small', 'large', 'large'), expected: { spend: 0.24, success: 0.959 } },
  },
  initialPreset: 'start',
  simulate: simulateModelRouting,
  outputs: [
    { kind: 'meter', label: 'Spend vs all-large', value: (r) => r.spend, detail: (r) => `= $${Math.round(r.spend * ALL_LARGE_DAILY_USD)} a day vs $${ALL_LARGE_DAILY_USD} on the large model`, emphasis: (r) => (r.spend > 0.5 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Success rate', value: (r) => r.success, detail: (r) => `= ${pct1(r.success)} answered correctly · all-large ${pct1(r.allLargeSuccess)}`, emphasis: (r) => (r.success < 0.95 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Escalated to large', value: (r) => r.escalated, detail: (r) => `= ${formatCount(Math.round(r.escalated * DAILY_REQUESTS))} requests a day pay for both models` },
    { kind: 'value', label: 'Average latency', value: (r) => `${r.latencyS.toFixed(2)} s`, detail: () => 'small 0.6 s · large 2.4 s · an escalation pays both' },
    { kind: 'table', columns: ['Type', 'Route', 'Success', 'Cost'], rows: (r) => r.rows.map((row) => [row.type.name, row.route, formatWholePercent(row.success), `${row.relativeCost.toFixed(2)}×`]) },
  ],
  verdict: (r) => (r.success >= 0.97 && r.spend <= 0.3
    ? { tone: 'ok', headline: 'Cheap and accurate.', detail: 'Most traffic runs on the small model and quality is close to all-large.' }
    : r.success < 0.95
      ? { tone: 'no', headline: 'Too many wrong answers.', detail: 'Hard requests are reaching a model that can’t handle them.' }
      : { tone: 'mid', headline: 'Works, but leaves savings or quality on the table.', detail: 'Try a cascade on the types where the small model is usually right.' }),
  narrate: (r, s) => {
    const weak = r.rows.filter((row) => row.route === 'small' && row.type.passSmall < 0.9);
    const parts = [r.allLarge ? `Every request goes to the large model, so spend is the full $${ALL_LARGE_DAILY_USD} a day.` : `Spend is ${formatWholePercent(r.spend)} of the all-large bill: about $${Math.round(r.spend * ALL_LARGE_DAILY_USD)} a day instead of $${ALL_LARGE_DAILY_USD}.`];
    parts.push(weak.length ? `${joinWithAnd(weak.map((w) => w.type.name))} on the small model pass only ${joinWithAnd(weak.map((w) => formatWholePercent(w.type.passSmall)))}, so success falls to ${pct1(r.success)}.` : `Success is ${pct1(r.success)}, against ${pct1(r.allLargeSuccess)} with everything on the large model.`);
    if (r.rows.some((row) => row.route === 'cascade')) parts.push(`Cascaded types start small; the validator catches ${formatWholePercent(s.validatorCatch)} of bad answers and re-asks them on the large model, so ${pct1(r.escalated)} of traffic pays for both calls.`);
    return parts.join(' ');
  },
  missions: {
    cheap: ({ result }) => result.spend < 0.2 && result.success >= 0.97,
    match: ({ result }) => result.spend <= 0.2 && result.success >= result.allLargeSuccess - 1e-9,
    fall: ({ result }) => result.allCascade && result.success < 0.95,
  },
});
