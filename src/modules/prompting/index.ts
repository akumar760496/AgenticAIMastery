/**
 * Prompting feature module (Module 13): system prompts, few-shot examples, structured outputs, validation and repair,
 * prompt templates, prompting reasoning models, long-context prompting and multilingual prompting.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { fewShotPlayground } from './playgrounds/fewShot.playground';
import { longContextPlayground } from './playgrounds/longContext.playground';
import { multilingualPromptPlayground } from './playgrounds/multilingualPrompt.playground';
import { promptTemplatesPlayground } from './playgrounds/promptTemplates.playground';
import { reasoningPromptPlayground } from './playgrounds/reasoningPrompt.playground';
import { structuredOutputPlayground } from './playgrounds/structuredOutput.playground';
import { systemPromptPlayground } from './playgrounds/systemPrompt.playground';
import { validationRepairPlayground } from './playgrounds/validationRepair.playground';

export const PROMPTING_PLAYGROUNDS: PlaygroundMap = {
  sysprompt: systemPromptPlayground,
  fewshot: fewShotPlayground,
  schema: structuredOutputPlayground,
  repair: validationRepairPlayground,
  templates: promptTemplatesPlayground,
  reasonprompt: reasoningPromptPlayground,
  longctx: longContextPlayground,
  mlprompt: multilingualPromptPlayground,
};

export const createPromptingModule = (): FeatureModule => buildFeatureModule({
  title: 'Prompting and Structured Outputs',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: PROMPTING_PLAYGROUNDS,
});
