/**
 * Guardrails feature module (Module 2): input and output rails, layered checks,
 * zero-trust tool gating, PII redaction and grounding checks.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { groundingPlayground } from './playgrounds/groundingCheck.playground';
import { inputRailPlayground } from './playgrounds/inputRail.playground';
import { layeredChecksPlayground } from './playgrounds/layeredChecks.playground';
import { outputRailPlayground } from './playgrounds/outputRail.playground';
import { piiRedactionPlayground } from './playgrounds/piiRedaction.playground';
import { zeroTrustPlayground } from './playgrounds/zeroTrustTools.playground';

export const GUARDRAILS_PLAYGROUNDS: PlaygroundMap = {
  pre: inputRailPlayground,
  pii: piiRedactionPlayground,
  post: outputRailPlayground,
  det: layeredChecksPlayground,
  zt: zeroTrustPlayground,
  grounding: groundingPlayground,
};

export const createGuardrailsModule = (): FeatureModule => buildFeatureModule({
  title: 'Guardrails',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: GUARDRAILS_PLAYGROUNDS,
});
