import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatPercent } from '@/shared/format';
import { simulateSecrets, type SecretLocation, type SecretsResult, type SecretsState } from '../simulators/secretsHandling';

const LOCATION_STORY: Readonly<Record<SecretLocation, string>> = {
  prompt: 'The key sits in the system prompt, so any answer, trace or injected “repeat your instructions” can expose it',
  env: 'The key is in the tool process environment, so code the agent runs can print it',
  broker: 'Only the broker reads the key from the vault; the agent sees results',
};

export const secretsHandlingPlayground = definePlayground<SecretsState, SecretsResult>({
  techniqueId: 'secrets',
  title: 'Keep the agent’s API keys out of reach',
  intro: 'About 40 extraction attempts a quarter target the agent’s credentials.',
  controls: [
    { kind: 'select', key: 'location', label: 'Where credentials live', options: [{ value: 'prompt', label: 'In the system prompt' }, { value: 'env', label: 'Environment of the tool process the agent runs' }, { value: 'broker', label: 'In a vault, used only by a broker' }] },
    { kind: 'toggle', key: 'scanOutputs', label: 'Scan outputs, logs and traces for secret patterns' },
    { kind: 'select', key: 'lifetime', label: 'Credential lifetime', options: [{ value: '90d', label: 'Static, rotated every 90 days' }, { value: '1h', label: 'Dynamic, expires in 1 hour' }] },
  ],
  presets: {
    start: { state: { location: 'prompt', scanOutputs: false, lifetime: '90d' }, expected: { extractionSuccess: 0.45, leakedPerQuarter: 18, tracesWithSecretPer1000: 1000 } },
    env: { state: { location: 'env', scanOutputs: false, lifetime: '90d' }, expected: { extractionSuccess: 0.15, leakedPerQuarter: 6, tracesWithSecretPer1000: 20 } },
    scanned: { state: { location: 'env', scanOutputs: true, lifetime: '1h' }, expected: { extractionSuccess: 0.045, leakedPerQuarter: 2, usableHours: 1 } },
    broker: { state: { location: 'broker', scanOutputs: true, lifetime: '1h' }, expected: { extractionSuccess: 0.003, leakedPerQuarter: 0, tracesWithSecretPer1000: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateSecrets,
  outputs: [
    { kind: 'meter', label: 'Extraction success', value: (r) => r.extractionSuccess, detail: (r) => `= ${formatPercent(r.extractionSuccess, 1)}`, emphasis: (r) => (r.extractionSuccess > 0.01 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Keys leaked a quarter', value: (r) => String(r.leakedPerQuarter), emphasis: (r) => (r.leakedPerQuarter ? 'warn' : 'normal') },
    { kind: 'value', label: 'A leaked key stays usable for', value: (r) => (r.usableHours === 1 ? '1 hour' : `${r.usableHours} hours`) },
    { kind: 'value', label: 'Traces containing a secret (per 1,000)', value: (r) => String(r.tracesWithSecretPer1000), emphasis: (r) => (r.tracesWithSecretPer1000 ? 'warn' : 'normal') },
  ],
  verdict: (r) => (r.extractionSuccess <= 0.01 && r.usableHours <= 1 && r.tracesWithSecretPer1000 === 0
    ? { tone: 'ok', headline: 'Nothing to steal, nothing to find.', detail: 'A broker holds the key, traces are scanned and tokens expire within the hour.' }
    : r.extractionSuccess > 0.1 ? { tone: 'no', headline: 'The key is in reach.', detail: 'Keep credentials out of anything the model can read or run.' } : { tone: 'mid', headline: 'Harder to steal, still exposed.', detail: 'Use a broker and short-lived credentials.' }),
  narrate: (r, s) => `${LOCATION_STORY[s.location]}. ${s.scanOutputs ? 'Outputs, logs and traces are scanned for secret patterns. ' : ''}Extraction succeeds ${formatPercent(r.extractionSuccess, 1)} of the time: about ${r.leakedPerQuarter} keys a quarter, each usable for ${r.usableHours === 1 ? 'an hour' : '90 days'}.`,
  missions: {
    best: ({ result }) => result.extractionSuccess <= 0.01 && result.usableHours <= 1 && result.tracesWithSecretPer1000 === 0,
    scan: ({ state, result }) => state.location === 'prompt' && result.tracesWithSecretPer1000 === 0,
    window: ({ result }) => result.leakedPerQuarter >= 1 && result.usableHours <= 1,
  },
});
