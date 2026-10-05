import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatCount, formatFixed, formatWholePercent } from '@/shared/format';
import { simulateEvalDataset, TOTAL_INTENTS, type EvalDatasetResult, type EvalDatasetState } from '../simulators/evalDataset';

const SOURCE_DESCRIPTION: Record<EvalDatasetState['source'], string> = {
  synthetic: 'generated from the FAQ',
  production: 'sampled at random from March traffic',
  stratified: 'stratified by intent, language and risk, 10% of them adversarial',
};

export const evalDatasetPlayground = definePlayground<EvalDatasetState, EvalDatasetResult>({
  techniqueId: 'evaldata',
  title: 'Build Suraksha General’s claims test set',
  intro: 'Suraksha General, a fictional Indian insurer, runs a claims assistant that is right about 85% of the time on real traffic. Real traffic spans 12 intents, and 20% of it is Hindi or Hinglish. The next release is truly 4 points worse: Hindi answers drop 15 points (3 points overall) and the new flood-claim intent drops 20 points (1 point overall).',
  controls: [
    { kind: 'select', key: 'caseCount', label: 'Number of cases', options: [{ value: '50', label: '50' }, { value: '200', label: '200' }, { value: '1000', label: '1,000' }] },
    { kind: 'select', key: 'source', label: 'Cases come from', options: [
      { value: 'synthetic', label: 'Synthetic only (generated from the FAQ)' },
      { value: 'production', label: 'A random production sample (March)' },
      { value: 'stratified', label: 'Stratified production + 10% adversarial' },
    ] },
    { kind: 'select', key: 'labelling', label: 'Labelling', options: [{ value: 'single', label: 'One annotator' }, { value: 'double', label: 'Two annotators + adjudication' }] },
    { kind: 'toggle', key: 'refreshMonthly', label: 'Refresh monthly from new production failures' },
    { kind: 'note', text: 'A label takes 3 minutes; adjudicating a disagreement takes 5. The regression counts as detected when the measured drop is larger than the 95% margin for a difference between two scores, √2 × the single-score margin.' },
  ],
  presets: {
    start: { state: { caseCount: 50, source: 'synthetic', labelling: 'single', refreshMonthly: false }, expected: { regressionDetected: false, intentsCovered: 6, hindiCases: 0 } },
    prod: { state: { caseCount: 200, source: 'production', labelling: 'single', refreshMonthly: false }, expected: { regressionDetected: false, hindiCases: 40 } },
    strat: { state: { caseCount: 200, source: 'stratified', labelling: 'double', refreshMonthly: true }, expected: { intentsCovered: 12, hindiCases: 50, adversarialCases: 20 } },
    big: { state: { caseCount: 1000, source: 'stratified', labelling: 'double', refreshMonthly: true }, expected: { regressionDetected: true, intentsCovered: 12 } },
  },
  initialPreset: 'start',
  simulate: simulateEvalDataset,
  outputs: [
    { kind: 'value', label: 'Measured accuracy', value: (r) => `${formatWholePercent(r.measuredAccuracy)} ± ${formatFixed(r.marginPoints)} points`, detail: (r) => `= 1.96 × √(${r.measuredAccuracy} × ${(1 - r.measuredAccuracy).toFixed(2)} ÷ ${formatCount(r.mainCases)})` },
    { kind: 'meter', label: 'Intents covered', value: (r) => r.intentsCovered / TOTAL_INTENTS, detail: (r) => `= ${r.intentsCovered} of ${TOTAL_INTENTS} with at least 3 cases`, emphasis: (r) => (r.intentsCovered < TOTAL_INTENTS ? 'warn' : 'normal') },
    { kind: 'value', label: 'Hindi / Hinglish cases', value: (r) => formatCount(r.hindiCases), detail: (r) => (r.hindiMarginPoints !== null ? `Hindi slice margin ±${formatFixed(r.hindiMarginPoints)} points` : 'the Hindi slice is invisible') + (r.adversarialCases ? ` · ${r.adversarialCases} adversarial cases scored separately` : '') },
    { kind: 'value', label: 'Label noise', value: (r) => formatWholePercent(r.labelNoise), detail: (r) => `${formatFixed(r.labellingHours)} hours of labelling`, emphasis: (r) => (r.labelNoise > 0.05 ? 'warn' : 'normal') },
    { kind: 'check', label: '4-point regression detected', value: (r) => r.regressionDetected, detail: (r) => `measured drop ${r.measuredDropPoints.toFixed(2)} points vs margin ±${formatFixed(r.differenceMarginPoints)}` },
  ],
  verdict: (r, s) => {
    if (r.regressionDetected && r.intentsCovered === TOTAL_INTENTS) return { tone: 'ok', headline: 'The set sees the regression.', detail: 'Enough real, stratified, well-labelled cases, and the new failures are in the set.' };
    if (r.regressionDetected) return { tone: 'mid', headline: 'Detected, with gaps.', detail: 'Some intents still have too few cases.' };
    return s.source === 'synthetic'
      ? { tone: 'no', headline: 'Clean, confident and blind.', detail: 'Synthetic cases hide the Hindi and flood-claim failures.' }
      : { tone: 'no', headline: 'The regression slips through.', detail: 'Too few cases, or too much label noise, to separate a real drop from chance.' };
  },
  narrate: (r, s) => {
    const parts = [
      `${formatCount(s.caseCount)} cases ${SOURCE_DESCRIPTION[s.source]}.`,
      `The set reports ${formatWholePercent(r.measuredAccuracy)} accuracy with a 95% margin of ±${formatFixed(r.marginPoints)} points${s.source === 'synthetic' ? ', but that number is about easy synthetic questions, not real claims' : ''}.`,
      `It covers ${r.intentsCovered} of the ${TOTAL_INTENTS} intents and ${r.hindiCases ? `${formatCount(r.hindiCases)} Hindi cases` : 'no Hindi at all'}.`,
      `${s.labelling === 'double' ? 'Two annotators and adjudication leave' : 'A single annotator leaves'} about ${formatWholePercent(r.labelNoise)} of labels wrong, which shrinks any real change to ${formatWholePercent(1 - 2 * r.labelNoise)} of its size.`,
      `The real 4-point drop shows up as ${r.measuredDropPoints.toFixed(2)} points against a margin of ±${formatFixed(r.differenceMarginPoints)}, so it is ${r.regressionDetected ? 'detected' : 'missed'}.`,
    ];
    if (!s.refreshMonthly) parts.push('Without a refresh, the new flood-claim failures never enter the set.');
    return parts.join(' ');
  },
  missions: {
    detect: ({ result }) => result.regressionDetected,
    cover: ({ result: r }) => r.intentsCovered === TOTAL_INTENTS && r.hindiCases >= 40 && r.adversarialCases > 0 && r.labelNoise <= 0.03 && r.labellingHours <= 25,
    illusion: ({ state, result }) => state.source === 'synthetic' && result.marginPoints < 2 && !result.regressionDetected,
  },
});
