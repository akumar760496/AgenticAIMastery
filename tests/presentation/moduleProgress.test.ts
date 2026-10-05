/**
 * Evidence-based module progress: what the learner demonstrated, as opposed to what they clicked.
 *
 * The two things worth holding down are that a revealed capstone answer is not a solved one, and
 * that a quiz score reaches the hub without the learner pressing "Save score to Study Hub" — missing
 * that button used to throw the score away.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { HubData, ModuleData } from '@/presentation/site/content';
import { demonstrated, goalsProgress, moduleRollup, quizBest, touched } from '@/presentation/site/module/moduleProgress';
import { capstoneProgress } from '@/presentation/site/module/capstone';
import { HubProgress } from '@/presentation/site/hub/HubProgress';

const hub = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/hub.json'), 'utf8')) as HubData;
const prompting = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/modules/prompting.json'), 'utf8')) as ModuleData;
const N = prompting.n;
const cases = prompting.cx?.cases ?? [];

beforeEach(() => { localStorage.clear(); });

const attempt = (k: string, s: number, n = 10) => ({ k, at: Date.now(), s, n, ids: [], miss: [] });
const putQuiz = (...att: ReturnType<typeof attempt>[]) => localStorage.setItem(`qz-p${N}`, JSON.stringify({ v: 1, att, q: {} }));
const putCase = (id: string, st: Record<string, unknown>) => localStorage.setItem(`capstone-p${N}-${id}`, JSON.stringify(st));

describe('quiz evidence', () => {
  it('is nothing before a quiz is touched', () => {
    expect(quizBest(N)).toEqual({ best: null, tried: false });
    expect(touched(moduleRollup(prompting))).toBe(false);
  });

  it('takes the best full run, and ignores partial ones', () => {
    putQuiz(attempt('mix', 5), attempt('mix', 8), attempt('mix', 6));
    expect(quizBest(N).best).toBe(8);
    // A per-technique run is not the 10-question mix the hub has always scored on.
    putQuiz(attempt('sysprompt', 10, 4));
    expect(quizBest(N)).toEqual({ best: null, tried: true });
  });

  it('reaches the hub without the learner pressing "Save score"', () => {
    putQuiz(attempt('mix', 9));
    const p = new HubProgress(hub);
    p.setRollup(N, moduleRollup(prompting));
    expect(p.state.quiz[`p${N}`]?.best, 'the score was in module storage all along').toBe(9);
    // modStatus keeps the older, softer rule; `demonstrated` is the strict one.
    expect(p.modStatus(N).done, 'a 9 clears the 7-out-of-10 bar').toBe(true);
  });

  it('never lowers a best that is already recorded', () => {
    const p = new HubProgress(hub);
    p.recordQuiz(N, 10);
    putQuiz(attempt('mix', 4));
    p.setRollup(N, moduleRollup(prompting));
    expect(p.state.quiz[`p${N}`]?.best).toBe(10);
  });
});

describe('capstone evidence', () => {
  it('does not count a revealed answer as a solved case', () => {
    // `shown` is set both when the plan is right and when the hints run out and the answer is given
    // away. Only the first is evidence of anything.
    expect(cases.length, 'prompting should have authored cases').toBeGreaterThan(0);
    putCase(cases[0]?.id as string, { shown: true, tries: 4, sel: ['sysprompt'] });
    const cap = capstoneProgress(prompting);
    expect(cap.done, 'the answer was seen').toBe(1);
    expect(cap.solved, 'but it was not solved').toBe(0);
    expect(demonstrated(moduleRollup(prompting))).toBe(false);
    expect(touched(moduleRollup(prompting)), 'it is still work in progress').toBe(true);
  });

  it('counts a case whose plan was right', () => {
    putCase(cases[0]?.id as string, { shown: true, solved: true, tries: 1, sel: ['sysprompt'] });
    expect(capstoneProgress(prompting).solved).toBe(1);
  });

  it('calls the module demonstrated only when the quiz and every case are done', () => {
    putQuiz(attempt('mix', 9));
    for (const c of cases.slice(0, cases.length - 1)) putCase(c.id as string, { shown: true, solved: true });
    expect(demonstrated(moduleRollup(prompting)), 'one case still outstanding').toBe(false);
    putCase(cases[cases.length - 1]?.id as string, { shown: true, solved: true });
    expect(demonstrated(moduleRollup(prompting))).toBe(true);
  });

  it('does not let a good quiz hide a module whose cases are untouched', () => {
    // The failure this guards: an 8/10 quiz with 0 of 3 cases solved dropped the module out of the
    // "Still open" list entirely, which is the over-claiming the evidence tiers exist to prevent.
    putQuiz(attempt('mix', 8));
    const r = moduleRollup(prompting);
    expect(r.quizBest).toBe(8);
    expect(r.capSolved).toBe(0);
    expect(demonstrated(r), 'the capstone cases are still outstanding').toBe(false);
    expect(touched(r)).toBe(true);
  });

  it('needs a passing quiz as well as the cases', () => {
    for (const c of cases) putCase(c.id as string, { shown: true, solved: true });
    expect(demonstrated(moduleRollup(prompting)), 'no quiz score yet').toBe(false);
  });
});

describe('practice goals', () => {
  it('counts ticked goals against the goals the module actually has', () => {
    const { total } = goalsProgress(prompting);
    expect(total, 'prompting defines playground goals').toBeGreaterThan(0);
    const first = prompting.techniques[0]?.id as string;
    localStorage.setItem(`goals-${first}`, JSON.stringify([0, 1]));
    expect(goalsProgress(prompting).on).toBe(2);
  });

  it('is never enough on its own to call a module done', () => {
    // Self-reported checkboxes are progress, not proof.
    for (const t of prompting.techniques) {
      const g = prompting.play[t.id]?.goals ?? [];
      localStorage.setItem(`goals-${t.id}`, JSON.stringify(g.map((_, i) => i)));
    }
    const r = moduleRollup(prompting);
    expect(r.goalsOn).toBe(r.goalsTotal);
    expect(touched(r)).toBe(true);
    expect(demonstrated(r), 'ticking every box proves nothing').toBe(false);
  });
});

describe('what earns a place in "Still open"', () => {
  it('counts a capstone case that was opened but not solved', () => {
    putCase(cases[0]?.id as string, { sel: ['sysprompt'], tries: 1 });
    const r = moduleRollup(prompting);
    expect(r.capSolved).toBe(0);
    // This is what puts the module in the list, so the card has to be able to show it.
    expect(r.capStarted).toBe(1);
    expect(touched(r)).toBe(true);
  });

  it('is not earned by merely opening a module', () => {
    // A visit writes a rollup, but a rollup of nothing must not list the module as unfinished work.
    const r = moduleRollup(prompting);
    expect(r.quizTried).toBe(false);
    expect(r.capStarted).toBe(0);
    expect(r.goalsOn).toBe(0);
    expect(touched(r), 'opening a page is not work in progress').toBe(false);
  });
});

describe('the hub rollup', () => {
  it('orders modules by when they were last worked on', () => {
    const p = new HubProgress(hub);
    const base = moduleRollup(prompting);
    p.setRollup(2, { ...base, quizTried: true, at: 1000 });
    p.setRollup(13, { ...base, quizTried: true, at: 3000 });
    p.setRollup(5, { ...base, quizTried: true, at: 2000 });
    expect(p.rollups().map(([n]) => n), 'most recent first').toEqual([13, 5, 2]);
  });

  it('keeps several modules in flight at once', () => {
    // The scenario this exists for: half of one module, then a different one.
    const p = new HubProgress(hub);
    p.setRollup(13, { ...moduleRollup(prompting), quizTried: true, at: 1 });
    p.setRollup(2, { ...moduleRollup(prompting), capStarted: 1, at: 2 });
    const open = p.rollups().filter(([, r]) => touched(r) && !demonstrated(r));
    expect(open).toHaveLength(2);
  });

  it('survives a reload, since it rides the hub own saved state', () => {
    const p = new HubProgress(hub);
    p.setRollup(13, { ...moduleRollup(prompting), quizBest: 8, quizTried: true, at: 42 });
    const again = new HubProgress(hub);
    expect(again.state.roll['p13']?.quizBest).toBe(8);
    expect(again.rollups()).toHaveLength(1);
  });

  it('merges by recency across devices', () => {
    const p = new HubProgress(hub);
    p.setRollup(13, { ...moduleRollup(prompting), capSolved: 1, at: 100 });
    const other = { ...moduleRollup(prompting), capSolved: 3, at: 200 };
    // Same shape as the account copy arriving from HubProgress.connect().
    const merged = (HubProgress as unknown as { merge(a: unknown, b: unknown): { roll: Record<string, { capSolved: number }> } })
      .merge(p.state, { tech: {}, quiz: {}, days: [], roll: { p13: other } });
    expect(merged.roll['p13']?.capSolved, 'the device that worked on it last wins').toBe(3);
  });
});
