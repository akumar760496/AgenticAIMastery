/**
 * Fine-tuning feature module (Module 14): choosing an adaptation, SFT, preference tuning, RL with verifiable rewards,
 * distillation, evaluating tuned models, data curation and tuning agents on trajectories.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { adaptationChoicePlayground } from './playgrounds/adaptationChoice.playground';
import { agentTrajectoryTuningPlayground } from './playgrounds/agentTrajectoryTuning.playground';
import { dataCurationPlayground } from './playgrounds/dataCuration.playground';
import { distillationPlayground } from './playgrounds/distillation.playground';
import { preferenceTuningPlayground } from './playgrounds/preferenceTuning.playground';
import { supervisedFineTuningPlayground } from './playgrounds/supervisedFineTuning.playground';
import { tunedModelEvalPlayground } from './playgrounds/tunedModelEval.playground';
import { verifiableRewardsPlayground } from './playgrounds/verifiableRewards.playground';

export const FINE_TUNING_PLAYGROUNDS: PlaygroundMap = {
  decide: adaptationChoicePlayground,
  sft: supervisedFineTuningPlayground,
  dpo: preferenceTuningPlayground,
  rlvr: verifiableRewardsPlayground,
  distill: distillationPlayground,
  tuneeval: tunedModelEvalPlayground,
  datacur: dataCurationPlayground,
  ftagent: agentTrajectoryTuningPlayground,
};

export const createFineTuningModule = (): FeatureModule => buildFeatureModule({
  title: 'Fine-tuning and Model Adaptation',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: FINE_TUNING_PLAYGROUNDS,
});
