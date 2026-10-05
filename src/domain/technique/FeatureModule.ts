import type { PlaygroundDefinition } from '../playground/PlaygroundDefinition';
import type { ModuleContent, TechniqueContent } from './TechniqueContent';

/** Everything the app needs to show one technique: validated content plus its playground. */
export interface TechniqueBundle {
  readonly content: TechniqueContent;
  readonly diagramSvg: string;
  // The playground's state and result types differ per technique; the session layer is generic over them.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly playground: PlaygroundDefinition<any, any>;
}

/** A vertical feature slice (one study module) that plugs into the registry. */
export interface FeatureModule {
  readonly slug: string;
  readonly title: string;
  readonly content: ModuleContent;
  readonly techniques: readonly TechniqueBundle[];
}
