import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatFixed } from '@/shared/format';
import { simulateCitations, type CitationResult, type CitationState } from '../simulators/groundedCitations';

const isTrusted = (r: CitationResult) => r.unsupportedRate <= 0.02 && r.outdated === 0 && r.declined >= 18 && r.answered >= 76;
const full: CitationState = { prompt: 'grounded', citations: 'sentence', verify: true, filterSuperseded: true, abstain: true };

export const groundedCitationsPlayground = definePlayground<CitationState, CitationResult>({
  techniqueId: 'cite',
  title: 'Ground Kaveri Bank’s staff assistant',
  intro: 'Kaveri Bank is fictional. 100 test questions: 80 answerable (for 20 of them an older, superseded policy is also in the index) and 20 the policies do not answer.',
  controls: [
    { kind: 'select', key: 'prompt', label: 'Prompt', options: [{ value: 'free', label: '“Answer the question”' }, { value: 'grounded', label: '“Answer only from the documents”' }] },
    { kind: 'select', key: 'citations', label: 'Citations', options: [{ value: 'none', label: 'None' }, { value: 'answer', label: 'A source list per answer' }, { value: 'sentence', label: 'A source after every sentence' }] },
    { kind: 'toggle', key: 'verify', label: 'Verify citations in code and drop unsupported sentences' },
    { kind: 'toggle', key: 'filterSuperseded', label: 'Filter out superseded policy versions' },
    { kind: 'toggle', key: 'abstain', label: 'Say “not found” when nothing supports an answer' },
  ],
  presets: {
    start: { state: { prompt: 'grounded', citations: 'answer', verify: false, filterSuperseded: false, abstain: false }, expected: { unsupportedAnswers: 7, outdated: 8, declined: 12 } },
    free: { state: { prompt: 'free', citations: 'none', verify: false, filterSuperseded: false, abstain: false }, expected: { unsupportedAnswers: 14, declined: 2, checkSeconds: 90 } },
    full: { state: full, expected: { unsupportedAnswers: 1, answered: 77, outdated: 0, declined: 19 } },
    nofilter: { state: { ...full, filterSuperseded: false }, expected: { outdated: 8, verified: true } },
  },
  initialPreset: 'start',
  simulate: simulateCitations,
  outputs: [
    { kind: 'meter', label: 'Answers with an unsupported claim', value: (r) => r.unsupportedRate, detail: (r) => `= ${r.unsupportedAnswers} of ${r.answered}`, emphasis: (r) => (r.unsupportedRate > 0.02 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Answers quoting a superseded policy', value: (r) => String(r.outdated), emphasis: (r) => (r.outdated ? 'warn' : 'normal') },
    { kind: 'value', label: 'Unanswerable questions declined', value: (r) => `${r.declined} of 20`, emphasis: (r) => (r.declined < 18 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Time for staff to check an answer', value: (r) => `${r.checkSeconds} s` },
  ],
  verdict: (r) => {
    if (isTrusted(r)) return { tone: 'ok', headline: 'Every sentence is traceable and current.', detail: 'Unsupported sentences are dropped and old versions never reach the model.' };
    const tone = r.unsupportedRate > 0.1 || r.declined < 10 ? 'no' : 'mid';
    if (r.unsupportedRate > 0.1) return { tone, headline: 'Too many confident inventions.', detail: 'Ground the prompt, cite each sentence and verify.' };
    if (r.outdated) return { tone, headline: 'Correctly cited, but outdated.', detail: 'A citation to a superseded policy passes verification; filter by version.' };
    if (r.declined < 18) return { tone, headline: 'It still answers what it cannot know.', detail: 'Add the abstain rule, with verification.' };
    return { tone, headline: 'Close, but not there yet.', detail: 'Cite each sentence and verify.' };
  },
  narrate: (r, s) => [
    s.prompt === 'free' ? 'A free prompt lets the model fill gaps from its own knowledge,' : 'Grounding the prompt halves invented claims,',
    s.citations === 'none' ? 'and with no citations staff need about 90 seconds to check each answer.' : s.citations === 'answer' ? 'and a source list lets staff check an answer in about 40 seconds.' : 'and a source after each sentence lets staff check an answer in about 15 seconds.',
    r.verified ? 'Verification drops sentences whose cited text is not in the source.' : '',
    s.filterSuperseded ? 'Superseded versions are filtered out before retrieval.' : '8 answers quote an outdated policy, and their citations are perfectly valid, so verification cannot catch them.',
    `${formatFixed(r.declined, 0)} of the 20 unanswerable questions are declined.`,
  ].filter(Boolean).join(' '),
  missions: {
    trust: ({ result }) => isTrusted(result),
    stale: ({ result }) => result.verified && result.outdated > 0,
    nocite: ({ state, result }) => state.prompt === 'free' && state.citations === 'none' && result.unsupportedRate >= 0.15,
  },
});
