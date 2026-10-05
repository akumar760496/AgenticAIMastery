import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatWholePercent } from '@/shared/format';
import { APPROVAL_LIMITS, CAREFUL_LIMIT, WRONG_MONEY_INR, simulateHitl, type HitlResult, type HitlState } from '../simulators/humanInTheLoop';

const inr = (v: number) => `₹${formatCount(Math.round(v))}`;
const limitLabel = (v: number) => (v === 0 ? 'every refund' : v < 0 ? 'no checkpoint' : `over ${inr(v)}`);
const good = (r: HitlResult) => r.stoppedShare >= 0.75 && r.perReviewer <= CAREFUL_LIMIT && !r.lost && !r.backlog;

export const humanInTheLoopPlayground = definePlayground<HitlState, HitlResult>({
  techniqueId: 'hitl',
  title: 'Approve KhataPay’s refunds (fictional)',
  intro: '1,000 refund requests a day; the agent gets 3% wrong: 30 refunds worth ₹6,00,000, mostly the larger ones. A careful review takes 2 minutes with evidence, 30 seconds without; past 150 reviews a day each, reviewers approve on autopilot. One deploy a day restarts the servers.',
  controls: [
    { kind: 'steps', key: 'limit', label: 'Pause for approval', values: APPROVAL_LIMITS, format: limitLabel },
    { kind: 'select', key: 'view', label: 'Reviewer sees', options: [{ value: 'bare', label: 'Only “Approve refund? yes / no”' }, { value: 'evidence', label: 'Amount, reason and evidence' }] },
    { kind: 'steps', key: 'reviewers', label: 'Reviewers on shift', values: [1, 2, 3, 4, 5], format: String },
    { kind: 'select', key: 'store', label: 'Paused runs are kept', options: [{ value: 'memory', label: 'In the server’s memory' }, { value: 'durable', label: 'In a database (durable checkpoint)' }] },
  ],
  presets: {
    start: { state: { limit: 0, view: 'bare', reviewers: 2, store: 'memory' }, expected: { paused: 1000, perReviewer: 500, stoppedInr: 144000, lost: 250 } },
    limit: { state: { limit: 10000, view: 'evidence', reviewers: 2, store: 'durable' }, expected: { paused: 90, perReviewer: 45, stoppedInr: 427500, lost: 0 } },
    none: { state: { limit: -1, view: 'evidence', reviewers: 2, store: 'durable' }, expected: { paused: 0, stoppedInr: 0 } },
    tuned: { state: { limit: 5000, view: 'evidence', reviewers: 2, store: 'durable' }, expected: { paused: 200, perReviewer: 100, stoppedInr: 484500 } },
  },
  // The legacy start preset already demonstrates the 'stamp' mission, so open on the no-checkpoint baseline.
  initialPreset: 'none',
  simulate: simulateHitl,
  outputs: [
    { kind: 'value', label: 'Paused for review', value: (r) => `${formatCount(r.paused)} of 1,000`, detail: (r) => `${r.wrongPaused} of the 30 wrong refunds are among them` },
    { kind: 'meter', label: 'Wrong refunds stopped', value: (r) => r.stoppedShare, detail: (r) => `= ${inr(r.stoppedInr)} of ${inr(WRONG_MONEY_INR)}`, emphasis: (r) => (r.stoppedShare < 0.75 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Reviews per reviewer', value: (r) => `${formatCount(Math.round(r.perReviewer))} a day`, detail: (r) => (r.perReviewer > CAREFUL_LIMIT ? 'over 150: approvals on autopilot' : 'within a careful pace'), emphasis: (r) => (r.perReviewer > CAREFUL_LIMIT ? 'warn' : 'normal') },
    { kind: 'value', label: 'Wait for a decision', value: (r) => (r.backlog ? `${formatCount(r.backlog)} left unreviewed` : r.paused ? `${Math.round(r.waitMin)} min` : 'none') },
    { kind: 'value', label: 'Paused runs lost at the deploy', value: (r) => formatCount(r.lost), emphasis: (r) => (r.lost ? 'warn' : 'normal') },
  ],
  verdict: (r, s) => {
    if (good(r)) return { tone: 'ok', headline: 'Checkpoints where they count.', detail: 'The limit pauses the risky few, and reviewers have time to read the evidence.' };
    if (s.limit < 0) return { tone: 'no', headline: 'Nothing stops a wrong refund.', detail: 'Every wrong refund is paid out.' };
    if (r.backlog) return { tone: 'no', headline: 'The queue cannot keep up.', detail: 'Raise the limit, show less per card, or add reviewers.' };
    if (r.stoppedShare < 0.4) return { tone: 'no', headline: 'Reviewers are approving on autopilot.', detail: 'Too many pauses, too little to go on.' };
    return { tone: 'mid', headline: 'Close, but not there yet.', detail: r.lost ? 'Keep paused runs in a database.' : r.perReviewer > CAREFUL_LIMIT ? 'Each reviewer has too many cases.' : 'A lower limit would catch more of the wrong money.' };
  },
  narrate: (r, s) => (s.limit < 0 ? 'With no checkpoint the agent pays every refund it proposes, so all 30 wrong refunds, ₹6,00,000, go out.' : [
    `${s.limit === 0 ? 'Every refund' : `Every refund ${limitLabel(s.limit)}`} pauses: ${formatCount(r.paused)} a day, or ${formatCount(Math.round(r.perReviewer))} for each of ${s.reviewers} reviewers.`,
    r.perReviewer > CAREFUL_LIMIT ? `That is more than a person can read carefully, so only ${formatWholePercent(r.catchRate)} of wrong refunds in the queue are caught.` : `At that pace reviewers catch ${formatWholePercent(r.catchRate)} of the wrong refunds they see.`,
    s.view === 'bare' ? 'A bare yes-or-no card gives them nothing to check against.' : 'The card shows the amount, reason and evidence, so they can spot a duplicate or a wrong account.',
    `Together that stops ${inr(r.stoppedInr)} of the ₹6,00,000.`,
    r.lost ? `The daily deploy wipes ${r.lost} paused runs held in memory; those customers never get an answer.` : '',
  ].filter(Boolean).join(' ')),
  missions: {
    catch: ({ result }) => result.stoppedShare >= 0.75 && result.perReviewer <= CAREFUL_LIMIT && !result.backlog,
    stamp: ({ state, result }) => state.limit === 0 && result.catchRate < 0.5,
    durable: ({ state, result }) => state.store === 'durable' && result.paused > 0 && !result.lost && result.stoppedShare >= 0.7,
  },
});
