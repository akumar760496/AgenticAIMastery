import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatRupees, formatWholePercent } from '@/shared/format';
import { simulateBrowserAgent, type BrowserAgentResult, type BrowserAgentState } from '../simulators/browserAgent';

const isLean = (r: BrowserAgentResult) => r.success >= 0.9 && r.tokens <= 20000;

export const browserAgentPlayground = definePlayground<BrowserAgentState, BrowserAgentResult>({
  techniqueId: 'browser',
  title: 'Collect corporate-action notices',
  intro: 'A task visits about 12 pages on exchange and registrar sites. Input tokens cost ₹0.25 per 1,000.',
  controls: [
    { kind: 'select', key: 'observation', label: 'The agent reads', options: [{ value: 'shot', label: 'Screenshots' }, { value: 'html', label: 'Raw HTML' }, { value: 'tree', label: 'Accessibility tree' }, { value: 'hybrid', label: 'Tree, plus screenshots when needed' }] },
    { kind: 'select', key: 'sites', label: 'Sites', options: [{ value: 'static', label: 'Mostly static pages' }, { value: 'dynamic', label: 'Dynamic pages, pop-ups, lazy loading' }] },
    { kind: 'toggle', key: 'scripted', label: 'Script the fixed steps (navigation, search)' },
  ],
  presets: {
    start: { state: { observation: 'shot', sites: 'dynamic', scripted: false }, expected: { success: 0.8, tokens: 18000 } },
    html: { state: { observation: 'html', sites: 'dynamic', scripted: false }, expected: { success: 0.7, tokens: 300000 } },
    tree: { state: { observation: 'tree', sites: 'static', scripted: false }, expected: { success: 0.94, tokens: 36000 } },
    hybrid: { state: { observation: 'hybrid', sites: 'static', scripted: true }, expected: { success: 0.98, tokens: 16000 } },
  },
  initialPreset: 'start',
  simulate: simulateBrowserAgent,
  outputs: [
    { kind: 'meter', label: 'Tasks completed', value: (r) => r.success, emphasis: (r) => (r.success < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Tokens per task', value: (r) => formatCount(r.tokens), emphasis: (r) => (r.tokens >= 200000 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time per task', value: (r) => `${r.seconds} s` },
    { kind: 'value', label: 'Cost per task', value: (r) => formatRupees(r.rupees, 2) },
  ],
  verdict: (r) => (isLean(r)
    ? { tone: 'ok', headline: 'Reliable and lean.', detail: 'The model reads compact trees and only decides what varies.' }
    : r.tokens >= 200000 ? { tone: 'no', headline: 'Drowning in markup.', detail: 'Raw HTML fills the context and slows every step.' }
      : { tone: 'mid', headline: 'Could do better.', detail: 'Try the accessibility tree and script the fixed route.' }),
  narrate: (r, s) => [
    `Reading ${{ shot: 'screenshots', html: 'raw HTML', tree: 'the accessibility tree', hybrid: 'the tree, with screenshots when needed' }[s.observation]} on ${s.sites} sites, the agent completes ${formatWholePercent(r.success)} of tasks.`,
    s.scripted ? `Scripting navigation and search leaves only ${r.pages} pages for the model to read.` : `The model reads all ${r.pages} pages itself.`,
    `Each task uses ${formatCount(r.tokens)} tokens, ${formatRupees(r.rupees, 2)} and ${r.seconds} s.`,
  ].join(' '),
  missions: {
    dyn: ({ state, result }) => state.sites === 'dynamic' && result.success >= 0.9,
    lean: ({ state, result }) => state.sites === 'dynamic' && isLean(result),
    html: ({ state, result }) => state.observation === 'html' && result.tokens >= 200000,
  },
});
