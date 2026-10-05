/** Arogya Kosh (fictional insurer) AI incident governance over a year of signals. Illustrative. */
export type IncidentDefinition = 'none' | 'written';
export type NotificationPlan = 'adhoc' | 'playbook';
export interface AiIncidentState { readonly definition: IncidentDefinition; readonly register: boolean; readonly notifications: NotificationPlan }
export interface AiIncidentResult { readonly recognised: number; readonly classifyHours: number; readonly onTime: number; readonly repeats: number }

export function simulateAiIncidents(s: AiIncidentState): AiIncidentResult {
  const written = s.definition === 'written';
  return {
    recognised: written ? 0.9 : 0.35,
    classifyHours: written ? (s.register ? 2 : 4) : 72,
    onTime: s.notifications === 'playbook' ? (written ? 0.95 : 0.7) : written ? 0.55 : 0.4,
    repeats: s.register ? (written ? 2 : 4) : 9,
  };
}
