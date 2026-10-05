import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { simulateSubAgents, type SubAgentsResult, type SubAgentsState } from '../simulators/subAgents';

const k = (v: number) => `${Number(v.toFixed(1)).toLocaleString('en-IN')}k`;
const inr = (v: number) => `₹${formatCount(Math.round(v))}`;
const good = (r: SubAgentsResult) => r.coverage >= 0.999 && r.conflicts === 0 && r.orchestratorK <= 20 && r.wallMin <= 30;

export const subAgentsPlayground = definePlayground<SubAgentsState, SubAgentsResult>({
  techniqueId: 'subagents',
  title: 'Dalal Lens Research: 12 pharma results (fictional)',
  intro: 'Each company has 40k tokens of filings and takes 10 minutes to analyse. Every sub-agent adds 40k tokens of overhead and 3 minutes to start; windows hold 200k tokens; tokens cost ₹0.40 per 1,000. The orchestrator plans for 2 minutes and merges in 2 from cards or 8 from transcripts.',
  controls: [
    { kind: 'select', key: 'subAgents', label: 'Sub-agents', options: [{ value: '1', label: '1 (one agent does all 12)' }, { value: '3', label: '3 (4 companies each)' }, { value: '6', label: '6 (2 companies each)' }, { value: '12', label: '12 (one company each)' }] },
    { kind: 'select', key: 'returns', label: 'Each sub-agent returns', options: [{ value: 'full', label: 'Its full transcript' }, { value: 'sum', label: 'A condensed card, at most 500 tokens per company' }] },
    { kind: 'select', key: 'coupling', label: 'Task coupling', options: [{ value: 'indep', label: 'Independent: sector figures are in every brief' }, { value: 'shared', label: 'Shared dependencies: each works out USD/INR and API prices itself' }] },
    { kind: 'toggle', key: 'mergeCheck', label: 'Orchestrator merge check (3 minutes; 4k tokens + 2k per conflict)' },
  ],
  presets: {
    start: { state: { subAgents: 3, returns: 'full', coupling: 'shared', mergeCheck: false }, expected: { wallMin: 58, totalK: 1293.5, orchestratorK: 603.5, conflicts: 8 } },
    wide: { state: { subAgents: 12, returns: 'sum', coupling: 'shared', mergeCheck: false }, expected: { wallMin: 22, coverage: 1, orchestratorK: 14, totalK: 1334, duplicatedK: 330, conflicts: 11 } },
    checked: { state: { subAgents: 6, returns: 'sum', coupling: 'shared', mergeCheck: true }, expected: { conflicts: 0, coverage: 1, wallMin: 35, totalK: 935, orchestratorK: 35 } },
    single: { state: { subAgents: 1, returns: 'sum', coupling: 'indep', mergeCheck: false }, expected: { wallMin: 127, totalK: 528.5, conflicts: 0 } },
  },
  initialPreset: 'start',
  simulate: simulateSubAgents,
  outputs: [
    { kind: 'value', label: 'Wall-clock', value: (r) => `${r.wallMin} min` },
    { kind: 'value', label: 'Total tokens · cost', value: (r) => `${k(r.totalK)} · ${inr(r.costInr)}`, detail: (r) => (r.duplicatedK ? `${k(r.duplicatedK)} of it is duplicated lookups` : '') },
    { kind: 'value', label: 'Orchestrator context', value: (r) => `${k(r.orchestratorK)} tokens`, emphasis: (r) => (r.orchestratorK > 200 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Coverage of the 12 companies', value: (r) => r.coverage, emphasis: (r) => (r.coverage < 0.999 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Conflicting findings', value: (r) => `${r.conflicts} of 12`, emphasis: (r) => (r.conflicts ? 'warn' : 'normal') },
  ],
  verdict: (r) => {
    if (good(r)) return { tone: 'ok', headline: 'Fast, complete and consistent.', detail: 'Independent pieces, condensed cards and shared inputs passed in.' };
    const tone = r.coverage < 0.6 || r.orchestratorK > 200 ? 'no' : 'mid';
    if (r.orchestratorK > 200) return { tone, headline: 'The orchestrator’s context overflows.', detail: 'Transcripts bring all the raw reading back: return condensed cards.' };
    if (r.coverage < 0.999) return { tone, headline: `${formatWholePercent(1 - r.coverage)} of the analysis is lost.`, detail: 'Too much per context: add sub-agents or return cards.' };
    if (r.conflicts) return { tone, headline: 'The comparison contradicts itself.', detail: 'Pass the sector figures in every brief, or turn on the merge check.' };
    if (r.wallMin > 30) return { tone, headline: 'Correct, but slow.', detail: 'More sub-agents, or removing the shared lookups, would cut the minutes.' };
    return { tone, headline: 'Close, but the orchestrator is carrying too much.', detail: 'Remove the shared lookups so the merge check has nothing to fix.' };
  },
  narrate: (r, s) => [
    `${s.subAgents === 1 ? 'One agent handles all 12 companies' : `Each of the ${s.subAgents} sub-agents takes ${r.perAgent} companies`} in a ${k(r.subAgentK)}-token context${r.subAgentCoverage < 1 ? `, more than a 200k window, so only ${formatWholePercent(r.subAgentCoverage)} is analysed properly` : ''}.`,
    s.returns === 'sum' ? `Only condensed cards come back, so the orchestrator holds ${k(r.orchestratorK)}.` : `Full transcripts come back, so the orchestrator must hold ${k(r.orchestratorK)}${r.orchestratorK > 200 ? ` and can use only ${formatWholePercent(r.fit)} of it` : ''}.`,
    s.coupling === 'shared' && s.subAgents > 1 ? `Each sub-agent works out USD/INR and API prices itself: ${k(r.duplicatedK)} of duplicated work and ${r.conflictsFound} companies judged on different figures${s.mergeCheck ? ', which the merge check reconciles' : ''}.` : '',
    `Wall-clock ${r.wallMin} minutes, ${k(r.totalK)} tokens, ${inr(r.costInr)}.`,
  ].filter(Boolean).join(' '),
  missions: {
    fast: ({ result }) => good(result),
    agree: ({ state, result }) => state.coupling === 'shared' && result.conflicts === 0 && result.wallMin < 30,
    cheap: ({ result }) => result.coverage >= 0.999 && result.costInr < 250,
  },
});
