/**
 * Governance feature module (Module 15): DPDP readiness, financial regulators, the EU AI Act, framework mapping,
 * audit trails, system cards, vendor model risk, AI incident governance and content provenance.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { aiIncidentsPlayground } from './playgrounds/aiIncidents.playground';
import { auditTrailPlayground } from './playgrounds/auditTrail.playground';
import { contentProvenancePlayground } from './playgrounds/contentProvenance.playground';
import { dpdpReadinessPlayground } from './playgrounds/dpdpReadiness.playground';
import { euAiActPlayground } from './playgrounds/euAiAct.playground';
import { financialRegulationPlayground } from './playgrounds/financialRegulation.playground';
import { frameworkCoveragePlayground } from './playgrounds/frameworkCoverage.playground';
import { systemCardPlayground } from './playgrounds/systemCard.playground';
import { vendorRiskPlayground } from './playgrounds/vendorRisk.playground';

export const GOVERNANCE_PLAYGROUNDS: PlaygroundMap = {
  dpdp: dpdpReadinessPlayground,
  finreg: financialRegulationPlayground,
  euai: euAiActPlayground,
  frameworks: frameworkCoveragePlayground,
  audit: auditTrailPlayground,
  cards: systemCardPlayground,
  vendor: vendorRiskPlayground,
  aiincident: aiIncidentsPlayground,
  provenance: contentProvenancePlayground,
};

export const createGovernanceModule = (): FeatureModule => buildFeatureModule({
  title: 'Governance and Compliance',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: GOVERNANCE_PLAYGROUNDS,
});
