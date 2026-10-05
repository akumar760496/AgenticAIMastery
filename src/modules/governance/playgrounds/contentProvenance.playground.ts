import { definePlayground } from '@/domain/playground/PlaygroundDefinition';
import { formatWholePercent } from '@/shared/format';
import { simulateProvenance, type ProvenanceResult, type ProvenanceState } from '../simulators/contentProvenance';

const isBest = (r: ProvenanceResult) => r.requirementsMet === 3 && r.survival >= 0.9;
const OPENING = {
  none: 'Assets leave with no mark at all',
  visible: 'A visible band and a spoken disclosure tell viewers, until a crop or edit removes them',
  meta: 'Signed credentials record the origin, but many apps strip them on upload',
} as const;

export const contentProvenancePlayground = definePlayground<ProvenanceState, ProvenanceResult>({
  techniqueId: 'provenance',
  title: 'Mark Rangmanch Studio’s AI media',
  intro: 'Rangmanch Studio is a fictional media studio. Assets are shared through messaging and social apps that crop, screenshot and re-encode. The requirement checks are an illustrative reading, not legal advice.',
  controls: [
    { kind: 'select', key: 'labelling', label: 'Labelling', options: [{ value: 'none', label: 'None' }, { value: 'visible', label: 'Visible label and audio disclosure' }, { value: 'meta', label: 'Visible label + signed C2PA metadata' }] },
    { kind: 'toggle', key: 'watermark', label: 'Invisible watermark tied to the asset id' },
    { kind: 'toggle', key: 'locked', label: 'Users cannot remove labels or metadata' },
  ],
  presets: {
    start: { state: { labelling: 'none', watermark: false, locked: false }, expected: { survival: 0, requirementsMet: 0 } },
    visible: { state: { labelling: 'visible', watermark: false, locked: true }, expected: { survival: 0.6, requirementsMet: 2 } },
    c2pa: { state: { labelling: 'meta', watermark: false, locked: true }, expected: { survival: 0.7, requirementsMet: 3, costPer1000: 20 } },
    full: { state: { labelling: 'meta', watermark: true, locked: true }, expected: { survival: 0.955, requirementsMet: 3, costPer1000: 80 } },
  },
  initialPreset: 'start',
  simulate: simulateProvenance,
  outputs: [
    { kind: 'meter', label: 'Still identifiable as AI after sharing', value: (r) => r.survival, emphasis: (r) => (r.survival < 0.7 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Requirements met (label, identifier, not removable)', value: (r) => `${r.requirementsMet} of 3`, emphasis: (r) => (r.requirementsMet < 3 ? 'warn' : 'normal') },
    { kind: 'value', label: 'Extra cost per 1,000 assets', value: (r) => `₹${r.costPer1000}` },
  ],
  verdict: (r) => {
    if (isBest(r)) return { tone: 'ok', headline: 'Labelled, traceable and hard to strip.', detail: 'Visible label, credentials and watermark, locked in the tool.' };
    if (r.requirementsMet === 0) return { tone: 'no', headline: 'Nothing marks the media as AI-made.', detail: 'Start with a visible label and audio disclosure.' };
    if (r.survival < 0.75) return { tone: 'mid', headline: 'Marks disappear when shared.', detail: 'Add an invisible watermark; metadata is often stripped.' };
    return { tone: 'mid', headline: 'Close, but a gap remains.', detail: 'Check the identifier and the lock.' };
  },
  narrate: (r, s) => `${OPENING[s.labelling]}. ${s.watermark ? 'The watermark survives most re-encoding. ' : ''}${formatWholePercent(r.survival)} stay identifiable; ${r.requirementsMet} of 3 requirements met.`,
  missions: {
    best: ({ result }) => isBest(result),
    strip: ({ state, result }) => state.labelling === 'meta' && !state.watermark && result.survival < 0.75,
    cheap: ({ result }) => isBest(result) && result.costPer1000 <= 70,
  },
});
