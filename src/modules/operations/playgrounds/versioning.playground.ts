import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateVersioning, type VersioningResult, type VersioningState } from '../simulators/versioning';

const sentence = (t: string) => (t ? `${t.charAt(0).toUpperCase()}${t.slice(1)}.` : '');
const minutes = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} h ${Math.round(m % 60)} min` : `${Math.round(m)} min`);

export const versioningPlayground = definePlayground<VersioningState, VersioningResult>({
  techniqueId: 'versioning',
  title: 'Release management',
  intro: 'Normal success is 94%. Choose how the release is managed, then pick what goes wrong.',
  controls: [
    { kind: 'select', key: 'model', label: 'Model reference', options: [{ value: 'alias', label: 'Alias alpha-latest' }, { value: 'pinned', label: 'Pinned snapshot alpha-0712' }] },
    { kind: 'select', key: 'prompt', label: 'Prompt lives', options: [{ value: 'code', label: 'In the code' }, { value: 'registry', label: 'In a registry, loaded by label' }] },
    { kind: 'toggle', key: 'stamp', label: 'Stamp every trace with the release (prompt version, snapshot)' },
    { kind: 'select', key: 'event', label: 'Event', options: [{ value: 'none', label: 'Quiet day' }, { value: 'alias', label: 'Provider moves the alias to a new snapshot' }, { value: 'badprompt', label: 'A bad prompt v13 is shipped' }] },
  ],
  presets: {
    start: { state: { model: 'alias', prompt: 'code', stamp: false, event: 'alias' }, expected: { success: 0.86, restoreMin: 190 } },
    pinned: { state: { model: 'pinned', prompt: 'code', stamp: false, event: 'alias' }, expected: { success: 0.94, incident: false } },
    badcode: { state: { model: 'pinned', prompt: 'code', stamp: true, event: 'badprompt' }, expected: { success: 0.89, restoreMin: 50 } },
    release: { state: { model: 'pinned', prompt: 'registry', stamp: true, event: 'badprompt' }, expected: { success: 0.89, restoreMin: 7, fullyKnown: true } },
  },
  initialPreset: 'start',
  simulate: simulateVersioning,
  outputs: [
    { kind: 'meter', label: 'Success', value: (r) => r.success, emphasis: (r) => (r.success < 0.94 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time to restore', value: (r) => (r.incident ? minutes(r.restoreMin) : 'no incident'), detail: (r) => r.why },
    { kind: 'check', label: 'Every trace says exactly what ran', value: (r) => r.fullyKnown },
  ],
  verdict: (r) => (!r.incident
    ? { tone: 'ok', headline: 'Nothing reached you.', detail: sentence(r.why) || 'A quiet day.' }
    : r.restoreMin <= 10 ? { tone: 'ok', headline: 'Restored in minutes.', detail: 'The trace named the release, and moving a label undid it.' } : { tone: r.restoreMin > 60 ? 'no' : 'mid', headline: 'A slow recovery.', detail: sentence(r.why) }),
  narrate: (r, s) => [
    s.event === 'none' ? 'A quiet day: nothing changes.' : s.event === 'alias' ? (s.model === 'alias' ? 'The provider moved alpha-latest to a new snapshot, and your success fell to 86% without any deploy on your side.' : 'The provider moved the alias, but your config pins alpha-0712, so nothing reached you.') : 'Prompt v13 goes live and success falls to 89%.',
    r.incident ? `Restoring it takes ${minutes(r.restoreMin)}: ${r.why}.` : '',
    r.fullyKnown ? 'Every trace carries the prompt version and snapshot, so any answer can be tied to one release.' : 'Some part of the release (prompt source, snapshot or trace stamp) is not recorded, so audits will have gaps.',
  ].filter(Boolean).join(' '),
  missions: {
    alias: ({ state, result }) => state.event === 'alias' && result.success >= 0.94,
    quick: ({ state, result }) => state.event === 'badprompt' && result.restoreMin <= 10,
    known: ({ result }) => result.fullyKnown,
  },
});
