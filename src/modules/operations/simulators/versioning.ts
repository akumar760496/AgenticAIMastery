/** Release management: alias vs pinned model, prompt in code vs registry, and trace stamps, under two kinds of incident. */
export type ModelReference = 'alias' | 'pinned';
export type PromptSource = 'code' | 'registry';
export type ReleaseEvent = 'none' | 'alias' | 'badprompt';

export interface VersioningState { readonly model: ModelReference; readonly prompt: PromptSource; readonly stamp: boolean; readonly event: ReleaseEvent }
export interface VersioningResult { readonly success: number; readonly restoreMin: number; readonly incident: boolean; readonly why: string; readonly fullyKnown: boolean }

export function simulateVersioning(s: VersioningState): VersioningResult {
  let success = 0.94; let restoreMin = 0; let incident = false; let why = '';
  if (s.event === 'alias') {
    if (s.model === 'alias') { incident = true; success = 0.86; restoreMin = (s.stamp ? 30 : 180) + 10; why = s.stamp ? 'the release id is unchanged, which points at the provider; pinning takes 10 min' : 'nothing says what ran, so the search takes hours'; }
    else why = 'the pinned snapshot did not move';
  }
  if (s.event === 'badprompt') {
    incident = true; success = 0.89;
    restoreMin = (s.stamp ? 5 : 90) + (s.prompt === 'registry' ? 2 : 45);
    why = `${s.stamp ? 'the trace names v13 at once' : 'finding which prompt was live takes 90 min'}; ${s.prompt === 'registry' ? 'moving the label takes 2 min' : 'a code change and redeploy take 45 min'}`;
  }
  return { success, restoreMin, incident, why, fullyKnown: s.stamp && s.prompt === 'registry' && s.model === 'pinned' };
}
