import type { QuizQuestion } from '../domain/technique/TechniqueContent';

export interface GradedAnswer {
  readonly questionId: string;
  readonly isCorrect: boolean;
}

/** Pure use case: grades selected option indexes against the answer key. */
export const gradeAnswer = (question: QuizQuestion, selected: readonly number[]): GradedAnswer => {
  const expected = [...question.correct].sort();
  const actual = [...new Set(selected)].sort();
  const isCorrect = expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  return { questionId: question.id, isCorrect };
};

export const scoreQuiz = (answers: readonly GradedAnswer[]): number =>
  answers.length === 0 ? 0 : answers.filter((answer) => answer.isCorrect).length / answers.length;
