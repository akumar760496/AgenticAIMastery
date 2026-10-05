import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount } from '@/shared/format';
import { simulateMultiTenancy, type MultiTenancyResult, type MultiTenancyState } from '../simulators/multiTenancy';

const inr = (v: number) => `₹${formatCount(v)}`;

export const multiTenancyPlayground = definePlayground<MultiTenancyState, MultiTenancyResult>({
  techniqueId: 'tenancy',
  title: 'LendStack’s shared store (fictional SaaS)',
  controls: [
    { kind: 'select', key: 'isolation', label: 'Isolation model', options: [{ value: 'filter', label: 'Shared index, tenant filter added in app code' }, { value: 'namespace', label: 'Namespace per client' }, { value: 'rls', label: 'Postgres row-level security' }] },
    { kind: 'select', key: 'sync', label: 'ACL sync from source systems', options: [{ value: '24', label: 'Every 24 hours (nightly)' }, { value: '1', label: 'Every hour' }, { value: 'change', label: 'On change (webhook)' }] },
    { kind: 'select', key: 'check', label: 'Where permission is checked', options: [{ value: 'prompt', label: 'A prompt instruction to the model' }, { value: 'after', label: 'In app code, after retrieval' }, { value: 'query', label: 'In the query, before ranking' }] },
    { kind: 'note', text: 'Red-team test: 1,000 queries, 500 trying to reach another client’s chunks and 500 trying to reach documents the user’s groups may not open. One of ten endpoints forgets the tenant filter; group names such as pune-credit exist at many clients.' },
  ],
  presets: {
    start: { state: { isolation: 'filter', sync: '24', check: 'prompt' }, expected: { leaks: 330, crossTenantLeaks: 30, staleExposures: 1440, p95Ms: 70, costInr: 400000 } },
    after: { state: { isolation: 'filter', sync: '1', check: 'after' }, expected: { aclLeaks: 0, crossTenantLeaks: 20, staleExposures: 60, p95Ms: 100, costInr: 425000 } },
    namespace: { state: { isolation: 'namespace', sync: 'change', check: 'query' }, expected: { leaks: 0, staleExposures: 2, p95Ms: 53, costInr: 455000 } },
    rls: { state: { isolation: 'rls', sync: 'change', check: 'query' }, expected: { leaks: 0, staleExposures: 2, p95Ms: 103, costInr: 405000 } },
  },
  initialPreset: 'start',
  simulate: simulateMultiTenancy,
  outputs: [
    { kind: 'value', label: 'Leaks in the red-team test', value: (r) => `${formatCount(r.leaks)} of 1,000`, detail: (r) => `cross-tenant: ${r.crossTenantLeaks} of 500 · forbidden documents within a client: ${r.aclLeaks} of 500`, emphasis: (r) => (r.leaks ? 'warn' : 'normal') },
    { kind: 'value', label: 'Stale-permission exposures', value: (r) => `${formatCount(r.staleExposures)} a day` },
    { kind: 'value', label: 'p95 retrieval latency', value: (r) => `${r.p95Ms} ms` },
    { kind: 'value', label: 'Ops cost', value: (r) => `${inr(r.costInr)} a month` },
    { kind: 'value', label: 'Erase one client on offboarding', value: (r) => r.eraseTime },
  ],
  verdict: (r) => {
    if (!r.leaks && r.staleExposures <= 5) return { tone: 'ok', headline: 'Isolated and fresh.', detail: 'The tenant and the ACL are enforced below the app, and revocations reach the index within a minute.' };
    if (r.aclLeaks) return { tone: 'no', headline: 'The model is the only guard.', detail: 'A prompt instruction is not a permission check; injected questions talk the model past it.' };
    if (r.crossTenantLeaks) return { tone: 'no', headline: 'Another client’s data still leaks.', detail: 'The ACL check stops forbidden documents, but shared group names let the unfiltered endpoint reach other clients.' };
    return { tone: 'mid', headline: 'Revoked access lingers.', detail: 'Sync ACL changes on events rather than on a timer.' };
  },
  narrate: (r, s) => [
    s.isolation === 'filter' ? 'Every endpoint must remember to add the tenant filter, and the new “similar loans” endpoint does not, so 50 cross-tenant probes search all 400 clients.' : s.isolation === 'namespace' ? 'Each client has its own namespace, chosen from the verified token, so no query can reach another client’s vectors.' : 'Row-level security applies the tenant to every query, including the one whose code forgot it.',
    s.check === 'prompt' ? `Permission is only a prompt instruction, so red-team questions extract ${r.aclLeaks} forbidden documents.` : s.check === 'after' ? 'App code drops forbidden chunks after retrieval, so nothing forbidden within a client gets through, but it over-fetches and adds 30 ms.' : 'The ACL filter runs inside the query, so only allowed chunks are ranked.',
    r.crossTenantLeaks && s.check !== 'prompt' ? `Group names like pune-credit exist at other clients too, so ${r.crossTenantLeaks} foreign chunks pass the check.` : '',
    `Revoked users make about ${formatCount(r.staleExposures)} stale retrievals a day. p95 is ${r.p95Ms} ms and the setup costs ${inr(r.costInr)} a month; erasing a departing client takes ${r.eraseTime}.`,
  ].filter(Boolean).join(' '),
  missions: {
    fast: ({ result }) => result.leaks === 0 && result.p95Ms <= 60,
    fresh: ({ result }) => result.leaks === 0 && result.staleExposures <= 5 && result.costInr <= 410000,
    groups: ({ state, result }) => state.isolation === 'filter' && state.check !== 'prompt' && result.aclLeaks === 0 && result.crossTenantLeaks > 0,
  },
});
