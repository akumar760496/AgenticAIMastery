import type { PlaygroundDefinition, Verdict } from '../domain/playground/PlaygroundDefinition';

export interface PlaygroundSnapshot<S, R> {
  readonly state: S;
  readonly result: R;
  readonly verdict: Verdict;
  readonly narrative: string;
  readonly completedMissions: readonly string[];
  readonly activePreset: string | null;
}

type Listener<S, R> = (snapshot: PlaygroundSnapshot<S, R>) => void;

/**
 * Application service that owns a playground's state.
 * Observer pattern: views subscribe and re-render from immutable snapshots;
 * they never compute results themselves.
 */
export class PlaygroundSession<S, R> {
  private state: S;
  private activePreset: string | null;
  private readonly listeners = new Set<Listener<S, R>>();

  constructor(private readonly definition: PlaygroundDefinition<S, R>) {
    const initial = definition.presets[definition.initialPreset];
    if (!initial) throw new Error(`${definition.techniqueId}: initial preset "${definition.initialPreset}" is not defined`);
    this.state = structuredClone(initial.state);
    this.activePreset = definition.initialPreset;
  }

  get snapshot(): PlaygroundSnapshot<S, R> {
    return PlaygroundSession.evaluate(this.definition, this.state, this.activePreset);
  }

  subscribe(listener: Listener<S, R>): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  applyPreset(key: string): void {
    const preset = this.definition.presets[key];
    if (!preset) throw new Error(`${this.definition.techniqueId}: unknown preset "${key}"`);
    this.state = structuredClone(preset.state);
    this.activePreset = key;
    this.notify();
  }

  /** Replace one field of the state. Controls call this; validation of shape is the type system's job. */
  update<K extends keyof S>(key: K, value: S[K]): void {
    this.state = { ...this.state, [key]: value };
    this.activePreset = null;
    this.notify();
  }

  /** Pure evaluation, shared by the session and by tests. */
  static evaluate<S, R>(definition: PlaygroundDefinition<S, R>, state: S, activePreset: string | null = null): PlaygroundSnapshot<S, R> {
    const result = definition.simulate(state);
    const completedMissions = Object.entries(definition.missions)
      .filter(([, isComplete]) => isComplete({ state, result }))
      .map(([key]) => key);
    return {
      state,
      result,
      verdict: definition.verdict(result, state),
      narrative: definition.narrate(result, state),
      completedMissions,
      activePreset,
    };
  }

  private notify(): void {
    const snapshot = this.snapshot;
    this.listeners.forEach((listener) => listener(snapshot));
  }
}
