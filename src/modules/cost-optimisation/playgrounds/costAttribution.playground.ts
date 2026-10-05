import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateCostAttribution, type CostAttributionResult, type CostAttributionState } from '../simulators/costAttribution';

const inr = (v: number) => `₹${formatCount(v)}`;
const meetsTarget = (r: CostAttributionResult) => r.wasteInr <= 20000 && r.legitimateStops <= 100 && r.attributed >= 0.95;
const TAG_STORY: Readonly<Record<CostAttributionState['tags'], string>> = {
  none: 'With one provider bill, nobody can tell which feature or customer the spend belongs to',
  feature: 'Feature tags show where money goes, but not which run or customer',
  full: 'Every call carries team, feature, customer and run tags',
};

export const costAttributionPlayground = definePlayground<CostAttributionState, CostAttributionResult>({
  techniqueId: 'costattr',
  title: 'Control Vyapar Sathi’s LLM bill (fictional SME platform)',
  controls: [
    { kind: 'select', key: 'tags', label: 'Tags on each call', options: [{ value: 'none', label: 'None: one provider bill' }, { value: 'feature', label: 'Feature only' }, { value: 'full', label: 'Team, feature, customer and run id' }] },
    { kind: 'select', key: 'guard', label: 'Guards', options: [{ value: 'none', label: 'None' }, { value: 'alert', label: 'Alerts at 80% of budget' }, { value: 'hard', label: 'Hard stops at the most specific tag available' }] },
    { kind: 'toggle', key: 'anomalyAlerts', label: 'Flag spend spikes (3× baseline) by tag', isEnabled: (s) => s.tags !== 'none' },
  ],
  presets: {
    start: { state: { tags: 'none', guard: 'none', anomalyAlerts: false }, expected: { attributed: 0, wasteInr: 200000, billInr: 800000 } },
    tagged: { state: { tags: 'full', guard: 'alert', anomalyAlerts: false }, expected: { attributed: 0.98, runawayInr: 45000, abuseInr: 80000 } },
    alerts: { state: { tags: 'full', guard: 'alert', anomalyAlerts: true }, expected: { wasteInr: 57000, legitimateStops: 0 } },
    guarded: { state: { tags: 'full', guard: 'hard', anomalyAlerts: true }, expected: { wasteInr: 14000, billInr: 614000, legitimateStops: 40 } },
  },
  initialPreset: 'start',
  simulate: simulateCostAttribution,
  outputs: [
    { kind: 'meter', label: 'Spend attributed', value: (r) => r.attributed, emphasis: (r) => (r.attributed < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Runaway loops', value: (r) => inr(r.runawayInr) },
    { kind: 'value', label: 'Free-tier abuse', value: (r) => inr(r.abuseInr) },
    { kind: 'value', label: 'Monthly bill', value: (r) => inr(r.billInr), emphasis: (r) => (r.wasteInr > 100000 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Legitimate runs stopped', value: (r) => `${formatCount(r.legitimateStops)} a month`, emphasis: (r) => (r.legitimateStops > 100 ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (meetsTarget(r)) return { tone: 'ok', headline: 'Visible and bounded.', detail: 'Each run and customer has its own limit.' };
    if (r.legitimateStops > 1000) return { tone: 'no', headline: 'The cap hurts more than it helps.', detail: 'Without run or customer tags, a hard stop halts everyone.' };
    if (r.wasteInr > 150000) return { tone: 'no', headline: 'Nobody can say where the money went.', detail: 'Tag every call first.' };
    return { tone: 'mid', headline: 'Visible, but still leaking.', detail: 'Add per-run and per-customer limits.' };
  },
  narrate: (r, s) => `${TAG_STORY[s.tags]}. Waste is ${inr(r.wasteInr)} a month, and ${formatCount(r.legitimateStops)} legitimate runs are stopped.`,
  missions: {
    best: ({ result }) => meetsTarget(result),
    blind: ({ state, result }) => state.guard === 'hard' && result.legitimateStops > 1000,
    alert: ({ state, result }) => state.guard === 'alert' && result.wasteInr <= 60000,
  },
});
