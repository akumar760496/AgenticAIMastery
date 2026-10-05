import type { ProgressRepository, ProgressSnapshot } from '../../domain/progress/Progress';

/** Adapter for tests and for environments without storage. */
export class InMemoryProgressRepository implements ProgressRepository {
  constructor(private snapshot: ProgressSnapshot = {}) {}
  async load(): Promise<ProgressSnapshot> { return this.snapshot; }
  async save(snapshot: ProgressSnapshot): Promise<void> { this.snapshot = snapshot; }
}
