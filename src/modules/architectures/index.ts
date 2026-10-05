/**
 * Agent architectures feature module (Module 7): workflows, ReAct, plan-and-execute, reflection,
 * tree search, reasoning budgets, human-in-the-loop checkpoints and code actions.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { codeActionsPlayground } from './playgrounds/codeActions.playground';
import { humanInTheLoopPlayground } from './playgrounds/humanInTheLoop.playground';
import { planExecutePlayground } from './playgrounds/planExecute.playground';
import { reactLoopPlayground } from './playgrounds/reactLoop.playground';
import { reasoningBudgetPlayground } from './playgrounds/reasoningBudget.playground';
import { reflectionPlayground } from './playgrounds/reflection.playground';
import { treeSearchPlayground } from './playgrounds/treeSearch.playground';
import { workflowPatternsPlayground } from './playgrounds/workflowPatterns.playground';

export const ARCHITECTURES_PLAYGROUNDS: PlaygroundMap = {
  workflows: workflowPatternsPlayground,
  react: reactLoopPlayground,
  planexec: planExecutePlayground,
  reflect: reflectionPlayground,
  search: treeSearchPlayground,
  reasoning: reasoningBudgetPlayground,
  hitl: humanInTheLoopPlayground,
  codeact: codeActionsPlayground,
};

export const createArchitecturesModule = (): FeatureModule => buildFeatureModule({
  title: 'Agent architectures',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: ARCHITECTURES_PLAYGROUNDS,
});
