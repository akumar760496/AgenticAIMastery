/** Dhan Seva (fictional) loan-status line: 40,000 calls a month; telephony ₹2, voice agent ₹4, a 5-minute human call ₹25. */
export type CallPath = 'ivr' | 'bot';
export interface TelephonyState { readonly path: CallPath; readonly indiaRegion: boolean; readonly warmTransfer: boolean }
export interface TelephonyResult { readonly latencyMs: number; readonly contained: number; readonly handleSeconds: number; readonly rupeesPerCall: number }

export function simulateTelephony(s: TelephonyState): TelephonyResult {
  const bot = s.path === 'bot';
  const latencyMs = bot ? (s.indiaRegion ? 700 : 950) : 0;
  const contained = bot ? (latencyMs > 800 ? 0.47 : 0.55) : 0.2;
  const handleSeconds = bot && s.warmTransfer ? 190 : 300;
  return { latencyMs, contained, handleSeconds, rupeesPerCall: Math.round((2 + (bot ? 4 : 0) + ((1 - contained) * handleSeconds) / 300 * 25) * 10) / 10 };
}
