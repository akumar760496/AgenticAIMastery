/**
 * Security feature module (Module 12): threat modelling, indirect injection, exfiltration, tool poisoning,
 * sandboxing, red-teaming, agent identity, memory poisoning and secrets handling.
 */
import { buildFeatureModule, type PlaygroundMap } from '@/application/FeatureModuleFactory';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import moduleJson from './content/module.json';
import { agentIdentityPlayground } from './playgrounds/agentIdentity.playground';
import { codeSandboxPlayground } from './playgrounds/codeSandbox.playground';
import { exfiltrationPlayground } from './playgrounds/exfiltration.playground';
import { indirectInjectionPlayground } from './playgrounds/indirectInjection.playground';
import { memoryPoisoningPlayground } from './playgrounds/memoryPoisoning.playground';
import { redTeamingPlayground } from './playgrounds/redTeaming.playground';
import { secretsHandlingPlayground } from './playgrounds/secretsHandling.playground';
import { threatModelPlayground } from './playgrounds/threatModel.playground';
import { toolPoisoningPlayground } from './playgrounds/toolPoisoning.playground';

export const SECURITY_PLAYGROUNDS: PlaygroundMap = {
  threatmodel: threatModelPlayground,
  indirect: indirectInjectionPlayground,
  exfil: exfiltrationPlayground,
  toolpoison: toolPoisoningPlayground,
  sandbox: codeSandboxPlayground,
  redteam: redTeamingPlayground,
  agentid: agentIdentityPlayground,
  mempoison: memoryPoisoningPlayground,
  secrets: secretsHandlingPlayground,
};

export const createSecurityModule = (): FeatureModule => buildFeatureModule({
  title: 'Security',
  moduleJson,
  contentFiles: import.meta.glob<{ default: unknown }>('./content/*.json', { eager: true }),
  diagramFiles: import.meta.glob<string>('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }),
  playgrounds: SECURITY_PLAYGROUNDS,
});
