/**
 * Domain contracts for an interactive playground.
 *
 * A playground is described declaratively: a pure `simulate` function (domain logic),
 * a list of control specs (inputs), output specs (what to show), a verdict and a narrative.
 * The presentation layer renders any definition generically, so no technique writes DOM code.
 */

export type Tone = 'ok' | 'mid' | 'no';
export type Emphasis = 'normal' | 'warn' | 'muted';

export interface Option<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

/** Keys of S whose values are of type V. Keeps control specs type-safe against the state shape. */
export type KeysOfType<S, V> = { [K in keyof S]-?: S[K] extends V ? K : never }[keyof S] & string;

export type ControlSpec<S> =
  | { readonly kind: 'select'; readonly key: KeysOfType<S, string | number>; readonly label: string; readonly options: readonly Option[] }
  | { readonly kind: 'choice'; readonly key: KeysOfType<S, string>; readonly label: string; readonly options: readonly Option[] }
  | { readonly kind: 'steps'; readonly key: KeysOfType<S, number>; readonly label: string; readonly values: readonly number[]; readonly format: (value: number) => string }
  | { readonly kind: 'toggle'; readonly key: KeysOfType<S, boolean>; readonly label: string; readonly isEnabled?: (state: S) => boolean }
  | { readonly kind: 'flagSet'; readonly key: KeysOfType<S, Readonly<Record<string, boolean>>>; readonly label: string; readonly options: readonly Option[] }
  | { readonly kind: 'booleanGrid'; readonly key: KeysOfType<S, readonly (readonly boolean[])[]>; readonly label: string; readonly rowLabel: (row: number) => string; readonly columnLabel: (column: number) => string }
  | { readonly kind: 'sequence'; readonly key: KeysOfType<S, readonly string[]>; readonly label: string; readonly palette: readonly string[]; readonly maxLength: number; readonly reference?: readonly string[] }
  | { readonly kind: 'note'; readonly text: string };

export type OutputSpec<R> =
  | { readonly kind: 'meter'; readonly label: string; readonly value: (result: R) => number; readonly detail?: (result: R) => string; readonly emphasis?: (result: R) => Emphasis }
  | { readonly kind: 'value'; readonly label: string; readonly value: (result: R) => string; readonly detail?: (result: R) => string; readonly emphasis?: (result: R) => Emphasis }
  | { readonly kind: 'check'; readonly label: string; readonly value: (result: R) => boolean; readonly detail?: (result: R) => string }
  | { readonly kind: 'badges'; readonly items: (result: R) => readonly { readonly text: string; readonly emphasis: Emphasis }[] }
  | { readonly kind: 'code'; readonly label: string; readonly value: (result: R) => string }
  | { readonly kind: 'itemList'; readonly title: string; readonly items: (result: R) => readonly ListItem[] }
  | { readonly kind: 'table'; readonly columns: readonly string[]; readonly rows: (result: R) => readonly (readonly string[])[]; readonly highlightFirstRow?: boolean };

/** One row of an itemList output: an input the simulator judged, with its outcome. */
export interface ListItem {
  readonly label: string;
  readonly text: string;
  readonly status: string;
  readonly tone: Tone | 'human';
  readonly detail?: string;
  /** Marks a harmful outcome so the row stands out. */
  readonly flagged?: boolean;
}

export interface Verdict {
  readonly tone: Tone;
  readonly headline: string;
  readonly detail: string;
}

export interface MissionContext<S, R> {
  readonly state: S;
  readonly result: R;
}

export type MissionPredicate<S, R> = (context: MissionContext<S, R>) => boolean;

export interface PresetDefinition<S, R> {
  readonly state: S;
  /** Values the simulator must produce for this preset; enforced by tests so copy and maths never drift. */
  readonly expected?: Partial<R>;
}

export interface PlaygroundDefinition<S, R> {
  readonly techniqueId: string;
  readonly title: string;
  readonly intro?: string;
  readonly controls: readonly ControlSpec<S>[];
  readonly presets: Readonly<Record<string, PresetDefinition<S, R>>>;
  /** Key of the preset loaded first. It must not complete any mission. */
  readonly initialPreset: string;
  readonly simulate: (state: S) => R;
  readonly outputs: readonly OutputSpec<R>[];
  readonly verdict: (result: R, state: S) => Verdict;
  readonly narrate: (result: R, state: S) => string;
  readonly missions: Readonly<Record<string, MissionPredicate<S, R>>>;
}

/** Helper that preserves literal types while letting TypeScript infer S and R. */
export const definePlayground = <S, R>(definition: PlaygroundDefinition<S, R>): PlaygroundDefinition<S, R> => definition;
