/** Serving an 8B model: plain generate, static batching or continuous batching, by GPUs and load. */
export type ServingEngine = 'hf' | 'static' | 'vllm';
export const GPU_OPTIONS = [1, 2, 4] as const;
export const LOAD_OPTIONS = [2, 8, 20] as const;
const CAPACITY_TOK_S: Readonly<Record<ServingEngine, number>> = { hf: 60, static: 600, vllm: 3000 };
const BASE_P95_S: Readonly<Record<ServingEngine, number>> = { hf: 5, static: 8, vllm: 6 };
const TOKENS_PER_ANSWER = 300;
const GPU_INR_PER_HOUR = 220;
const OVERLOAD = 0.95;

export interface LlmServingState { readonly engine: ServingEngine; readonly gpus: number; readonly requestsPerSecond: number }
export interface LlmServingResult { readonly capacity: number; readonly demand: number; readonly utilisation: number; readonly overloaded: boolean; readonly p95S: number | null; readonly costPerMillionInr: number }

export function simulateLlmServing(s: LlmServingState): LlmServingResult {
  const demand = s.requestsPerSecond * TOKENS_PER_ANSWER;
  const capacity = CAPACITY_TOK_S[s.engine] * s.gpus;
  const rho = Math.round((demand / capacity) * 1000) / 1000;
  const overloaded = rho >= OVERLOAD;
  const served = Math.min(demand, capacity);
  return {
    capacity, demand, utilisation: Math.min(1, rho), overloaded,
    p95S: overloaded ? null : Math.round(BASE_P95_S[s.engine] * (1 + (0.5 * rho) / (1 - rho)) * 10) / 10,
    costPerMillionInr: Math.round(((s.gpus * GPU_INR_PER_HOUR) / ((served * 3600) / 1e6)) * 10) / 10,
  };
}
