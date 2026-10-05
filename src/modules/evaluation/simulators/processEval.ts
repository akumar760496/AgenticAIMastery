/** Process-level eval: compare an agent's tool-call trajectory against a reference path. */
export const REFERENCE_PATH = ['find_order', 'get_account', 'issue_refund'] as const;
export const AVAILABLE_TOOLS = ['find_order', 'get_account', 'lookup_fx', 'issue_refund'] as const;

export interface ProcessEvalState {
  readonly calls: readonly string[];
  readonly refundCurrency: 'USD' | 'INR';
}

export interface ProcessEvalResult {
  readonly exactMatch: boolean;
  readonly inOrderMatch: boolean;
  readonly anyOrderMatch: boolean;
  readonly stepEfficiency: number;
  readonly argumentsCorrect: boolean;
  readonly unnecessaryCalls: readonly string[];
}

const isInOrderSubsequence = (reference: readonly string[], calls: readonly string[]): boolean => {
  let cursor = 0;
  for (const call of calls) if (call === reference[cursor]) cursor += 1;
  return cursor === reference.length;
};

export function simulateProcessEval({ calls, refundCurrency }: ProcessEvalState): ProcessEvalResult {
  const reference: readonly string[] = REFERENCE_PATH;
  const argumentsCorrect = !calls.includes('issue_refund') || refundCurrency === 'INR';
  const sameSequence = calls.join() === reference.join();
  return {
    exactMatch: sameSequence && argumentsCorrect,
    inOrderMatch: isInOrderSubsequence(reference, calls),
    anyOrderMatch: reference.every((step) => calls.includes(step)),
    stepEfficiency: calls.length ? Math.min(1, reference.length / calls.length) : 0,
    argumentsCorrect,
    unnecessaryCalls: calls.filter((call, index) => !reference.includes(call) || calls.indexOf(call) !== index),
  };
}
