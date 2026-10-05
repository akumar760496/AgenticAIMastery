import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatRupees, formatWholePercent } from '@/shared/format';
import { simulateDistillation, type DistillationResult, type DistillationState } from '../simulators/distillation';

const isGood = (r: DistillationResult) => r.blended >= 0.9 && r.billShare <= 0.3;

export const distillationPlayground = definePlayground<DistillationState, DistillationResult>({
  techniqueId: 'distill',
  title: 'Distil a travel assistant',
  intro: '2 million queries a month. The frontier teacher scores 92% at ₹0.90 a query (₹18 lakh a month). A student costs ₹0.08 a query, plus about ₹30,000 a month for training and hosting.',
  controls: [
    { kind: 'select', key: 'student', label: 'Student', options: [{ value: '1', label: '1B' }, { value: '8', label: '8B' }] },
    { kind: 'select', key: 'examples', label: 'Teacher answers', options: [{ value: '1000', label: '1,000' }, { value: '10000', label: '10,000' }, { value: '50000', label: '50,000' }] },
    { kind: 'toggle', key: 'filter', label: 'Filter out wrong teacher answers' },
    { kind: 'toggle', key: 'rationales', label: 'Train on the teacher’s reasoning too' },
    { kind: 'steps', key: 'share', label: 'Traffic to the student', values: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], format: (v) => `${v}%` },
  ],
  presets: {
    start: { state: { student: 1, examples: 10000, filter: false, rationales: false, share: 0 }, expected: { studentAccuracy: 0.77, monthlyCost: 1800000 } },
    big: { state: { student: 8, examples: 50000, filter: true, rationales: true, share: 50 }, expected: { studentAccuracy: 0.91, blended: 0.915, billShare: 0.5611 } },
    weak: { state: { student: 1, examples: 1000, filter: false, rationales: false, share: 100 }, expected: { blended: 0.73, billShare: 0.1056 } },
    half: { state: { student: 8, examples: 10000, filter: false, rationales: false, share: 60 }, expected: { studentAccuracy: 0.87, blended: 0.89, billShare: 0.47 } },
  },
  initialPreset: 'start',
  simulate: simulateDistillation,
  outputs: [
    { kind: 'meter', label: 'Student accuracy', value: (r) => r.studentAccuracy, detail: () => '= teacher scores 92%', emphasis: (r) => (r.studentAccuracy < 0.9 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Accuracy across all traffic', value: (r) => r.blended, detail: () => '= student share plus teacher fallback', emphasis: (r) => (r.blended < 0.9 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Monthly bill', value: (r) => formatRupees(r.monthlyCost) },
    { kind: 'value', label: 'Share of all-teacher bill', value: (r) => formatWholePercent(r.billShare) },
  ],
  verdict: (r, s) => (isGood(r)
    ? { tone: 'ok', headline: 'Cheaper and almost as good.', detail: 'A strong student takes most traffic; the teacher handles the rest.' }
    : r.blended < 0.87 ? { tone: 'no', headline: 'Quality has dropped.', detail: 'A weak student is answering too much of the traffic.' }
      : s.share === 0 ? { tone: 'mid', headline: 'All traffic on the teacher.', detail: 'Train a student and route traffic to it.' }
        : { tone: 'mid', headline: 'Some savings so far.', detail: 'Route more traffic once the student is strong enough.' }),
  narrate: (r, s) => [
    `The ${s.student}B student, tuned on ${formatCount(s.examples)} ${s.filter ? 'filtered ' : ''}teacher answers${s.rationales ? ' with reasoning' : ''}, scores ${formatWholePercent(r.studentAccuracy)}.`,
    s.share ? `With ${s.share}% of traffic on it, accuracy across all queries is ${formatFixed(r.blended * 100, 1)}% and the bill is ${formatRupees(r.monthlyCost)}, ${formatWholePercent(r.billShare)} of the all-teacher bill.` : 'No traffic is routed to it yet, so the bill is unchanged at ₹18 lakh.',
  ].join(' '),
  missions: {
    student: ({ result }) => result.studentAccuracy >= 0.9,
    route: ({ result }) => isGood(result),
    weak: ({ state, result }) => state.share >= 50 && result.blended < 0.87,
  },
});
