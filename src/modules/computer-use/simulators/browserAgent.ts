/** Browser agent collecting corporate-action notices: about 12 pages a task; input tokens ₹0.25 per 1,000. */
export type Observation = 'shot' | 'html' | 'tree' | 'hybrid';
export type SiteKind = 'static' | 'dynamic';
export interface BrowserAgentState { readonly observation: Observation; readonly sites: SiteKind; readonly scripted: boolean }
export interface BrowserAgentResult { readonly success: number; readonly tokens: number; readonly seconds: number; readonly rupees: number; readonly pages: number }

const TOKENS_PER_PAGE: Readonly<Record<Observation, number>> = { shot: 1500, html: 25000, tree: 3000, hybrid: 4000 };
const SECONDS_PER_PAGE: Readonly<Record<Observation, number>> = { shot: 6, html: 9, tree: 4, hybrid: 5 };
const SUCCESS: Readonly<Record<SiteKind, Readonly<Record<Observation, number>>>> = {
  static: { shot: 0.88, html: 0.86, tree: 0.94, hybrid: 0.96 },
  dynamic: { shot: 0.8, html: 0.7, tree: 0.85, hybrid: 0.92 },
};

export function simulateBrowserAgent(s: BrowserAgentState): BrowserAgentResult {
  const pages = s.scripted ? 4 : 12;
  const tokens = pages * TOKENS_PER_PAGE[s.observation];
  const base = SUCCESS[s.sites][s.observation];
  return {
    success: s.scripted ? Math.min(0.98, base + 0.03) : base,
    tokens, pages,
    seconds: (s.scripted ? 8 : 0) + pages * SECONDS_PER_PAGE[s.observation],
    rupees: (tokens * 0.25) / 1000,
  };
}
