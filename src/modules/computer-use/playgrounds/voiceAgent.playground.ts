import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatRupees, formatWholePercent } from '@/shared/format';
import { simulateVoiceAgent, type VoiceAgentResult, type VoiceAgentState } from '../simulators/voiceAgent';

const base: VoiceAgentState = { architecture: 'cascade', stt: 'global', language: 'hinglish', turn: 'smart', model: 'large', streaming: true, line: 'phone' };
const isGood = (r: VoiceAgentResult) => r.latencyMs <= 800 && r.resolved >= 0.85;

export const voiceAgentPlayground = definePlayground<VoiceAgentState, VoiceAgentResult>({
  techniqueId: 'voice',
  title: 'Build a bank’s Hindi helpline agent',
  intro: 'Card blocking and UPI dispute status. Latency is from the end of the caller’s speech to first audio. Figures are illustrative.',
  controls: [
    { kind: 'select', key: 'architecture', label: 'Architecture', options: [{ value: 'cascade', label: 'Cascade: STT → LLM → TTS' }, { value: 's2s', label: 'Speech-to-speech model' }] },
    { kind: 'select', key: 'stt', label: 'Speech recognition', options: [{ value: 'global', label: 'General multilingual' }, { value: 'indic', label: 'India-tuned, tested on calls' }] },
    { kind: 'select', key: 'language', label: 'Callers speak', options: [{ value: 'hindi', label: 'Hindi' }, { value: 'hinglish', label: 'Hinglish (code-mixed)' }, { value: 'regional', label: 'Bhojpuri or Maithili' }] },
    { kind: 'select', key: 'turn', label: 'End of turn', options: [{ value: 'silence', label: 'Wait for 800 ms of silence' }, { value: 'smart', label: 'Turn-detection model' }] },
    { kind: 'select', key: 'model', label: 'Model', options: [{ value: 'large', label: 'Large' }, { value: 'small', label: 'Small and fast' }] },
    { kind: 'select', key: 'line', label: 'Audio', options: [{ value: 'phone', label: 'Phone line (8 kHz)' }, { value: 'app', label: 'In-app (wideband)' }] },
    { kind: 'toggle', key: 'streaming', label: 'Stream speech synthesis' },
  ],
  presets: {
    start: { state: { ...base, turn: 'silence' }, expected: { latencyMs: 1460, wer: 19.5, resolved: 0.785 } },
    s2s: { state: { ...base, architecture: 's2s' }, expected: { latencyMs: 560, wer: 21.45, resolved: 0.7955 } },
    tuned: { state: { ...base, stt: 'indic' }, expected: { latencyMs: 880, wer: 11.7, resolved: 0.863 } },
    regional: { state: { ...base, language: 'regional' }, expected: { wer: 41.6, resolved: 0.564 } },
  },
  initialPreset: 'start',
  simulate: simulateVoiceAgent,
  outputs: [
    { kind: 'value', label: 'Reply latency', value: (r) => `${formatCount(r.latencyMs)} ms`, emphasis: (r) => (r.latencyMs > 800 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Words misheard', value: (r) => r.wer / 100, emphasis: (r) => (r.wer > 15 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Calls resolved', value: (r) => r.resolved, emphasis: (r) => (r.resolved < 0.85 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Callers who hang up', value: (r) => formatWholePercent(r.hangUps) },
    { kind: 'value', label: 'Cost per minute', value: (r) => formatRupees(r.rupeesPerMinute, 2) },
  ],
  verdict: (r) => (isGood(r)
    ? { tone: 'ok', headline: 'Natural and accurate.', detail: 'Fast replies and recognition tuned to how callers speak.' }
    : r.latencyMs > 1500 ? { tone: 'no', headline: 'Feels broken.', detail: 'Callers wait over 1.5 seconds and hang up.' }
      : r.latencyMs > 800 ? { tone: 'mid', headline: 'Too slow.', detail: 'Every reply has a noticeable pause.' }
        : { tone: 'mid', headline: 'Fast, but mishears.', detail: 'Recognition errors, not speed, are the problem now.' }),
  narrate: (r, s) => [
    `${s.architecture === 'cascade' ? 'The cascade' : 'The speech-to-speech model'} replies ${formatCount(r.latencyMs)} ms after the caller stops${s.turn === 'silence' ? ', 800 ms of it spent waiting for silence' : ''}.`,
    `It mishears ${formatFixed(r.wer, 0)}% of words${s.line === 'phone' ? ' on an 8 kHz phone line' : ''}, and resolves ${formatWholePercent(r.resolved)} of calls at ${formatRupees(r.rupeesPerMinute, 2)} a minute.`,
  ].join(' '),
  missions: {
    fast: ({ state, result }) => state.language === 'hinglish' && state.line === 'phone' && isGood(result),
    regional: ({ state, result }) => state.language === 'regional' && state.architecture === 'cascade' && state.stt === 'indic' && result.resolved < 0.8,
    broken: ({ result }) => result.latencyMs > 1500,
  },
});
