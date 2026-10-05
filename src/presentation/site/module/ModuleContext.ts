import type { PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import type { ModuleData, Technique } from '../content';
import type { SxScene } from '../sx/SxPlayer';

/** Everything a technique pane needs from the page it lives on. */
export interface ModuleContext {
  readonly data: ModuleData;
  /** Base URL of the hub, for links such as "mark as confident on the track page". */
  readonly hubUrl: string;
  /** Public path of this module's assets (GIFs). */
  readonly assetBase: string;
  readonly playground: (techniqueId: string) => PlaygroundDefinition<any, any> | undefined;
  readonly technique: (id: string) => Technique | undefined;
  /** Step-through "See it run" scene for a technique, when the module has one. */
  readonly scene: (id: string) => SxScene | undefined;
  readonly selectTechnique: (id: string, focus?: boolean) => void;
  readonly gotoPane: (pane: string) => void;
  readonly glossify: (root: Element | null) => void;
  /** Teardown hooks run when the technique detail is re-rendered (timers, sessions). */
  readonly onCleanup: (fn: () => void) => void;
}
