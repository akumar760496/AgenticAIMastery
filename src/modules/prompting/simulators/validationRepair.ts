/** Validate-and-repair loop for schema-valid invoices: 8% fail a type check, 10% of the rest a business rule; ₹0.20 a call. */
export type RepairFeedback = 'generic' | 'specific';
export interface ValidationRepairState { readonly rules: boolean; readonly repairs: number; readonly feedback: RepairFeedback; readonly humanQueue: boolean }
export interface ValidationRepairResult { readonly firstFailure: number; readonly stillFailing: number; readonly silent: number; readonly clean: number; readonly queued: number; readonly dropped: number; readonly callsPerRecord: number; readonly rupeesPerRecord: number }

const RUPEES_PER_CALL = 0.2;
const TYPE_PASS = 0.92;
const RULE_PASS_AFTER_TYPES = 0.9;

export function simulateValidationRepair(s: ValidationRepairState): ValidationRepairResult {
  const firstFailure = s.rules ? 1 - TYPE_PASS * RULE_PASS_AFTER_TYPES : 1 - TYPE_PASS;
  const repairSuccess = s.feedback === 'specific' ? 0.7 : 0.35;
  const silent = s.rules ? 0.005 : TYPE_PASS * (1 - RULE_PASS_AFTER_TYPES);
  let stillFailing = firstFailure; let callsPerRecord = 1;
  for (let i = 0; i < s.repairs; i += 1) { callsPerRecord += stillFailing; stillFailing *= 1 - repairSuccess; }
  return {
    firstFailure, stillFailing, silent, clean: 1 - stillFailing - silent,
    queued: s.humanQueue ? stillFailing : 0, dropped: s.humanQueue ? 0 : stillFailing,
    callsPerRecord, rupeesPerRecord: callsPerRecord * RUPEES_PER_CALL,
  };
}
