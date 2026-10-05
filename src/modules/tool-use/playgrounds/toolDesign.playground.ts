import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatPercent } from '@/shared/format';
import { simulateToolDesign, type ToolDesignResult, type ToolDesignState } from '../simulators/toolDesign';

const inr = (v: number) => `₹${formatCount(Math.round(v))}`;
const st = (tools: number, descriptions: ToolDesignState['descriptions'], results: ToolDesignState['results'], errors: ToolDesignState['errors']): ToolDesignState => ({ tools, descriptions, results, errors, toolSearch: false });

export const toolDesignPlayground = definePlayground<ToolDesignState, ToolDesignResult>({
  techniqueId: 'tooldesign',
  title: 'Hospital scheduling agent · 3 tool calls per booking task',
  controls: [
    { kind: 'steps', key: 'tools', label: 'Tools exposed', values: Array.from({ length: 56 }, (_, i) => i + 5), format: String },
    { kind: 'select', key: 'descriptions', label: 'Descriptions', options: [{ value: 'terse', label: 'terse: one line (about 60 tokens a tool)' }, { value: 'full', label: 'full: what, when, when not, returns (about 220)' }] },
    { kind: 'select', key: 'results', label: 'Results', options: [{ value: 'raw', label: 'raw roster record (4,100 tokens)' }, { value: 'concise', label: 'concise: id, name, free times (380 tokens)' }] },
    { kind: 'select', key: 'errors', label: 'Errors', options: [{ value: 'code', label: 'bare code: E_VALIDATION_422' }, { value: 'actionable', label: 'actionable: what was wrong and how to fix it' }] },
    { kind: 'toggle', key: 'toolSearch', label: 'Load tools on demand (tool search: 5 loaded per turn)' },
  ],
  presets: {
    start: { state: st(48, 'terse', 'raw', 'code'), expected: { accuracy: 0.652, callsPerTask: 5.394, costPer1000: 15294.705 } },
    good: { state: st(12, 'full', 'raw', 'actionable'), expected: { accuracy: 0.98, retries: 1 } },
    many: { state: st(40, 'full', 'concise', 'actionable'), expected: { accuracy: 0.88, definitionTokens: 8800 } },
    terse: { state: st(12, 'terse', 'concise', 'actionable'), expected: { accuracy: 0.85 } },
  },
  initialPreset: 'start',
  simulate: simulateToolDesign,
  outputs: [
    { kind: 'meter', label: 'Right tool chosen', value: (r) => r.accuracy, detail: (r) => `= ${formatPercent(r.accuracy, 1)}`, emphasis: (r) => (r.accuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Definition tokens per turn', value: (r) => formatCount(r.definitionTokens) },
    { kind: 'value', label: 'Result tokens per call', value: (r) => formatCount(r.resultTokens) },
    { kind: 'value', label: 'Retries after a bad date', value: (r) => String(r.retries) },
    { kind: 'value', label: 'Calls per task', value: (r) => r.callsPerTask.toFixed(2), detail: (r) => `= 3 needed + ${r.wrongChoices.toFixed(2)} wrong choices + ${r.badArguments.toFixed(2)} bad arguments × ${r.retries}` },
    { kind: 'value', label: 'Cost per 1,000 tasks', value: (r) => inr(r.costPer1000), detail: (r) => `${formatCount(Math.round(r.tokensPerTask))} input tokens a task at ₹250 per million` },
  ],
  verdict: (r, s) => {
    const tone = r.accuracy >= 0.95 && r.resultTokens < 500 && r.retries === 1 ? 'ok' : r.accuracy >= 0.9 ? 'mid' : 'no';
    const detail = r.accuracy < 0.9 ? (s.descriptions === 'full' ? 'Too many tools compete for attention: load them on demand.' : 'Terse descriptions leave the model guessing between similar tools.') : r.resultTokens >= 500 ? 'Trim results: every token is reread on later turns.' : r.retries > 1 ? 'Make errors actionable.' : 'Descriptions, results and errors all help the model.';
    return { tone, headline: r.accuracy >= 0.95 ? 'The model reads these tools well.' : r.accuracy >= 0.9 ? 'Usable, with room to improve.' : 'Too many wrong choices.', detail };
  },
  narrate: (r, s) => [
    `${s.toolSearch ? `With tool search only 5 of the ${s.tools} tools are loaded each turn` : `All ${s.tools} tools are in the prompt on every turn`}, with ${s.descriptions} descriptions, so the model picks the right tool about ${formatPercent(r.accuracy, 0)} of the time.`,
    s.tools > 15 && !s.toolSearch ? 'Past about 15 tools each extra similar tool makes the choice harder.' : '',
    `Each call returns ${formatCount(r.resultTokens)} tokens${s.results === 'raw' ? ', most of them fields the next step never reads' : ''}.`,
    s.errors === 'actionable' ? 'A bad date is fixed in one retry because the error says what was wrong.' : 'A bare error code gives the model nothing to correct, so it retries blind.',
    `A booking task averages ${r.callsPerTask.toFixed(1)} calls and costs ${inr(r.costPer1000)} per 1,000 tasks.`,
  ].filter(Boolean).join(' '),
  missions: {
    many: ({ state, result }) => state.tools >= 40 && result.accuracy >= 0.95,
    lean: ({ result }) => result.resultTokens < 500 && result.accuracy >= 0.9,
    retry: ({ state, result }) => state.tools === 60 && result.retries === 1 && result.costPer1000 < 5000,
  },
});
