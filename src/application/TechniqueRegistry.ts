import type { FeatureModule, TechniqueBundle } from '../domain/technique/FeatureModule';

/**
 * Registry pattern: feature modules register themselves here instead of writing to globals.
 * Lookups are explicit, and duplicate ids fail fast at start-up.
 */
export class TechniqueRegistry {
  private readonly modules = new Map<string, FeatureModule>();
  private readonly techniques = new Map<string, { module: FeatureModule; bundle: TechniqueBundle }>();

  register(module: FeatureModule): this {
    if (this.modules.has(module.slug)) throw new Error(`Module "${module.slug}" is already registered`);
    for (const bundle of module.techniques) {
      const key = TechniqueRegistry.key(module.slug, bundle.content.id);
      if (this.techniques.has(key)) throw new Error(`Technique "${key}" is already registered`);
      this.techniques.set(key, { module, bundle });
    }
    this.modules.set(module.slug, module);
    return this;
  }

  listModules(): readonly FeatureModule[] {
    return [...this.modules.values()];
  }

  getModule(slug: string): FeatureModule | undefined {
    return this.modules.get(slug);
  }

  getTechnique(moduleSlug: string, techniqueId: string): TechniqueBundle | undefined {
    return this.techniques.get(TechniqueRegistry.key(moduleSlug, techniqueId))?.bundle;
  }

  private static key(moduleSlug: string, techniqueId: string): string {
    return `${moduleSlug}/${techniqueId}`;
  }
}
