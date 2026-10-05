/** Finding why success fell from 94% to 86% with no deploy: span attributes, grouping and the fix applied. */
export type SpanDetail = 'basic' | 'full';
export type Grouping = 'none' | 'prompt' | 'tool' | 'region' | 'model';
export type Fix = 'none' | 'prompt' | 'restart' | 'pin' | 'fallback';
export const GROUPS: Readonly<Record<Grouping, { readonly title: string; readonly rows: readonly (readonly [string, number, number])[] }>> = {
  none: { title: 'No grouping', rows: [['all traffic', 0.86, 1]] },
  prompt: { title: 'Prompt version', rows: [['claims-review v12', 0.86, 1]] },
  tool: { title: 'Tool', rows: [['get_policy', 0.862, 0.4], ['get_claim', 0.858, 0.35], ['ocr_bills', 0.86, 0.25]] },
  region: { title: 'Region', rows: [['Mumbai', 0.861, 0.45], ['Chennai', 0.858, 0.3], ['Delhi', 0.862, 0.25]] },
  model: { title: 'gen_ai.response.model', rows: [['alpha-0712', 0.94, 0.2], ['alpha-0918', 0.84, 0.8]] },
};
export const FIXES: Readonly<Record<Fix, { readonly success: number; readonly minutes: number; readonly label: string }>> = {
  none: { success: 0.86, minutes: 0, label: 'No fix applied' }, prompt: { success: 0.86, minutes: 20, label: 'Rolled back the prompt to v11' },
  restart: { success: 0.86, minutes: 10, label: 'Restarted the pods' }, pin: { success: 0.94, minutes: 5, label: 'Pinned the old snapshot alpha-0712' },
  fallback: { success: 0.91, minutes: 10, label: 'Switched to provider Beta' },
};
const ALERT_MIN = 12;

export interface TracingState { readonly spans: SpanDetail; readonly grouping: Grouping; readonly fix: Fix }
export interface TracingResult { readonly causeFound: boolean; readonly blind: boolean; readonly rows: readonly (readonly [string, number, number])[]; readonly success: number; readonly resolved: boolean; readonly mttrMin: number | null; readonly diagnosisMin: number }

export function simulateTracing(s: TracingState): TracingResult {
  const causeFound = s.grouping === 'model' && s.spans === 'full';
  const blind = s.grouping === 'model' && s.spans === 'basic';
  const success = FIXES[s.fix].success;
  const resolved = success >= 0.93;
  const diagnosisMin = causeFound ? 8 : 60;
  return {
    causeFound, blind, success, resolved, diagnosisMin,
    rows: blind ? [['alpha-latest (requested)', 0.86, 1]] : GROUPS[s.grouping].rows,
    mttrMin: resolved ? ALERT_MIN + diagnosisMin + FIXES[s.fix].minutes : null,
  };
}
