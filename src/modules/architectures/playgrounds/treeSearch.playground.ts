import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { simulateTreeSearch, type TreeSearchResult, type TreeSearchState } from '../simulators/treeSearch';

const ONE_TO_FIVE = [1, 2, 3, 4, 5];

export const treeSearchPlayground = definePlayground<TreeSearchState, TreeSearchResult>({
  techniqueId: 'search',
  title: 'Sequence a van’s delivery drops',
  intro: 'A valid route needs the right stop at each of 3 levels. The right first stop is the model’s 2nd most likely proposal, and the right third stop only its 3rd. Each proposal costs one call to generate and one to evaluate (₹0.20 per call); a third of candidates are pruned as impossible.',
  controls: [
    { kind: 'steps', key: 'proposals', label: 'Proposals per state, k', values: ONE_TO_FIVE, format: String },
    { kind: 'steps', key: 'beam', label: 'Beam, b (states kept per level)', values: ONE_TO_FIVE, format: String },
    { kind: 'steps', key: 'depth', label: 'Depth limit, d', values: [1, 2, 3, 4], format: String },
    { kind: 'select', key: 'evaluator', label: 'Evaluator', options: [{ value: 'noisy', label: 'Noisy value prompt' }, { value: 'good', label: 'Good checker' }] },
  ],
  presets: {
    start: { state: { proposals: 3, beam: 2, depth: 3, evaluator: 'noisy' }, expected: { solved: false, calls: 30 } },
    chain: { state: { proposals: 1, beam: 1, depth: 3, evaluator: 'good' }, expected: { solved: false, calls: 6 } },
    good: { state: { proposals: 3, beam: 2, depth: 3, evaluator: 'good' }, expected: { solved: true, calls: 30, costInr: 6 } },
    wide: { state: { proposals: 5, beam: 2, depth: 3, evaluator: 'noisy' }, expected: { solved: false, calls: 50 } },
  },
  initialPreset: 'start',
  simulate: simulateTreeSearch,
  outputs: [
    { kind: 'check', label: 'Valid route found', value: (r) => r.solved },
    { kind: 'value', label: 'Model calls · cost', value: (r) => `${r.calls} · ₹${r.costInr.toFixed(2)}` },
    { kind: 'table', columns: ['Level', 'Candidates', 'Pruned', 'Kept', 'Right branch'], rows: (r) => r.levels.map((l, i) => [`L${i + 1}`, String(l.candidates), String(l.pruned), String(l.kept), !l.proposed ? 'not proposed' : l.survived ? `kept (rank ${l.rank})` : `dropped (rank ${l.rank})`]) },
  ],
  verdict: (r, s) => {
    if (r.solved) return r.calls < 40 ? { tone: 'ok', headline: 'Solved within budget.', detail: `${r.calls} calls against 6 for a single chain, which cannot solve it.` } : { tone: 'mid', headline: 'Solved, but expensively.', detail: `${r.calls} calls.` };
    return { tone: 'no', headline: 'No valid route.', detail: s.proposals < 3 ? 'The right stops are not among the proposals: raise k.' : s.depth < 3 ? 'Allow at least 3 levels.' : 'The evaluator ranks the right branch too low for the beam.' };
  },
  narrate: (r, s) => [
    `Each level generates ${r.levels.map((l) => l.candidates).join(', ')} candidates and keeps at most ${s.beam}; that is ${r.calls} model calls.`,
    s.proposals < 3 ? `With k = ${s.proposals} the model never proposes all the stops it needs, so no beam can save it.`
      : s.evaluator === 'noisy' && !r.solved ? `The noisy evaluator ranks the right branch as low as 3rd, so a beam of ${s.beam} drops it; more proposals only add calls.`
        : r.solved ? (s.evaluator === 'noisy' ? 'A wider beam keeps the right branch despite the noisy scores.' : 'The good checker ranks the right branch first, so even a narrow beam keeps it.') : '',
    'A plain chain (k = b = 1) fails here, because the right first stop is only the model’s second choice.',
  ].filter(Boolean).join(' '),
  missions: {
    under: ({ result }) => result.solved && result.calls < 40,
    beam: ({ state, result }) => state.evaluator === 'noisy' && state.proposals === 3 && result.solved,
    chain: ({ result }) => result.solved && result.calls <= 18,
  },
});
