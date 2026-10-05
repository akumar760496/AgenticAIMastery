import type { ProgressRepository, ProgressSnapshot } from '../../domain/progress/Progress';

/** Minimal shape of the Claude artifact runtime used here (only present when hosted as a Claude artifact). */
interface ArtifactDoc { get(): Promise<{ exists: boolean; data(): unknown }>; set(value: unknown): Promise<void> }
interface ArtifactRuntime {
  use(capability: 'db'): Promise<{ doc(path: string): ArtifactDoc } | null>;
  use(capability: 'user'): Promise<{ id(): Promise<string | null> } | null>;
}

/** Adapter: syncs progress across devices when the site runs as a Claude artifact with db and user capabilities. */
export class ClaudeArtifactProgressRepository implements ProgressRepository {
  private constructor(private readonly document: ArtifactDoc) {}

  /** Factory: returns null when the runtime or capabilities are missing, so the caller can fall back. */
  static async tryCreate(runtime: ArtifactRuntime | undefined): Promise<ClaudeArtifactProgressRepository | null> {
    try {
      if (!runtime) return null;
      const [db, user] = await Promise.all([runtime.use('db'), runtime.use('user')]);
      const userId = user ? await user.id() : null;
      if (!db || !userId) return null;
      return new ClaudeArtifactProgressRepository(db.doc(`data/users/${userId}/progress-v2`));
    } catch {
      return null;
    }
  }

  async load(): Promise<ProgressSnapshot> {
    const snap = await this.document.get();
    return snap.exists ? ((snap.data() as { progress?: ProgressSnapshot }).progress ?? {}) : {};
  }

  async save(snapshot: ProgressSnapshot): Promise<void> {
    await this.document.set({ progress: snapshot });
  }
}
