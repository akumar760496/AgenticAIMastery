/**
 * Evaluation feature module (Module 1): wires validated content to its playground definitions.
 * This is the only file that knows which content belongs to which simulator.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { agentJudgePlayground } from './playgrounds/agentJudge.playground';
import { benchmarkPlayground } from './playgrounds/benchmarkComparison.playground';
import { evalDatasetPlayground } from './playgrounds/evalDataset.playground';
import { llmJudgePlayground } from './playgrounds/llmJudge.playground';
import { pairwisePlayground } from './playgrounds/pairwiseComparison.playground';
import { processEvalPlayground } from './playgrounds/processEval.playground';
import { ragMetricsPlayground } from './playgrounds/ragMetrics.playground';
import { systemEvalPlayground } from './playgrounds/systemEval.playground';
import { userSimulationPlayground } from './playgrounds/userSimulation.playground';

export const EVALUATION_PLAYGROUNDS: PlaygroundMap = {
  system: systemEvalPlayground,
  process: processEvalPlayground,
  llmjudge: llmJudgePlayground,
  agentjudge: agentJudgePlayground,
  rag: ragMetricsPlayground,
  bench: benchmarkPlayground,
  evaldata: evalDatasetPlayground,
  usersim: userSimulationPlayground,
  pairwise: pairwisePlayground,
};

export const createEvaluationModule = (): FeatureModule => buildFeatureModule({
  title: 'Evaluation',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: EVALUATION_PLAYGROUNDS,
});
