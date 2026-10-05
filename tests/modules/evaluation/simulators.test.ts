import { describe, expect, it } from 'vitest';
import { simulateSystemEval } from '@/modules/evaluation/simulators/systemEval';
import { simulateProcessEval } from '@/modules/evaluation/simulators/processEval';
import { simulateLlmJudge } from '@/modules/evaluation/simulators/llmJudge';
import { simulateEvalDataset, marginOfErrorPoints } from '@/modules/evaluation/simulators/evalDataset';
import { simulatePairwise } from '@/modules/evaluation/simulators/pairwiseComparison';
import { simulateUserSimulation } from '@/modules/evaluation/simulators/userSimulation';
import { simulateBenchmark } from '@/modules/evaluation/simulators/benchmarkComparison';

describe('system eval', () => {
  it('computes success, pass@k, pass^k and cost per success', () => {
    const runs = [[true, true, true], [true, false, true], [true, true, true], [false, false, true], [true, true, false]];
    const r = simulateSystemEval({ runs, costPerRun: 0.05 });
    expect(r.passingRuns).toBe(11);
    expect(r.passAtK).toBe(1);
    expect(r.passHatK).toBeCloseTo(0.4);
    expect(r.costPerSuccess).toBeCloseTo(0.75 / 11);
    expect(r.flakyTasks).toEqual([2, 4, 5]);
  });
  it('reports infinite cost per success when nothing passes', () => {
    const r = simulateSystemEval({ runs: [[false]], costPerRun: 0.1 });
    expect(r.costPerSuccess).toBe(Number.POSITIVE_INFINITY);
    expect(r.brokenTasks).toEqual([1]);
  });
});

describe('process eval', () => {
  it('treats a wrong currency as not an exact match even with the right steps', () => {
    const r = simulateProcessEval({ calls: ['find_order', 'get_account', 'issue_refund'], refundCurrency: 'USD' });
    expect(r.inOrderMatch).toBe(true);
    expect(r.exactMatch).toBe(false);
  });
  it('flags repeated and off-path calls as unnecessary', () => {
    const r = simulateProcessEval({ calls: ['find_order', 'lookup_fx', 'find_order'], refundCurrency: 'INR' });
    expect(r.unnecessaryCalls).toEqual(['lookup_fx', 'find_order']);
    expect(r.anyOrderMatch).toBe(false);
  });
});

describe('LLM judge', () => {
  it('lets position and verbosity bias pick the wrong answer', () => {
    const r = simulateLlmJudge({ settings: { showBFirst: true, positionBias: true, lengthEarnsNothing: false, runBothOrders: false } });
    expect(r.score.b).toBeCloseTo(1.2);
    expect(r.verdict).toBe('B');
  });
  it('turns an order-dependent verdict into a tie when both orders are run', () => {
    expect(simulateLlmJudge({ settings: { showBFirst: true, positionBias: true, lengthEarnsNothing: false, runBothOrders: true } }).verdict).toBe('tie');
  });
});

describe('eval dataset', () => {
  it('uses the 1.96 × √(p(1−p)/n) margin', () => {
    expect(marginOfErrorPoints(0.85, 200)).toBeCloseTo(4.95, 2);
  });
  it('only detects the regression with enough real, well-labelled cases', () => {
    expect(simulateEvalDataset({ caseCount: 200, source: 'production', labelling: 'single', refreshMonthly: false }).regressionDetected).toBe(false);
    expect(simulateEvalDataset({ caseCount: 1000, source: 'stratified', labelling: 'double', refreshMonthly: true }).regressionDetected).toBe(true);
  });
});

describe('pairwise comparison', () => {
  it('gives a 95% interval of about ±3.4 points at n = 800', () => {
    const r = simulatePairwise({ questions: 800, judgeBothOrders: true, shipRule: 'interval' });
    expect(r.halfWidth).toBeCloseTo(0.0344, 3);
    expect(r.lower).toBeGreaterThan(0.5);
  });
});

describe('user simulation', () => {
  it('computes pass^4 as p^4', () => {
    expect(simulateUserSimulation({ userSide: 'llm', difficultPersonas: true, runsPerScenario: 4 }).passHatK).toBeCloseTo(0.71 ** 4, 3);
  });
});

describe('benchmark comparison', () => {
  it('ranks Gamma first by cost per resolved task on internal scores', () => {
    expect(simulateBenchmark({ scoreSource: 'internal', rankBy: 'costPerResolved', tasksPerMonth: 10_000 }).topModel).toBe('Gamma');
  });
});
