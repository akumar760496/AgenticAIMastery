import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatRupees } from '@/shared/format';
import { simulateVendorRisk, type VendorRiskResult, type VendorRiskState } from '../simulators/vendorRisk';

const hoursText = (h: number) => (h < 1 ? `${Math.round(h * 60)} min` : `${h} hours`);
const isGood = (r: VendorRiskResult) => r.findings.length === 0 && r.silentChanges === 0 && r.outageHours < 1;

export const vendorRiskPlayground = definePlayground<VendorRiskState, VendorRiskResult>({
  techniqueId: 'vendor',
  title: 'Run Godavari Bank’s assistant on a vendor’s model',
  intro: 'Godavari Bank, a fictional private bank, summarises 2,00,000 customer complaint conversations a month with an overseas LLM provider. This year the provider has one 8-hour incident. Costs are illustrative yearly figures. Educational, not legal advice.',
  controls: [
    { kind: 'select', key: 'data', label: 'Data terms', options: [{ value: 'default', label: 'Default: logs kept 30 days' }, { value: 'zdr', label: 'Zero data retention agreed' }] },
    { kind: 'select', key: 'version', label: 'Model version', options: [{ value: 'alias', label: 'Floating alias' }, { value: 'pinned', label: 'Pinned snapshot + evals on change' }] },
    { kind: 'select', key: 'providers', label: 'Providers', options: [{ value: 'single', label: 'Single provider' }, { value: 'fallback', label: 'Primary + tested fallback' }] },
    { kind: 'toggle', key: 'exitPlan', label: 'Exit plan documented and rehearsed' },
  ],
  presets: {
    start: { state: { data: 'default', version: 'alias', providers: 'single', exitPlan: false }, expected: { retentionDays: 30, silentChanges: 6, outageHours: 8, extraCost: 0 } },
    terms: { state: { data: 'zdr', version: 'alias', providers: 'single', exitPlan: true }, expected: { retentionDays: 0, silentChanges: 6, extraCost: 720000 } },
    twoalias: { state: { data: 'default', version: 'alias', providers: 'fallback', exitPlan: false }, expected: { silentChanges: 10, outageHours: 0.25, extraCost: 900000 } },
    full: { state: { data: 'zdr', version: 'pinned', providers: 'fallback', exitPlan: true }, expected: { silentChanges: 0, plannedUpgrades: 3, extraCost: 1860000 } },
  },
  initialPreset: 'start',
  simulate: simulateVendorRisk,
  outputs: [
    { kind: 'value', label: 'Days customer data stays at the provider', value: (r) => String(r.retentionDays), detail: (r) => (r.heldConversations ? `about ${formatCount(r.heldConversations)} conversations sitting there at any time` : 'nothing kept after the response'), emphasis: (r) => (r.retentionDays ? 'warn' : 'normal') },
    { kind: 'value', label: 'Silent behaviour changes reaching production', value: (r) => `${r.silentChanges} a year`, detail: (r) => (r.silentChanges ? 'the provider moves the alias; no release on your side' : `${r.plannedUpgrades} planned upgrades a year, each after the eval suite`) },
    { kind: 'value', label: 'Outage impact in the provider incident', value: (r) => hoursText(r.outageHours), emphasis: (r) => (r.outageHours >= 1 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Audit findings', value: (r) => r.findings.length / 4, detail: (r) => `= ${r.findings.length} of 4 possible`, emphasis: (r) => (r.findings.length ? 'warn' : 'normal') },
    { kind: 'value', label: 'Extra cost a year', value: (r) => formatRupees(r.extraCost) },
  ],
  verdict: (r) => {
    if (isGood(r)) return { tone: 'ok', headline: 'Vendor risk under control.', detail: 'Known data terms, reviewed upgrades, a drilled fallback and a written exit.' };
    if (r.findings.length === 0) return { tone: 'mid', headline: 'Clean audit, fragile service.', detail: `An exit plan manages concentration on paper, but an outage still takes the assistant down for ${hoursText(r.outageHours)}.` };
    return { tone: r.findings.length >= 3 ? 'no' : 'mid', headline: r.findings.length >= 3 ? 'The vendor’s risks are your risks.' : 'Partly covered.', detail: `Open: ${r.findings.join('; ')}.` };
  },
  narrate: (r, s) => [
    s.data === 'zdr' ? 'Zero data retention is agreed, so complaint text is not kept after each response.' : 'On default terms the provider keeps logs for 30 days, so about 2,00,000 conversations sit offshore at any time.',
    s.version === 'alias' ? `The floating alias lets ${r.silentChanges} provider-side changes a year reach customers without an eval${s.providers === 'fallback' ? ', because the fallback’s alias moves too' : ''}.` : `Pinned snapshots mean ${r.plannedUpgrades} planned upgrades a year, each through the eval suite.`,
    s.providers === 'fallback' ? 'During the 8-hour incident traffic fails over in about 15 minutes.' : 'During the 8-hour incident the assistant is down for all 8 hours.',
    r.findings.length ? `An inspection finds ${r.findings.length}: ${r.findings.join('; ')}.` : 'An inspection finds nothing to raise.',
    `Extra cost: ${formatRupees(r.extraCost)} a year.`,
  ].join(' '),
  missions: {
    lean: ({ result }) => result.findings.length === 0 && result.extraCost < 1000000,
    resilient: ({ result }) => result.outageHours < 1 && result.silentChanges === 0,
    drift: ({ state, result }) => state.providers === 'fallback' && result.silentChanges > 6,
  },
});
