/** Real-time vs batch API for a nightly ticket-tagging job, with retries and cached instructions. */
export type ApiMode = 'realtime' | 'batch';
export type RetryStrategy = 'failed' | 'all';
export type DeadlineStatus = 'guaranteed' | 'likely' | 'not guaranteed' | 'missed';

const FAILURE_RATE = 0.02;
const REQUESTS_PER_MINUTE = 2000;
export const BATCH_SIZE_LIMIT = 100000;
const BASELINE_PER_TICKET = 0.0075;

export interface BatchProcessingState {
  readonly tickets: number;
  readonly mode: ApiMode;
  readonly deadlineHours: number;
  readonly retry: RetryStrategy;
  readonly cacheInstructions: boolean;
}

export interface BatchProcessingResult {
  readonly costUsd: number;
  readonly baselineUsd: number;
  readonly relativeCost: number;
  readonly perTicketUsd: number;
  readonly minutes: number;
  readonly status: DeadlineStatus;
  readonly batches: number;
}

export function simulateBatchProcessing(s: BatchProcessingState): BatchProcessingResult {
  // 1,500 input tokens (1,000 shared) at $3/M and 200 output tokens at $15/M.
  const listPerTicket = ((s.cacheInstructions ? 500 * 3 + 1000 * 0.3 : 1500 * 3) + 200 * 15) / 1e6;
  const discount = s.mode === 'batch' ? 0.5 : 1;
  const extra = s.retry === 'failed' ? FAILURE_RATE : 1;
  const costUsd = s.tickets * listPerTicket * discount * (1 + extra);
  const baselineUsd = s.tickets * BASELINE_PER_TICKET * (1 + FAILURE_RATE);
  const minutes = (s.tickets * (1 + extra)) / REQUESTS_PER_MINUTE;
  const status: DeadlineStatus = s.mode === 'realtime'
    ? (minutes <= s.deadlineHours * 60 ? 'guaranteed' : 'missed')
    : s.deadlineHours >= 24 ? 'guaranteed' : s.deadlineHours >= 12 ? 'likely' : 'not guaranteed';
  return {
    costUsd, baselineUsd, relativeCost: costUsd / baselineUsd,
    perTicketUsd: listPerTicket * discount, minutes, status,
    batches: s.mode === 'batch' ? Math.ceil(s.tickets / BATCH_SIZE_LIMIT) : 0,
  };
}
