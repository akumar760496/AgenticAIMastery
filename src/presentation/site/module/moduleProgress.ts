/**
 * What a learner has actually shown they can do in one module, read from the keys the module's own
 * panes already write, plus the compact rollup the hub stores so it can report on all 18 modules
 * without loading any of them.
 *
 * Why a rollup: the evidence lives under per-module keys (`qz-p13`, `capstone-p13-<case>`,
 * `goals-<technique>`), and finding it needs the module's content — quiz ids, case ids, technique
 * ids — which is a ~350 KB lazily-loaded JSON per module. The home page cannot load eighteen of
 * those to draw a progress bar. So the module page, which has its content open anyway, writes a
 * ~120-byte summary into hub state as the learner works, and the hub reads only that.
 *
 * Evidence is tiered. `quizBest` and `capSolved` are demonstrated: the learner was marked against an
 * answer they could not see. `goals` is self-reported, and the spaced-review boxes the hub already
 * keeps are self-reported too. Only the demonstrated tier should ever be allowed to call a module
 * complete.
 */
import { storage } from '../html';
import type { ModuleData } from '../content';
import { capstoneProgress } from './capstone';

/** The compact per-module summary stored in hub state. Kept small: it syncs to the learner's account. */
export interface ModuleRollup {
  /** Best score out of 10 on the full mixed quiz, or null if never finished one. */
  readonly quizBest: number | null;
  /** A quiz attempt of any kind has been made. */
  readonly quizTried: boolean;
  /** Capstone cases whose plan was right when checked, out of how many the module has. */
  readonly capSolved: number;
  readonly capTotal: number;
  /** Cases opened or checked but not solved. */
  readonly capStarted: number;
  /** Practice goals ticked, out of how many exist. Self-reported. */
  readonly goalsOn: number;
  readonly goalsTotal: number;
  /** When this module was last worked on, which is what orders the "in progress" list on the home page. */
  readonly at: number;
}

interface QuizAttempt { k: string; s: number; n: number }
interface QuizSaved { att?: QuizAttempt[] }

/**
 * Best full-quiz score for a module, straight from the quiz's own storage.
 *
 * The hub used to learn this only when the learner clicked "Save score to Study Hub", so anyone who
 * finished a quiz and navigated away kept no record of it. Only the 10-question mixed run counts, to
 * match what `HubProgress.recordQuiz` has always stored.
 */
export function quizBest(n: number): { best: number | null; tried: boolean } {
  const saved = storage.json<QuizSaved | null>(`qz-p${n}`, null);
  const att = saved?.att ?? [];
  if (!att.length) return { best: null, tried: false };
  const full = att.filter((a) => a.k === 'mix' && a.n === 10).map((a) => a.s);
  return { best: full.length ? Math.max(...full) : null, tried: true };
}

/** Practice goals ticked across the module's techniques. Self-reported, so never counted as mastery. */
export function goalsProgress(data: ModuleData): { on: number; total: number } {
  let on = 0; let total = 0;
  for (const t of data.techniques) {
    const g = data.play[t.id]?.goals;
    if (!g?.length) continue;
    total += g.length;
    const saved = storage.json<number[] | null>(`goals-${t.id}`, null);
    if (Array.isArray(saved)) on += saved.filter((i) => i < g.length).length;
  }
  return { on, total };
}

/** Reads every evidence source for one module. Needs the module's content, so only a module page calls it. */
export function moduleRollup(data: ModuleData): ModuleRollup {
  const q = quizBest(data.n); const cap = capstoneProgress(data); const g = goalsProgress(data);
  return {
    quizBest: q.best, quizTried: q.tried,
    capSolved: cap.solved, capTotal: cap.total, capStarted: cap.started + (cap.done - cap.solved),
    goalsOn: g.on, goalsTotal: g.total, at: Date.now(),
  };
}

/**
 * True once the learner has demonstrated the module, as opposed to having worked through it.
 *
 * Every demonstrated source the module offers has to be satisfied, not just one. An earlier version
 * accepted a quiz of 7 or more on its own, and a module with a good quiz score and none of its three
 * capstone cases solved then disappeared from "Still open" — claiming completion on the strength of
 * the easier half. This is the strict tier; `HubProgress.modStatus` keeps the older, softer rule for
 * the module counts and track bars.
 */
export function demonstrated(r: ModuleRollup | undefined): boolean {
  if (!r) return false;
  return (r.quizBest ?? 0) >= 7 && (r.capTotal === 0 || r.capSolved >= r.capTotal);
}

/** Any evidence at all, which is what puts a module in the "in progress" list. */
export function touched(r: ModuleRollup | undefined): boolean {
  return Boolean(r && (r.quizTried || r.capSolved > 0 || r.capStarted > 0 || r.goalsOn > 0));
}
