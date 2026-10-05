import { emptyTechniqueProgress, type ProgressRepository, type ProgressSnapshot, type TechniqueProgress } from '../domain/progress/Progress';

/** Use cases for learner progress. Depends only on the repository port, never on storage details. */
export class ProgressService {
  private snapshot: ProgressSnapshot = {};

  constructor(private readonly repository: ProgressRepository) {}

  async initialise(): Promise<void> {
    this.snapshot = await this.repository.load();
  }

  get(techniqueKey: string): TechniqueProgress {
    return this.snapshot[techniqueKey] ?? emptyTechniqueProgress();
  }

  async recordMissions(techniqueKey: string, missionKeys: readonly string[]): Promise<void> {
    const current = this.get(techniqueKey);
    const merged = [...new Set([...current.completedMissions, ...missionKeys])];
    if (merged.length === current.completedMissions.length) return;
    await this.write(techniqueKey, { ...current, completedMissions: merged });
  }

  async recordQuizScore(techniqueKey: string, score: number): Promise<void> {
    const current = this.get(techniqueKey);
    if (current.bestQuizScore !== null && current.bestQuizScore >= score) return;
    await this.write(techniqueKey, { ...current, bestQuizScore: score });
  }

  private async write(techniqueKey: string, progress: TechniqueProgress): Promise<void> {
    this.snapshot = { ...this.snapshot, [techniqueKey]: progress };
    await this.repository.save(this.snapshot);
  }
}
