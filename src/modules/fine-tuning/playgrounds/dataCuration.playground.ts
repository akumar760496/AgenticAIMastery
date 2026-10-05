import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatRupees } from '@/shared/format';
import { simulateDataCuration, type DataCurationResult, type DataCurationState } from '../simulators/dataCuration';

const gapOf = (r: DataCurationResult) => r.reported - r.honest;
const isGood = (r: DataCurationResult) => r.contaminated === 0 && r.honest >= 90 && r.rare >= 85 && r.piiRows <= 100;

export const dataCurationPlayground = definePlayground<DataCurationState, DataCurationResult>({
  techniqueId: 'datacur',
  title: 'Curate Udaan Lend’s training set',
  intro: 'Udaan Lend, a fictional NBFC, is tuning a small model to classify and answer loan queries. It has 50,000 logged examples: 18% are copies, 9% have the wrong intent, 30% are one intent (EMI due date), 12% hold PII, and 400 are near-copies of items in the 2,000-item eval set.',
  controls: [
    { kind: 'select', key: 'dedup', label: 'Deduplication', options: [{ value: 'off', label: 'Off' }, { value: 'train', label: 'Exact + MinHash, within training data' }, { value: 'eval', label: 'Exact + MinHash, and against the eval set' }] },
    { kind: 'select', key: 'clean', label: 'Label cleaning', options: [{ value: 'none', label: 'None' }, { value: 'review', label: 'Model-assisted, 2,000 reviewed by people' }] },
    { kind: 'select', key: 'synthetic', label: 'Rare intents', options: [{ value: 'none', label: 'Real rows only' }, { value: 'raw', label: '+5,000 synthetic, unchecked' }, { value: 'verified', label: '+5,000 synthetic, verified' }] },
    { kind: 'toggle', key: 'rebalance', label: 'Rebalance: keep 1 in 3 EMI-date rows' },
    { kind: 'toggle', key: 'scrub', label: 'Scrub PII (Aadhaar, PAN, mobile, account numbers)' },
    { kind: 'note', text: 'Reviewers cost ₹40 a row. Verified synthetic rows are 5,000 kept from 8,000 generated, with 500 spot-checked by people. Honest accuracy is measured on eval items that are not in the training data.' },
  ],
  presets: {
    start: { state: { dedup: 'off', clean: 'none', rebalance: false, scrub: false, synthetic: 'none' }, expected: { size: 50000, honest: 81.4, reported: 84.9, rare: 58, piiRows: 6000 } },
    tidy: { state: { dedup: 'train', clean: 'review', rebalance: false, scrub: true, synthetic: 'none' }, expected: { size: 41000, honest: 87.5, reported: 89.8, piiRows: 98, reviewCost: 80000 } },
    rawsyn: { state: { dedup: 'eval', clean: 'none', rebalance: true, scrub: true, synthetic: 'raw' }, expected: { size: 37480, honest: 85.7, rare: 74 } },
    curated: { state: { dedup: 'eval', clean: 'review', rebalance: true, scrub: true, synthetic: 'verified' }, expected: { size: 37480, honest: 90.6, rare: 87, reviewCost: 100000 } },
  },
  initialPreset: 'start',
  simulate: simulateDataCuration,
  outputs: [
    { kind: 'value', label: 'Final dataset', value: (r) => `${formatCount(r.size)} rows`, detail: (r) => `${formatCount(r.real)} real${r.synthetic ? ` + ${formatCount(r.synthetic)} synthetic` : ''}; ${formatCount(r.wrongLabels)} with a wrong label` },
    { kind: 'meter', label: 'Honest eval accuracy', value: (r) => r.honest / 100, detail: () => '= on eval items the model never trained on', emphasis: (r) => (r.honest < 88 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Reported on the full eval set', value: (r) => `${formatFixed(r.reported, 1)}%`, detail: (r) => (gapOf(r) > 0 ? `${r.contaminated} eval items are in training: +${formatFixed(gapOf(r), 1)} points unearned` : 'no overlap with training, so it matches the honest score'), emphasis: (r) => (gapOf(r) > 0 ? 'warn' : 'normal') },
    { kind: 'meter', label: 'Rare-intent accuracy', value: (r) => r.rare / 100, detail: () => '= foreclosure, restructuring, grievance', emphasis: (r) => (r.rare < 80 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Rows still holding PII', value: (r) => formatCount(r.piiRows), emphasis: (r) => (r.piiRows > 100 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Human review cost', value: (r) => formatRupees(r.reviewCost) },
  ],
  verdict: (r) => {
    if (isGood(r)) return { tone: 'ok', headline: 'Small, clean and honest.', detail: 'Fewer rows than the raw logs, a better model, and a score you can trust.' };
    const tone = r.piiRows > 1000 || (gapOf(r) > 0 && r.honest < 85) ? 'no' : 'mid';
    if (r.piiRows > 1000) return { tone, headline: 'Personal data goes into the weights.', detail: 'Scrub Aadhaar, PAN, phone and account numbers before training.' };
    if (gapOf(r) > 0) return { tone, headline: 'The eval score is inflated.', detail: 'Deduplicate against the eval set too.' };
    if (r.rare < 80) return { tone, headline: 'Rare intents are still weak.', detail: 'Rebalance, and add verified synthetic rows for the thin intents.' };
    return { tone, headline: 'Close, but not there yet.', detail: r.honest < 90 ? 'Clean the labels and verify synthetic rows.' : 'Scrub the remaining PII.' };
  },
  narrate: (r, s) => [
    s.dedup === 'off' ? 'All 50,000 rows go in, copies included.' : s.dedup === 'train' ? 'Deduplication drops 9,000 copies, but the 400 eval near-copies stay.' : 'Deduplication drops 9,000 copies and the 400 eval near-copies.',
    s.clean === 'review' ? 'Model-assisted cleaning with 2,000 human reviews cuts wrong labels to about 1.5%.' : 'About 9% of labels are still wrong.',
    s.rebalance ? 'Keeping one in three EMI-date rows removes the skew.' : '',
    s.synthetic === 'verified' ? '5,000 verified synthetic rows fill the rare intents.' : s.synthetic === 'raw' ? '5,000 unchecked synthetic rows help rare intents a little, but 750 of them are wrong.' : '',
    `The final set has ${formatCount(r.size)} rows and scores ${formatFixed(r.honest, 1)}% on clean eval items${gapOf(r) > 0 ? `, though the full eval set reports ${formatFixed(r.reported, 1)}% because the model memorised the overlap` : ''}.`,
    `Rare intents reach ${r.rare}%.`,
    s.scrub ? `Scrubbing leaves ${formatCount(r.piiRows)} rows with PII for a second pass.` : `${formatCount(r.piiRows)} rows still hold customers’ personal data.`,
  ].filter(Boolean).join(' '),
  missions: {
    honest: ({ result }) => result.contaminated === 0 && result.honest >= 87,
    rare: ({ result }) => result.rare >= 85 && result.piiRows <= 100,
    lean: ({ result }) => result.size <= 38000 && result.honest >= 90 && result.piiRows <= 100,
  },
});
