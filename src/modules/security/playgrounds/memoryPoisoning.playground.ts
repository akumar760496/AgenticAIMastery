import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatPercent } from '@/shared/format';
import { simulateMemoryPoisoning, type MemoryPoisoningResult, type MemoryPoisoningState, type WritePolicy } from '../simulators/memoryPoisoning';

const POLICY_STORY: Readonly<Record<WritePolicy, string>> = {
  any: 'The model saves whatever it reads, including a PDF line about a new refund account',
  classifier: 'A classifier catches obvious injections, but a plain-looking “note” still gets saved',
  provenance: 'Only facts the customer typed become active; anything from documents waits for confirmation',
};

export const memoryPoisoningPlayground = definePlayground<MemoryPoisoningState, MemoryPoisoningResult>({
  techniqueId: 'mempoison',
  title: 'Keep poisoned memories out',
  intro: 'About 50 poisoning attempts a month arrive through documents and chats.',
  controls: [
    { kind: 'select', key: 'policy', label: 'Memory write policy', options: [{ value: 'any', label: 'Save anything the model decides to remember' }, { value: 'classifier', label: 'Save unless an injection classifier objects' }, { value: 'provenance', label: 'Only user-stated facts; untrusted sources quarantined' }] },
    { kind: 'toggle', key: 'quotedData', label: 'Show memories as quoted data with their source' },
    { kind: 'toggle', key: 'audit', label: 'Weekly audit and 90-day expiry' },
  ],
  presets: {
    start: { state: { policy: 'any', quotedData: false, audit: false }, expected: { attackSuccess: 0.38, harmfulPerMonth: 114 } },
    classifier: { state: { policy: 'classifier', quotedData: false, audit: false }, expected: { attackSuccess: 0.14, harmfulPerMonth: 42, usefulKept: 0.93 } },
    provenance: { state: { policy: 'provenance', quotedData: true, audit: false }, expected: { attackSuccess: 0.02, harmfulPerMonth: 6, usefulKept: 0.88 } },
    locked: { state: { policy: 'provenance', quotedData: true, audit: true }, expected: { attackSuccess: 0.02, harmfulPerMonth: 1, persistDays: 4 } },
  },
  initialPreset: 'start',
  simulate: simulateMemoryPoisoning,
  outputs: [
    { kind: 'meter', label: 'Attack success', value: (r) => r.attackSuccess, detail: (r) => `= ${formatPercent(r.attackSuccess, 1)}`, emphasis: (r) => (r.attackSuccess > 0.03 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Harmful actions a month', value: (r) => String(r.harmfulPerMonth), emphasis: (r) => (r.harmfulPerMonth > 5 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Useful memories kept', value: (r) => r.usefulKept },
    { kind: 'value', label: 'A poisoned entry lasts', value: (r) => `${r.persistDays} days` },
  ],
  verdict: (r, s) => (r.attackSuccess <= 0.03 && r.usefulKept >= 0.85 && s.audit
    ? { tone: 'ok', headline: 'Poison rarely sticks, and never for long.', detail: 'Provenance at write time, quoting at read time, audits over time.' }
    : r.attackSuccess > 0.1 ? { tone: 'no', headline: 'Memory is an attack surface.', detail: 'Decide what may be written before anything is read back.' } : { tone: 'mid', headline: 'Better, not there yet.', detail: 'Audit and expire entries so a slip does not last.' }),
  narrate: (r, s) => `${POLICY_STORY[s.policy]}. ${s.quotedData ? 'Memories are shown as quoted data with their source, which halves what an attack can do. ' : ''}Attack success is ${formatPercent(r.attackSuccess, 1)}, about ${r.harmfulPerMonth} harmful actions a month, and a poisoned entry lasts ${r.persistDays} days.`,
  missions: {
    best: ({ state, result }) => result.attackSuccess <= 0.03 && result.usefulKept >= 0.85 && state.audit,
    data: ({ state }) => state.policy === 'any' && state.quotedData,
    keep: ({ result }) => result.harmfulPerMonth <= 5 && result.usefulKept >= 0.9,
  },
});
