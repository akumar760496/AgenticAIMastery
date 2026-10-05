/**
 * Operations feature module (Module 11): tracing, versioning, canary releases, online evaluation,
 * durable execution, resilience, incident response and feedback loops.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { canaryReleasePlayground } from './playgrounds/canaryRelease.playground';
import { durableExecutionPlayground } from './playgrounds/durableExecution.playground';
import { feedbackLoopsPlayground } from './playgrounds/feedbackLoops.playground';
import { incidentResponsePlayground } from './playgrounds/incidentResponse.playground';
import { onlineEvaluationPlayground } from './playgrounds/onlineEvaluation.playground';
import { resiliencePlayground } from './playgrounds/resilience.playground';
import { tracingPlayground } from './playgrounds/tracing.playground';
import { versioningPlayground } from './playgrounds/versioning.playground';

export const OPERATIONS_PLAYGROUNDS: PlaygroundMap = {
  tracing: tracingPlayground,
  versioning: versioningPlayground,
  canary: canaryReleasePlayground,
  onlineeval: onlineEvaluationPlayground,
  durable: durableExecutionPlayground,
  resilience: resiliencePlayground,
  incident: incidentResponsePlayground,
  feedback: feedbackLoopsPlayground,
};

export const createOperationsModule = (): FeatureModule => buildFeatureModule({
  title: 'Operations',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: OPERATIONS_PLAYGROUNDS,
});
