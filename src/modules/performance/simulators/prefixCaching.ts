/** Prefix (KV) caching across replicas for eight tenants, each replica holding four tenants' prefixes. */
export const TENANTS = 8;
export const PREFIXES_PER_REPLICA = 4;
export const PREFILL_TOKENS_PER_SECOND = 10000;

export interface PrefixCachingState { readonly prefixTokens: number; readonly newTokens: number; readonly cachingOn: boolean; readonly timestampFirst: boolean; readonly replicas: number; readonly cacheAwareRouting: boolean }
export interface PrefixCachingResult { readonly tenantsPerReplica: number; readonly hitRate: number; readonly prefilledTokens: number; readonly totalTokens: number; readonly ttftS: number; readonly uncachedTtftS: number; readonly reused: number }

export function simulatePrefixCaching(s: PrefixCachingState): PrefixCachingResult {
  const tenantsPerReplica = s.cacheAwareRouting ? TENANTS / s.replicas : TENANTS;
  // Each block hash includes its parent, so any change in the first block defeats every later block.
  const hitRate = !s.cachingOn || s.timestampFirst ? 0 : Math.min(1, PREFIXES_PER_REPLICA / tenantsPerReplica);
  const prefilledTokens = s.prefixTokens * (1 - hitRate) + s.newTokens;
  const totalTokens = s.prefixTokens + s.newTokens;
  return {
    tenantsPerReplica, hitRate, prefilledTokens, totalTokens,
    ttftS: prefilledTokens / PREFILL_TOKENS_PER_SECOND,
    uncachedTtftS: totalTokens / PREFILL_TOKENS_PER_SECOND,
    reused: 1 - prefilledTokens / totalTokens,
  };
}
