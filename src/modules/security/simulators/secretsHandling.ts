/** Where an agent's API keys live: in the prompt, the tool environment or a broker, with output scanning and lifetimes. */
export type SecretLocation = 'prompt' | 'env' | 'broker';
export type Lifetime = '90d' | '1h';
const EXTRACTION: Readonly<Record<SecretLocation, number>> = { prompt: 0.45, env: 0.15, broker: 0.01 };
const TRACE_EXPOSURE: Readonly<Record<SecretLocation, number>> = { prompt: 1000, env: 20, broker: 0 };
const ATTEMPTS_PER_QUARTER = 40;

export interface SecretsState { readonly location: SecretLocation; readonly scanOutputs: boolean; readonly lifetime: Lifetime }
export interface SecretsResult { readonly extractionSuccess: number; readonly leakedPerQuarter: number; readonly usableHours: number; readonly tracesWithSecretPer1000: number }

export function simulateSecrets(s: SecretsState): SecretsResult {
  let asr = EXTRACTION[s.location];
  if (s.scanOutputs) asr *= 0.3;
  asr = Math.round(asr * 1000) / 1000;
  return { extractionSuccess: asr, leakedPerQuarter: Math.round(ATTEMPTS_PER_QUARTER * asr), usableHours: s.lifetime === '1h' ? 1 : 2160, tracesWithSecretPer1000: s.scanOutputs ? 0 : TRACE_EXPOSURE[s.location] };
}
