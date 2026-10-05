/** Learner progress: which missions are done and the best quiz score per technique. */
export interface TechniqueProgress {
  readonly completedMissions: readonly string[];
  readonly bestQuizScore: number | null;
}

export type ProgressSnapshot = Readonly<Record<string, TechniqueProgress>>;

export const emptyTechniqueProgress = (): TechniqueProgress => ({ completedMissions: [], bestQuizScore: null });

/** Port: implemented by infrastructure adapters (browser storage, Claude artifact database, in-memory). */
export interface ProgressRepository {
  load(): Promise<ProgressSnapshot>;
  save(snapshot: ProgressSnapshot): Promise<void>;
}
