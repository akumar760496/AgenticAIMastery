import { describe, expect, it } from 'vitest';
import { simulateGrounding } from '@/modules/guardrails/simulators/groundingCheck';
import { simulateInputRail } from '@/modules/guardrails/simulators/inputRail';
import { simulateLayeredChecks } from '@/modules/guardrails/simulators/layeredChecks';
import { simulateOutputRail } from '@/modules/guardrails/simulators/outputRail';
import { simulatePiiRedaction } from '@/modules/guardrails/simulators/piiRedaction';
import { simulateZeroTrust } from '@/modules/guardrails/simulators/zeroTrustTools';

describe('input rail', () => {
  it('misses indirect injection when only user messages are screened', () => {
    const r = simulateInputRail({ mask: false, screenUser: true, screenDocuments: false, threshold: 50 });
    expect(r.missedAttacks).toEqual([5, 8]);
    expect(r.blockedLegitimate).toEqual([6]);
  });
  it('stops exactly three attacks with no false positive between 0.65 and 0.85', () => {
    for (const threshold of [65, 75, 85]) {
      const r = simulateInputRail({ mask: true, screenUser: true, screenDocuments: true, threshold });
      expect([r.attacksStopped, r.legitimateBlocked]).toEqual([3, 0]);
    }
  });
});

describe('output rail', () => {
  it('escalation sends caught drafts to a person and adds no retry calls', () => {
    const r = simulateOutputRail({ checks: { schema: true, grounding: true, toxicity: true, leakage: true }, onFailure: 'human', stream: false });
    expect([r.toPerson, r.modelCalls, r.defectsSeen]).toEqual([6, 10, 0]);
  });
});

describe('layered checks', () => {
  it('lets every harmful request through when nothing checks', () => {
    expect(simulateLayeredChecks({ exact: 'off', meaning: 'off', threshold: 0.7 }).harmfulLetThrough).toBe(95);
  });
});

describe('zero trust', () => {
  it('lets only the cross-customer read through with a shared admin key', () => {
    const r = simulateZeroTrust({ defaultRule: 'deny', scopeEmail: true, credential: 'admin', approvalLimit: 30000 });
    expect(r.harmfulIds).toEqual([7]);
  });
  it('asks once when the limit sits between the genuine and injected refunds', () => {
    const r = simulateZeroTrust({ defaultRule: 'deny', scopeEmail: true, credential: 'task', approvalLimit: 20000 });
    expect([r.harmfulActions, r.approvalPrompts, r.genuineCompleted]).toEqual([0, 1, 4]);
  });
});

describe('PII redaction', () => {
  it('patterns without checksums mask 45 innocent numbers a day', () => {
    expect(simulatePiiRedaction({ detector: 'regex', normalise: true, method: 'placeholder', maskLogs: true }).falseMasks).toBe(45);
  });
});

describe('grounding', () => {
  it('ignores the threshold for detectors that do not use one', () => {
    expect(simulateGrounding({ detector: 'llm', threshold: 0.3, regenerate: false })).toEqual(simulateGrounding({ detector: 'llm', threshold: 0.7, regenerate: false }));
  });
  it('an over-strict claim checker refuses more than 1,000 good answers', () => {
    expect(simulateGrounding({ detector: 'claims', threshold: 0.3, regenerate: false }).goodRefused).toBe(1410);
  });
});
