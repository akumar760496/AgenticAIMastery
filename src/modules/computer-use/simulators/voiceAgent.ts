/** A bank's Hindi helpline voice agent: latency from end of speech to first audio, word error rate and resolution. Illustrative. */
export type VoiceArchitecture = 'cascade' | 's2s';
export type SpeechModel = 'global' | 'indic';
export type CallerLanguage = 'hindi' | 'hinglish' | 'regional';
export type TurnDetection = 'silence' | 'smart';
export type VoiceModelSize = 'large' | 'small';
export type AudioLine = 'phone' | 'app';
export interface VoiceAgentState { readonly architecture: VoiceArchitecture; readonly stt: SpeechModel; readonly language: CallerLanguage; readonly turn: TurnDetection; readonly model: VoiceModelSize; readonly streaming: boolean; readonly line: AudioLine }
export interface VoiceAgentResult { readonly latencyMs: number; readonly wer: number; readonly resolved: number; readonly hangUps: number; readonly rupeesPerMinute: number }

const BASE_WER: Readonly<Record<SpeechModel, Readonly<Record<CallerLanguage, number>>>> = {
  global: { hindi: 9, hinglish: 15, regional: 32 },
  indic: { hindi: 6, hinglish: 9, regional: 20 },
};

export function simulateVoiceAgent(s: VoiceAgentState): VoiceAgentResult {
  const cascade = s.architecture === 'cascade';
  const pipeline = cascade ? (s.stt === 'indic' ? 120 : 100) + (s.model === 'large' ? 350 : 180) + (s.streaming ? 150 : 700) : 300;
  const latencyMs = 60 + (s.turn === 'silence' ? 800 : 200) + pipeline;
  const wer = BASE_WER[cascade ? s.stt : 'global'][s.language] * (cascade ? 1 : 1.1) * (s.line === 'phone' ? 1.3 : 1);
  const latencyPenalty = latencyMs > 1500 ? 0.1 : latencyMs > 800 ? 0.03 : 0;
  const resolved = Math.max(0.3, Math.min(0.95, 0.96 - Math.max(0, wer - 5) * 0.01 - latencyPenalty - (cascade && s.model === 'small' ? 0.03 : 0)));
  return {
    latencyMs, wer, resolved,
    hangUps: latencyMs > 1500 ? 0.16 : latencyMs > 800 ? 0.06 : 0.02,
    rupeesPerMinute: cascade ? (s.stt === 'indic' ? 0.5 : 0.6) + (s.model === 'large' ? 1 : 0.3) + 0.6 : 3,
  };
}
