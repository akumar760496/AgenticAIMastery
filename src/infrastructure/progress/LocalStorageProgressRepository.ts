import type { ProgressRepository, ProgressSnapshot } from '../../domain/progress/Progress';

/** Adapter: keeps progress in this browser. Storage can be unavailable (private mode), so every access is guarded. */
export class LocalStorageProgressRepository implements ProgressRepository {
  constructor(private readonly storageKey = 'aam.progress.v2', private readonly storage: Storage | undefined = globalThis.localStorage) {}

  async load(): Promise<ProgressSnapshot> {
    try {
      const raw = this.storage?.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as ProgressSnapshot) : {};
    } catch {
      return {};
    }
  }

  async save(snapshot: ProgressSnapshot): Promise<void> {
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify(snapshot));
    } catch {
      /* storage full or blocked: progress stays in memory for this visit */
    }
  }
}
