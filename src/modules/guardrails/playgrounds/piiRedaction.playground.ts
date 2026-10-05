import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { DAILY_PII, simulatePiiRedaction, type PiiRedactionResult, type PiiRedactionState } from '../simulators/piiRedaction';

const meetsTarget = (r: PiiRedactionResult, s: PiiRedactionState) => r.reachingModel <= 25 && s.maskLogs && r.falseMasks <= 15 && r.idTasksDone === DAILY_PII.idTasks;

export const piiRedactionPlayground = definePlayground<PiiRedactionState, PiiRedactionResult>({
  techniqueId: 'pii',
  title: 'Redact Udaan Lend’s chats (fictional NBFC)',
  controls: [
    { kind: 'select', key: 'detector', label: 'Detector', options: [
      { value: 'regex', label: 'Patterns only' }, { value: 'checksum', label: 'Patterns + checksums' }, { value: 'ner', label: 'Patterns + checksums + name model' },
    ] },
    { kind: 'select', key: 'method', label: 'Replace with', options: [{ value: 'redact', label: '[REDACTED]' }, { value: 'placeholder', label: 'Typed placeholders, reversible' }] },
    { kind: 'toggle', key: 'normalise', label: 'Normalise first (spaces, dashes, Devanagari digits)' },
    { kind: 'toggle', key: 'maskLogs', label: 'Mask logs and traces too' },
  ],
  presets: {
    start: { state: { detector: 'checksum', normalise: false, method: 'redact', maskLogs: false }, expected: { reachingModel: 156, inLogs: 300, falseMasks: 4, idTasksDone: 12 } },
    better: { state: { detector: 'checksum', normalise: true, method: 'placeholder', maskLogs: true }, expected: { reachingModel: 129, falseMasks: 4, idTasksDone: 60 } },
    full: { state: { detector: 'ner', normalise: true, method: 'placeholder', maskLogs: true }, expected: { reachingModel: 21, inLogs: 21, falseMasks: 14, idTasksDone: 60, latencyMs: 37 } },
    nolog: { state: { detector: 'ner', normalise: true, method: 'placeholder', maskLogs: false }, expected: { reachingModel: 21, inLogs: 300 } },
  },
  initialPreset: 'start',
  simulate: simulatePiiRedaction,
  outputs: [
    { kind: 'value', label: 'Personal data reaching the model', value: (r) => `${r.reachingModel} of ${DAILY_PII.total}`, emphasis: (r) => (r.reachingModel > 25 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Personal data in logs and traces', value: (r) => `${r.inLogs} of ${DAILY_PII.total}`, emphasis: (r) => (r.inLogs > 25 ? 'warn' : 'normal') },
    { kind: 'value', label: 'False masks a day', value: (r) => String(r.falseMasks), detail: () => 'order and reference numbers hidden by mistake' },
    { kind: 'meter', label: 'ID tasks the agent can finish', value: (r) => r.idTasksDone / DAILY_PII.idTasks, detail: (r) => `= ${r.idTasksDone} of ${DAILY_PII.idTasks}`, emphasis: (r) => (r.idTasksDone < DAILY_PII.idTasks ? 'warn' : 'normal') },
    { kind: 'value', label: 'Added latency', value: (r) => `${r.latencyMs} ms` },
  ],
  verdict: (r, s) => {
    if (meetsTarget(r, s)) return { tone: 'ok', headline: 'Private, and still useful.', detail: 'Only a few missed values reach the model, the logs are clean, and placeholders let the agent finish every task.' };
    const tone = r.reachingModel > 100 || r.inLogs > 100 ? 'no' : 'mid';
    if (r.reachingModel > 100) return { tone, headline: 'Most personal data still reaches the model.', detail: s.detector !== 'ner' ? 'Names need a name model; patterns cannot find them.' : 'Normalise the text so spaced numbers match.' };
    if (!s.maskLogs) return { tone, headline: 'The logs keep everything.', detail: 'Mask logs and traces, not only the prompt.' };
    if (r.idTasksDone < DAILY_PII.idTasks) return { tone, headline: 'Redaction broke the ID tasks.', detail: 'Use reversible placeholders so the agent can still refer to the ID.' };
    if (r.falseMasks > 15) return { tone, headline: 'Too many false masks.', detail: 'Add checksums to confirm matches.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Normalise the text so spaced numbers match.' };
  },
  narrate: (r, s) => {
    const detector = { regex: 'Patterns alone', checksum: 'Patterns with checksums', ner: 'Patterns, checksums and a name model' }[s.detector];
    const parts = [`${detector} ${s.normalise ? 'on normalised text' : 'on raw text'} let ${r.reachingModel} of the 300 personal values reach the model.`];
    parts.push(s.detector === 'ner' ? 'The name model finds most names, including Hinglish ones.' : 'No pattern can find a name, so all 120 names and addresses go through.');
    if (!s.normalise) parts.push('Numbers typed with spaces or in Devanagari digits slip past the patterns.');
    parts.push(s.detector === 'regex' ? 'Without checksums, 45 order and reference numbers a day are masked as IDs.' : 'Checksums reject most look-alike numbers.');
    parts.push(s.method === 'redact' ? `[REDACTED] leaves the agent nothing to work with, so only ${r.idTasksDone} of the 60 ID tasks can be done.` : 'Typed placeholders let the agent say “your PAN <IN_PAN_1> is updated”, so all 60 ID tasks are done.');
    parts.push(s.maskLogs ? 'Logs and traces hold the same masked text.' : 'The logs still hold every raw value, which is often where a leak starts.');
    return parts.join(' ');
  },
  missions: {
    clean: ({ state: s, result }) => meetsTarget(result, s),
    noisy: ({ state: s, result }) => s.detector === 'regex' && result.falseMasks >= 40,
    broke: ({ state: s, result }) => s.method === 'redact' && result.idTasksDone < 10,
  },
});
