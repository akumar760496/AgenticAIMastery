/**
 * Builds a FeatureModule from a slice's raw content, diagrams and playground map.
 * Every feature module calls this, so validation and wiring rules live in one place.
 */
import type { PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import type { FeatureModule, TechniqueBundle } from '@/domain/technique/FeatureModule';
import { ModuleContentSchema, TechniqueContentSchema } from '@/domain/technique/TechniqueContent';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PlaygroundMap = Readonly<Record<string, PlaygroundDefinition<any, any>>>;

export interface FeatureModuleSource {
  readonly title: string;
  readonly moduleJson: unknown;
  /** Result of import.meta.glob('./content/*.json', { eager: true }). */
  readonly contentFiles: Readonly<Record<string, { default: unknown }>>;
  /** Result of import.meta.glob('./content/diagrams/*.svg', { eager: true, query: '?raw', import: 'default' }). */
  readonly diagramFiles: Readonly<Record<string, string>>;
  readonly playgrounds: PlaygroundMap;
}

export function buildFeatureModule({ title, moduleJson, contentFiles, diagramFiles, playgrounds }: FeatureModuleSource): FeatureModule {
  const content = ModuleContentSchema.parse(moduleJson);
  const techniques: TechniqueBundle[] = content.techniqueOrder.map((id) => {
    const raw = contentFiles[`./content/${id}.json`];
    if (!raw) throw new Error(`${content.slug}: missing content file for "${id}"`);
    const techniqueContent = TechniqueContentSchema.parse(raw.default);
    const playground = playgrounds[id];
    if (!playground) throw new Error(`${content.slug}: no playground registered for "${id}"`);
    if (playground.techniqueId !== id) throw new Error(`${content.slug}: playground for "${id}" declares techniqueId "${playground.techniqueId}"`);
    return { content: techniqueContent, diagramSvg: diagramFiles[`./content/${techniqueContent.diagram.file}`] ?? '', playground };
  });
  return { slug: content.slug, title, content, techniques };
}
