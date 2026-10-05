import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed, formatWholePercent } from '@/shared/format';
import { simulateTelephony, type TelephonyResult, type TelephonyState } from '../simulators/telephony';

const isBest = (r: TelephonyResult) => r.contained >= 0.55 && r.latencyMs <= 800 && r.rupeesPerCall <= 14;

export const telephonyPlayground = definePlayground<TelephonyState, TelephonyResult>({
  techniqueId: 'telephony',
  title: 'Put Dhan Seva’s agent on the phone',
  intro: 'Dhan Seva is a fictional lender. 40,000 loan-status calls a month. Telephony ₹2 a call, voice agent ₹4 a call, human agent ₹25 for a 5-minute call (illustrative).',
  controls: [
    { kind: 'select', key: 'path', label: 'Call handling', options: [{ value: 'ivr', label: 'IVR menus, then a human' }, { value: 'bot', label: 'Voice agent, then a human' }] },
    { kind: 'toggle', key: 'indiaRegion', label: 'Media processed in an Indian region' },
    { kind: 'toggle', key: 'warmTransfer', label: 'Warm transfer with a summary' },
  ],
  presets: {
    start: { state: { path: 'ivr', indiaRegion: true, warmTransfer: false }, expected: { contained: 0.2, rupeesPerCall: 22 } },
    abroad: { state: { path: 'bot', indiaRegion: false, warmTransfer: false }, expected: { latencyMs: 950, contained: 0.47, rupeesPerCall: 19.3 } },
    india: { state: { path: 'bot', indiaRegion: true, warmTransfer: false }, expected: { latencyMs: 700, contained: 0.55, rupeesPerCall: 17.3 } },
    warm: { state: { path: 'bot', indiaRegion: true, warmTransfer: true }, expected: { handleSeconds: 190, rupeesPerCall: 13.1 } },
  },
  initialPreset: 'start',
  simulate: simulateTelephony,
  outputs: [
    { kind: 'meter', label: 'Calls resolved without a person', value: (r) => r.contained, emphasis: (r) => (r.contained < 0.5 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Reply latency', value: (r) => (r.latencyMs ? `${r.latencyMs} ms` : 'menus'), emphasis: (r) => (r.latencyMs > 800 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Human handle time', value: (r) => `${r.handleSeconds} s` },
    { kind: 'value', label: 'Cost per call', value: (r) => `₹${formatFixed(r.rupeesPerCall, 1)}` },
  ],
  verdict: (r, s) => {
    if (isBest(r)) return { tone: 'ok', headline: 'Fast, resolved, smooth hand-offs.', detail: 'Media near callers and warm transfers.' };
    if (s.path === 'ivr') return { tone: 'no', headline: 'Menus resolve little.', detail: 'Try a voice agent.' };
    if (r.latencyMs > 800) return { tone: 'mid', headline: 'Slow replies make callers hang up.', detail: 'Process media in an Indian region.' };
    return { tone: 'mid', headline: 'Callers repeat themselves to humans.', detail: 'Pass a summary with the transfer.' };
  },
  narrate: (r, s) => [
    s.path === 'ivr' ? 'IVR menus resolve only 20% of calls before a person picks up.' : `The voice agent replies in ${r.latencyMs} ms${s.indiaRegion ? '' : ', because audio travels to an overseas region'} and resolves ${formatWholePercent(r.contained)} of calls.`,
    s.warmTransfer && s.path === 'bot' ? 'Warm transfers cut human handle time to 190 s.' : '',
    `Each call costs ₹${formatFixed(r.rupeesPerCall, 1)}.`,
  ].filter(Boolean).join(' '),
  missions: {
    best: ({ result }) => isBest(result),
    abroad: ({ state, result }) => state.path === 'bot' && result.latencyMs > 800,
    warm: ({ state, result }) => state.path === 'bot' && result.handleSeconds <= 200,
  },
});
