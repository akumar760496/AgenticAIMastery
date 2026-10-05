import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatDollars, formatPercent, formatWholePercent, joinWithAnd } from '@/shared/format';
import { simulateSystemPrompt, type SystemPromptResult, type SystemPromptState } from '../simulators/systemPrompt';

const base: SystemPromptState = { role: true, rules: true, tools: true, format: true, unsure: true, examples: false, conflict: false, varsLast: true };
const CORE: readonly (readonly [keyof SystemPromptState, string])[] = [['role', 'role'], ['rules', 'rules'], ['tools', 'tool guidance'], ['format', 'output format'], ['unsure', 'when unsure']];
const isGood = (r: SystemPromptResult) => r.accuracy >= 0.9 && r.formatCompliance >= 0.95;

export const systemPromptPlayground = definePlayground<SystemPromptState, SystemPromptResult>({
  techniqueId: 'sysprompt',
  title: 'Write a billing-support system prompt',
  intro: 'A telecom support agent with two billing tools, evaluated on 400 real tickets. 85,000 calls a month at $3 per million input tokens.',
  controls: [
    { kind: 'toggle', key: 'role', label: 'Role and goal' },
    { kind: 'toggle', key: 'rules', label: 'Rules, with reasons' },
    { kind: 'toggle', key: 'tools', label: 'Tool guidance: when to use each' },
    { kind: 'toggle', key: 'format', label: 'Output format' },
    { kind: 'toggle', key: 'unsure', label: 'When unsure: ask or hand over' },
    { kind: 'toggle', key: 'examples', label: 'Three worked examples (+700 tokens)' },
    { kind: 'toggle', key: 'conflict', label: 'Two rules that contradict each other' },
    { kind: 'toggle', key: 'varsLast', label: 'Customer data and question at the end, not the top' },
  ],
  presets: {
    start: { state: { ...base, rules: false, tools: false, format: false, unsure: false, varsLast: false }, expected: { accuracy: 0.66, tokens: 310, monthlyCostUsd: 79.05 } },
    lean: { state: base, expected: { accuracy: 0.9, tokens: 1230, monthlyCostUsd: 59.5935 } },
    everything: { state: { ...base, examples: true }, expected: { accuracy: 0.96, tokens: 1930 } },
    accreted: { state: { ...base, examples: true, conflict: true, varsLast: false }, expected: { accuracy: 0.81, tokens: 1970 } },
  },
  initialPreset: 'start',
  simulate: simulateSystemPrompt,
  outputs: [
    { kind: 'meter', label: 'Task accuracy', value: (r) => r.accuracy, detail: () => '= correct answer and correct tool', emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Format compliance', value: (r) => r.formatCompliance, detail: () => '= replies that follow the required format', emphasis: (r) => (r.formatCompliance < 0.95 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Right escalation when unsure', value: (r) => r.escalation, detail: () => '= asks or hands over instead of guessing', emphasis: (r) => (r.escalation < 0.8 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Prompt tokens', value: (r) => formatCount(r.tokens) },
    { kind: 'value', label: 'Cache hit on the prompt', value: (r) => formatWholePercent(r.cacheHit) },
    { kind: 'value', label: 'Input cost a month', value: (r) => formatDollars(r.monthlyCostUsd, 0) },
  ],
  verdict: (r, s) => (isGood(r) && r.tokens <= 1300
    ? { tone: 'ok', headline: 'Clear and lean.', detail: 'Sections do the work; no examples needed for this task.' }
    : isGood(r) ? { tone: 'mid', headline: 'Clear, but heavy.', detail: 'The examples add 700 tokens to every call for a small gain.' }
      : s.conflict ? { tone: 'no', headline: 'Contradictions are costing you.', detail: 'Contradictory rules make the model pick one at random.' }
        : { tone: 'no', headline: 'Too vague.', detail: 'Missing sections leave the model guessing.' }),
  narrate: (r, s) => {
    const missing = CORE.filter(([k]) => !s[k]).map(([, l]) => l);
    return [
      `The prompt is ${formatCount(r.tokens)} tokens and gets ${formatPercent(r.accuracy, 1)} of tickets right.`,
      missing.length ? `Still missing: ${joinWithAnd(missing)}.` : 'Every core section is present.',
      s.conflict ? 'Two rules contradict each other, which costs 15 points of accuracy.' : '',
      s.varsLast ? 'Because customer data comes last, 90% of the prompt is served from cache.' : 'Customer data at the top changes the prefix on every call, so nothing is cached.',
    ].filter(Boolean).join(' ');
  },
  missions: {
    good: ({ result }) => isGood(result),
    lean: ({ result }) => isGood(result) && result.tokens <= 1300,
    conflict: ({ state, result }) => state.conflict && state.role && state.rules && state.tools && state.format && state.unsure && state.examples && result.accuracy < 0.85,
  },
});
