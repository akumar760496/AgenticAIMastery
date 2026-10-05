import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateExfiltration, type ExfiltrationResult, type ExfiltrationState } from '../simulators/exfiltration';

const base: ExfiltrationState = { scope: 'all', images: true, web: true, email: true, allowlist: false, dlp: false, approval: false };

export const exfiltrationPlayground = definePlayground<ExfiltrationState, ExfiltrationResult>({
  techniqueId: 'exfil',
  title: 'Close the exfiltration channels',
  intro: '10,000 sessions a month contain an injection attempt; 5% of them steer the agent. What happens next depends on the channels.',
  controls: [
    { kind: 'select', key: 'scope', label: 'Data the agent can read', options: [{ value: 'all', label: 'Any customer (500 rows a session)' }, { value: 'self', label: 'Only this customer' }] },
    { kind: 'toggle', key: 'images', label: 'Chat renders markdown images' },
    { kind: 'toggle', key: 'web', label: 'Web-fetch tool' },
    { kind: 'toggle', key: 'email', label: 'Email tool' },
    { kind: 'toggle', key: 'allowlist', label: 'Egress allowlist for images and fetch' },
    { kind: 'toggle', key: 'dlp', label: 'DLP scan on outbound email' },
    { kind: 'toggle', key: 'approval', label: 'Human approval for external email' },
  ],
  presets: {
    start: { state: base, expected: { leakShare: 1, recordsPerMonth: 250000 } },
    silent: { state: { ...base, web: false, email: false }, expected: { leakShare: 1, recordsPerMonth: 250000 } },
    scoped: { state: { ...base, scope: 'self', allowlist: true, approval: true }, expected: { recordsPerMonth: 37.325 } },
    tight: { state: { ...base, scope: 'self', allowlist: true, dlp: true, approval: true }, expected: { recordsPerMonth: 9.465 } },
  },
  initialPreset: 'start',
  simulate: simulateExfiltration,
  outputs: [
    { kind: 'meter', label: 'Steered sessions that get data out', value: (r) => r.leakShare, detail: (r) => `= ${formatPercent(r.leakShare, 1)}`, emphasis: (r) => (r.leakShare > 0.05 ? 'warn' : 'normal') },
    { kind: 'table', columns: ['Channel', 'Leak chance'], rows: (r) => [['Rendered images', formatPercent(r.viaImages, 1)], ['Web fetch', formatPercent(r.viaWeb, 1)], ['Email', formatPercent(r.viaEmail, 1)]] },
    { kind: 'value', label: 'Records leaving each month', value: (r) => formatCount(Math.round(r.recordsPerMonth)), emphasis: (r) => (r.recordsPerMonth >= 100 ? 'warn' : 'normal') },
  ],
  verdict: (r) => (r.recordsPerMonth < 10
    ? { tone: 'ok', headline: 'Almost nothing leaves.', detail: 'Every channel is gated and each leak is one record at most.' }
    : r.recordsPerMonth < 100 ? { tone: 'mid', headline: 'A trickle remains.', detail: 'Scan or approve the email channel too.' } : { tone: 'no', headline: 'Data pours out.', detail: 'An open channel and table-wide reads turn one steered session into hundreds of records.' }),
  narrate: (r, s) => [
    `${formatCount(r.steered)} sessions a month are steered by injected text.`,
    s.images && !s.allowlist ? 'Rendered images leak in every one of them, silently, whatever the other tools do.' : '',
    `Overall ${formatPercent(r.leakShare, 1)} of steered sessions get data out, and each leak carries ${s.scope === 'all' ? 'up to 500 customers’ records' : 'one customer’s record'}, so about ${formatCount(Math.round(r.recordsPerMonth))} records leave each month.`,
  ].filter(Boolean).join(' '),
  missions: {
    mail: ({ state, result }) => state.email && result.recordsPerMonth < 100,
    both: ({ state, result }) => state.email && state.web && result.recordsPerMonth < 10,
    silent: ({ state, result }) => state.images && !state.allowlist && !state.web && !state.email && result.leakShare >= 0.999,
  },
});
