import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { EPISODIC_START, simulateEpisodic, type EpisodicResult, type EpisodicState } from '../simulators/episodicMemory';

const WEIGHTS = [0, 0.5, 1, 1.5, 2, 2.5, 3];
const st = (recencyWeight: number, importanceWeight: number, relevanceWeight: number): EpisodicState => ({ recencyWeight, importanceWeight, relevanceWeight, topK: 3, reflection: false });

export const episodicMemoryPlayground = definePlayground<EpisodicState, EpisodicResult>({
  techniqueId: 'epimem',
  title: 'New task: “PAN lookup for a month-end KYC batch”',
  intro: '12 past episodes. Recency = 0.995 per hour of age; each score is min-max normalised to 0–1 before weighting. Episode transcripts cost 350 tokens each, lessons 60.',
  controls: [
    { kind: 'steps', key: 'recencyWeight', label: 'Recency weight', values: WEIGHTS, format: String },
    { kind: 'steps', key: 'importanceWeight', label: 'Importance weight', values: WEIGHTS, format: String },
    { kind: 'steps', key: 'relevanceWeight', label: 'Relevance weight', values: WEIGHTS, format: String },
    { kind: 'steps', key: 'topK', label: 'Top-k episodes', values: [1, 2, 3, 4, 5], format: String },
    { kind: 'toggle', key: 'reflection', label: 'Reflection: inject lessons instead of episode transcripts' },
  ],
  presets: {
    start: { state: EPISODIC_START, expected: { first: 'Balance enquiry answered', targetRank: 10, tokens: 1050 } },
    equal: { state: st(1, 1, 1), expected: { targetRank: 1, firstTrivial: false } },
    relonly: { state: st(0, 0, 1), expected: { targetRank: 1 } },
    imp: { state: st(0, 3, 0), expected: { targetRank: 1 } },
  },
  initialPreset: 'start',
  simulate: simulateEpisodic,
  outputs: [
    { kind: 'table', columns: ['#', 'Episode', 'Rec · Imp · Rel', 'Score'], rows: (r) => r.ranking.slice(0, 6).map((e, i) => [String(i + 1), `${e.name}${e.target ? ' ★' : ''}`, `${e.recency.toFixed(2)} · ${e.importance.toFixed(2)} · ${e.relevance.toFixed(2)}`, e.score.toFixed(2)]) },
    { kind: 'value', label: 'Rank of the PAN timeout', value: (r) => `${r.targetRank} of 12`, emphasis: (r) => (r.retrieved ? 'normal' : 'warn') },
    { kind: 'check', label: 'Retrieved into the prompt', value: (r) => r.retrieved },
    { kind: 'value', label: 'Prompt tokens', value: (r) => String(r.tokens) },
  ],
  verdict: (r) => ({ tone: r.retrieved && !r.firstTrivial ? 'ok' : r.retrieved ? 'mid' : 'no', headline: r.retrieved ? 'The PAN timeout reaches the prompt.' : 'The lesson that matters is missed.', detail: r.firstTrivial ? 'A trivial recent episode ranks first.' : 'The top episode is worth reading.' }),
  narrate: (r, s) => [
    `With weights ${s.recencyWeight} for recency, ${s.importanceWeight} for importance and ${s.relevanceWeight} for relevance, “${r.first}” ranks first and the PAN timeout ranks ${r.targetRank} of 12.`,
    r.firstTrivial ? 'Recency is winning: a trivial event from the last few hours outranks everything useful.' : '',
    r.retrieved ? `The three-week-old failure is in the top ${s.topK}, so the agent can avoid repeating it.` : `Only the top ${s.topK} reach the prompt, so the failure that explains this task is left out.`,
    s.reflection ? `Reflection injects short lessons: ${r.tokens} tokens.` : `Full transcripts cost ${r.tokens} tokens.`,
  ].filter(Boolean).join(' '),
  missions: {
    top3: ({ result }) => result.targetRank <= 3,
    refl: ({ state, result }) => state.reflection && result.retrieved && result.tokens <= result.startTokens / 2,
    trivial: ({ result }) => !result.firstTrivial,
  },
});
