/** Tenant isolation and ACL enforcement for a (fictional) loan-servicing SaaS, scored by a 1,000-query red-team test. */
export type Isolation = 'filter' | 'namespace' | 'rls';
export type AclSync = '24' | '1' | 'change';
export type PermissionCheck = 'prompt' | 'after' | 'query';

/** Cross-tenant probes that hit the one endpoint that forgets the tenant filter. */
const UNFILTERED_PROBES = 50;
const P95_BY_ISOLATION: Readonly<Record<Isolation, number>> = { filter: 70, namespace: 45, rls: 95 };
const P95_BY_CHECK: Readonly<Record<PermissionCheck, number>> = { prompt: 0, after: 30, query: 8 };
const COST_BY_ISOLATION: Readonly<Record<Isolation, number>> = { filter: 320000, namespace: 410000, rls: 360000 };
const COST_BY_SYNC: Readonly<Record<AclSync, number>> = { '24': 20000, '1': 90000, change: 45000 };
const COST_BY_CHECK: Readonly<Record<PermissionCheck, number>> = { prompt: 60000, after: 15000, query: 0 };
/** 2,400 revocations a day × 5% retrieval rate per hour × average hours stale. */
const STALE_BY_SYNC: Readonly<Record<AclSync, number>> = { '24': 1440, '1': 60, change: 2 };
export const ERASE_TIME: Readonly<Record<Isolation, string>> = { filter: 'about 6 hours', namespace: 'about 2 minutes', rls: 'about 40 minutes' };

export interface MultiTenancyState { readonly isolation: Isolation; readonly sync: AclSync; readonly check: PermissionCheck }
export interface MultiTenancyResult { readonly crossTenantLeaks: number; readonly aclLeaks: number; readonly leaks: number; readonly staleExposures: number; readonly p95Ms: number; readonly costInr: number; readonly eraseTime: string }

export function simulateMultiTenancy({ isolation, sync, check }: MultiTenancyState): MultiTenancyResult {
  const unfiltered = isolation === 'filter' ? UNFILTERED_PROBES : 0;
  // Group names such as pune-credit exist at many clients, so an ACL-only check lets some foreign chunks through.
  const crossTenantLeaks = Math.round(unfiltered * (check === 'prompt' ? 0.6 : 0.4));
  const aclLeaks = check === 'prompt' ? 300 : 0;
  return {
    crossTenantLeaks, aclLeaks, leaks: crossTenantLeaks + aclLeaks,
    staleExposures: STALE_BY_SYNC[sync],
    p95Ms: P95_BY_ISOLATION[isolation] + P95_BY_CHECK[check],
    costInr: COST_BY_ISOLATION[isolation] + COST_BY_SYNC[sync] + COST_BY_CHECK[check],
    eraseTime: ERASE_TIME[isolation],
  };
}
