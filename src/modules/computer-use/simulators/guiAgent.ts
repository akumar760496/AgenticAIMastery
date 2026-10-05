/** Screen agent on a legacy desktop app: an NEFT-return case takes 18 actions; each is a screenshot and a model call. */
export type Perception = 'shot' | 'zoom' | 'hybrid';
export type ScreenSize = 'low' | 'mid' | 'high';
export interface GuiAgentState { readonly perception: Perception; readonly size: ScreenSize; readonly budget: number; readonly verify: boolean }
export interface GuiAgentResult { readonly perStep: number; readonly actionsNeeded: number; readonly outOfSteps: boolean; readonly success: number; readonly seconds: number; readonly rupees: number }

const ACTIONS = 18;
const BASE: Readonly<Record<Perception, number>> = { shot: 0.955, zoom: 0.97, hybrid: 0.985 };
const RUPEES_PER_ACTION: Readonly<Record<Perception, number>> = { shot: 0.6, zoom: 0.65, hybrid: 0.5 };

export function simulateGuiAgent(s: GuiAgentState): GuiAgentResult {
  const shotOnly = s.perception === 'shot';
  let perStep = BASE[s.perception];
  if (s.size === 'low') perStep -= shotOnly ? 0.015 : 0.004;
  if (s.size === 'high') perStep -= shotOnly ? 0.008 : 0.002;
  if (s.verify) perStep = Math.min(0.998, perStep + 0.012);
  const actionsNeeded = ACTIONS * (s.verify ? 1.3 : 1);
  const outOfSteps = s.budget < actionsNeeded;
  return { perStep, actionsNeeded, outOfSteps, success: outOfSteps ? 0 : perStep ** ACTIONS, seconds: actionsNeeded * 4, rupees: actionsNeeded * RUPEES_PER_ACTION[s.perception] };
}
