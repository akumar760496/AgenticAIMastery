import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { simulateAiIncidents, type AiIncidentResult, type AiIncidentState } from '../simulators/aiIncidents';

const isBest = (r: AiIncidentResult) => r.recognised >= 0.9 && r.onTime >= 0.95 && r.repeats <= 2;

export const aiIncidentsPlayground = definePlayground<AiIncidentState, AiIncidentResult>({
  techniqueId: 'aiincident',
  title: 'Govern Arogya Kosh’s AI incidents',
  intro: 'Arogya Kosh is a fictional health insurer. A year of signals: unfair claim rejections, chatbot privacy slips, harmful replies and one security event. Figures are illustrative; this is not legal advice.',
  controls: [
    { kind: 'select', key: 'definition', label: 'What counts as an AI incident', options: [{ value: 'none', label: 'No definition: outages only' }, { value: 'written', label: 'Written definition and S1–S4 severity scale' }] },
    { kind: 'toggle', key: 'register', label: 'Central register with owners, evidence and verified closure' },
    { kind: 'select', key: 'notifications', label: 'Notifications', options: [{ value: 'adhoc', label: 'Worked out when it happens' }, { value: 'playbook', label: 'Playbook with clocks and pre-approved templates' }] },
  ],
  presets: {
    start: { state: { definition: 'none', register: false, notifications: 'adhoc' }, expected: { recognised: 0.35, onTime: 0.4, classifyHours: 72, repeats: 9 } },
    defined: { state: { definition: 'written', register: false, notifications: 'adhoc' }, expected: { recognised: 0.9, classifyHours: 4, onTime: 0.55 } },
    playbook: { state: { definition: 'written', register: false, notifications: 'playbook' }, expected: { onTime: 0.95, repeats: 9 } },
    full: { state: { definition: 'written', register: true, notifications: 'playbook' }, expected: { classifyHours: 2, onTime: 0.95, repeats: 2 } },
  },
  initialPreset: 'start',
  simulate: simulateAiIncidents,
  outputs: [
    { kind: 'meter', label: 'Incidents recognised as AI incidents', value: (r) => r.recognised, emphasis: (r) => (r.recognised < 0.6 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Notifications on time', value: (r) => r.onTime, emphasis: (r) => (r.onTime < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time to classify', value: (r) => `${r.classifyHours} hours`, emphasis: (r) => (r.classifyHours > 24 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Repeat incidents a year', value: (r) => String(r.repeats), emphasis: (r) => (r.repeats > 4 ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    if (isBest(r)) return { tone: 'ok', headline: 'Recognised, reported, not repeated.', detail: 'Definition, register and playbook together.' };
    if (r.onTime < 0.6) return { tone: 'no', headline: 'Deadlines are being missed.', detail: s.definition === 'none' ? 'Nobody agrees it is an incident until the clock has run.' : 'Work out the clocks before the incident.' };
    return { tone: 'mid', headline: 'Partly in control.', detail: s.notifications === 'playbook' && s.definition === 'none' ? 'A playbook cannot start if nobody recognises the incident.' : 'Track fixes in a register so incidents do not recur.' };
  },
  narrate: (r, s) => `${s.definition === 'none' ? 'Only outages count, so unfair rejections and privacy slips are argued about for days' : 'A written definition and severity scale let the team classify quickly'}. ${formatWholePercent(r.onTime)} of notifications are on time and ${r.repeats} incidents repeat in a year.`,
  missions: {
    best: ({ result }) => isBest(result),
    clock: ({ state, result }) => state.notifications === 'playbook' && state.definition === 'none' && result.onTime < 0.8,
    learn: ({ state, result }) => state.register && state.notifications === 'adhoc' && result.repeats <= 4,
  },
});
