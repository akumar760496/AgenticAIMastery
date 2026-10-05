/** Helpers for checklist-style state: a record of named boolean flags. */
export type Flags = Readonly<Record<string, boolean>>;

/** Builds a flag record over `keys`, with only the keys in `on` set. */
export const flagsFrom = (keys: readonly string[], on: readonly string[] = []): Flags =>
  Object.fromEntries(keys.map((k) => [k, on.includes(k)]));

/** Keys whose flag is set, in catalogue order. */
export const enabledKeys = (keys: readonly string[], flags: Flags): string[] => keys.filter((k) => flags[k] === true);
