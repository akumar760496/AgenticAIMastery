/** PII redaction for 1,000 daily support chats at a (fictional) NBFC holding 300 personal values. */
export type PiiDetector = 'regex' | 'checksum' | 'ner';
export type ReplacementMethod = 'redact' | 'placeholder';

export const DAILY_PII = { idNumbers: 180, namesAndAddresses: 120, total: 300, idTasks: 60 } as const;

export interface PiiRedactionState {
  readonly detector: PiiDetector;
  readonly normalise: boolean;
  readonly method: ReplacementMethod;
  readonly maskLogs: boolean;
}

export interface PiiRedactionResult {
  readonly reachingModel: number;
  readonly inLogs: number;
  readonly falseMasks: number;
  readonly idTasksDone: number;
  readonly latencyMs: number;
}

const FALSE_MASKS: Readonly<Record<PiiDetector, number>> = { regex: 45, checksum: 4, ner: 14 };

export function simulatePiiRedaction(state: PiiRedactionState): PiiRedactionResult {
  const idRecall = state.normalise ? 0.95 : 0.8;
  const nameRecall = state.detector === 'ner' ? 0.9 : 0;
  const reachingModel = Math.round(DAILY_PII.idNumbers * (1 - idRecall) + DAILY_PII.namesAndAddresses * (1 - nameRecall));
  return {
    reachingModel,
    inLogs: state.maskLogs ? reachingModel : DAILY_PII.total,
    falseMasks: FALSE_MASKS[state.detector],
    idTasksDone: state.method === 'placeholder' ? DAILY_PII.idTasks : Math.round(DAILY_PII.idTasks * (1 - idRecall)),
    latencyMs: state.detector === 'ner' ? 37 : 2,
  };
}
