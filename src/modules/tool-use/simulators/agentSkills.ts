/** Packaging 30 procedures: all in the prompt, as tools, or as skills loaded on demand; descriptions, scripts and review. */
export type Packaging = 'prompt' | 'tools' | 'skills';
export type SkillDescriptions = 'vague' | 'specific';
const UP_FRONT: Readonly<Record<Packaging, number>> = { prompt: 45000, tools: 9000, skills: 3000 };
const TASK_TOKENS = 1500;
const SKILL_BODY_TOKENS = 2000;
const INR_PER_1000_TOKENS = 0.25;

export interface SkillsState { readonly packaging: Packaging; readonly descriptions: SkillDescriptions; readonly scripts: boolean; readonly reviewed: boolean }
export interface SkillsResult { readonly upFrontTokens: number; readonly chosen: number; readonly success: number; readonly costPer1000: number; readonly unreadSkill: boolean }

export function simulateSkills(s: SkillsState): SkillsResult {
  const chosen = s.packaging === 'prompt' ? 0.9 : s.packaging === 'tools' ? (s.descriptions === 'specific' ? 0.88 : 0.72) : s.descriptions === 'specific' ? 0.93 : 0.7;
  const perTask = UP_FRONT[s.packaging] + TASK_TOKENS + (s.packaging === 'skills' ? SKILL_BODY_TOKENS : 0);
  return {
    upFrontTokens: UP_FRONT[s.packaging], chosen,
    success: chosen * (s.scripts ? 0.97 : 0.85),
    costPer1000: (perTask / 1000) * INR_PER_1000_TOKENS * 1000,
    unreadSkill: s.packaging === 'skills' && !s.reviewed,
  };
}
