/**
 * Computer use and multimodal feature module (Module 17): GUI agents, browser agents, voice agents, document reading,
 * action safety, evaluating agents, Indic speech and telephony.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { actionSafetyPlayground } from './playgrounds/actionSafety.playground';
import { agentEvaluationPlayground } from './playgrounds/agentEvaluation.playground';
import { browserAgentPlayground } from './playgrounds/browserAgent.playground';
import { documentReadingPlayground } from './playgrounds/documentReading.playground';
import { guiAgentPlayground } from './playgrounds/guiAgent.playground';
import { indicSpeechPlayground } from './playgrounds/indicSpeech.playground';
import { telephonyPlayground } from './playgrounds/telephony.playground';
import { voiceAgentPlayground } from './playgrounds/voiceAgent.playground';

export const COMPUTER_USE_PLAYGROUNDS: PlaygroundMap = {
  gui: guiAgentPlayground,
  browser: browserAgentPlayground,
  voice: voiceAgentPlayground,
  multimodal: documentReadingPlayground,
  actsafe: actionSafetyPlayground,
  agenteval: agentEvaluationPlayground,
  indicspeech: indicSpeechPlayground,
  telephony: telephonyPlayground,
};

export const createComputerUseModule = (): FeatureModule => buildFeatureModule({
  title: 'Computer Use and Multimodal Agents',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: COMPUTER_USE_PLAYGROUNDS,
});
