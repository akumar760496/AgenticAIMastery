/** Billing-support system prompt built section by section: 400 eval tickets, 85,000 calls a month at $3 per million input tokens. */
export interface SystemPromptState { readonly role: boolean; readonly rules: boolean; readonly tools: boolean; readonly format: boolean; readonly unsure: boolean; readonly examples: boolean; readonly conflict: boolean; readonly varsLast: boolean }
export interface SystemPromptResult { readonly accuracy: number; readonly formatCompliance: number; readonly escalation: number; readonly tokens: number; readonly cacheHit: number; readonly monthlyCostUsd: number }

const CALLS_PER_MONTH = 85000;
const USD_PER_TOKEN = 3 / 1e6;
const CACHED_PRICE_FACTOR = 0.1;

export function simulateSystemPrompt(s: SystemPromptState): SystemPromptResult {
  let accuracy = 0.62; let formatCompliance = 0.7; let escalation = 0.55; let tokens = 250;
  if (s.role) { accuracy += 0.04; tokens += 60; }
  if (s.rules) { accuracy += 0.1; tokens += 300; }
  if (s.tools) { accuracy += 0.09; tokens += 350; }
  if (s.format) { formatCompliance = 0.96; tokens += 150; }
  if (s.unsure) { accuracy += 0.05; escalation = 0.92; tokens += 120; }
  if (s.examples) { accuracy += 0.06; formatCompliance = Math.min(0.98, formatCompliance + 0.02); tokens += 700; }
  if (s.conflict) { accuracy -= 0.15; tokens += 40; }
  const cacheHit = s.varsLast ? 0.9 : 0;
  const billedTokens = tokens * (1 - cacheHit) + tokens * cacheHit * CACHED_PRICE_FACTOR;
  return { accuracy: Math.max(0, accuracy), formatCompliance, escalation, tokens, cacheHit, monthlyCostUsd: billedTokens * USD_PER_TOKEN * CALLS_PER_MONTH };
}
