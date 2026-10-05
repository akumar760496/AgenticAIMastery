import { describe, expect, it, vi } from 'vitest';
import { PlaygroundSession } from '@/application/PlaygroundSession';
import { ProgressService } from '@/application/ProgressService';
import { gradeAnswer, scoreQuiz } from '@/application/QuizGrader';
import { TechniqueRegistry } from '@/application/TechniqueRegistry';
import { InMemoryProgressRepository } from '@/infrastructure/progress/InMemoryProgressRepository';
import { pairwisePlayground } from '@/modules/evaluation/playgrounds/pairwiseComparison.playground';
import type { FeatureModule } from '@/domain/technique/FeatureModule';
import type { QuizQuestion } from '@/domain/technique/TechniqueContent';

describe('PlaygroundSession', () => {
  it('notifies subscribers and tracks missions as the state changes', () => {
    const session = new PlaygroundSession(pairwisePlayground);
    const listener = vi.fn();
    session.subscribe(listener);
    session.update('judgeBothOrders', false);
    session.update('questions', 200);
    const last = listener.mock.calls.at(-1)![0];
    expect(last.completedMissions).toContain('bias');
    expect(last.activePreset).toBeNull();
  });
  it('rejects unknown presets', () => {
    expect(() => new PlaygroundSession(pairwisePlayground).applyPreset('nope')).toThrow(/unknown preset/);
  });
});

describe('ProgressService', () => {
  it('merges missions and keeps the best quiz score', async () => {
    const repository = new InMemoryProgressRepository();
    const service = new ProgressService(repository);
    await service.initialise();
    await service.recordMissions('evaluation/pairwise', ['bias']);
    await service.recordMissions('evaluation/pairwise', ['bias', 'best']);
    await service.recordQuizScore('evaluation/pairwise', 0.8);
    await service.recordQuizScore('evaluation/pairwise', 0.6);
    expect(service.get('evaluation/pairwise')).toEqual({ completedMissions: ['bias', 'best'], bestQuizScore: 0.8 });
    expect(await repository.load()).toHaveProperty(['evaluation/pairwise', 'bestQuizScore'], 0.8);
  });
});

describe('QuizGrader', () => {
  const question: QuizQuestion = { id: 'q1', kind: 'multi', industry: 'Banking', question: '?', options: ['a', 'b', 'c', 'd'], correct: [0, 2], explanation: '.' };
  it('requires the exact set of correct options', () => {
    expect(gradeAnswer(question, [2, 0]).isCorrect).toBe(true);
    expect(gradeAnswer(question, [0]).isCorrect).toBe(false);
    expect(scoreQuiz([gradeAnswer(question, [0, 2]), gradeAnswer(question, [1])])).toBe(0.5);
  });
});

describe('TechniqueRegistry', () => {
  it('rejects duplicate modules', () => {
    const module = { slug: 'x', title: 'X', techniques: [], content: {} } as unknown as FeatureModule;
    const registry = new TechniqueRegistry().register(module);
    expect(() => registry.register(module)).toThrow(/already registered/);
  });
});
