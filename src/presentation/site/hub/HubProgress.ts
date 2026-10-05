/**
 * Learner progress across the course: spaced-review boxes per technique, best quiz score per module and study days.
 * Stored in the browser and, inside a Claude artifact, synced to the learner's account.
 */
import { storage } from '../html';
import type { HubData, HubModule, HubTechnique, HubTrack } from '../content';
import type { ModuleRollup } from '../module/moduleProgress';

export interface TechProgress { box: number; due?: string; intro?: string; last?: number }
export interface QuizBest { best: number; last: number; at: string }
/**
 * `roll` is what each module page reports about itself: quiz, capstone and goals, summarised small
 * enough that the hub can show all 18 without opening a single module's content. See moduleProgress.ts.
 */
interface ProgressState { tech: Record<string, TechProgress>; quiz: Record<string, QuizBest>; days: string[]; roll: Record<string, ModuleRollup> }
interface DocRef { get(): Promise<{ exists: boolean; data(): ProgressState }>; set(v: unknown): Promise<void> }

export const INTERVALS = [0, 1, 3, 7, 14];
export const NEW_PER_DAY = 5;
const KEY = 'aam-progress-v1';

export const today = (): string => new Date().toLocaleDateString('en-CA');
export const addDays = (d: string, n: number): string => { const x = new Date(`${d}T12:00:00`); x.setDate(x.getDate() + n); return x.toLocaleDateString('en-CA'); };

export class HubProgress {
  state: ProgressState = { tech: {}, quiz: {}, days: [], roll: {} };
  mode: 'local' | 'db' = 'local';
  private ref: DocRef | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writing = false; private again = false;

  constructor(readonly data: HubData) {
    const s = storage.json<ProgressState | null>(KEY, null);
    if (s?.tech) this.state = { tech: s.tech, quiz: s.quiz ?? {}, days: s.days ?? [], roll: s.roll ?? {} };
  }

  M = (n: number): HubModule => this.data.mods.find((p) => p.n === n) as HubModule;
  TR = (id: string): HubTrack | undefined => this.data.tracks.find((t) => t.id === id);
  modTechs = (n: number): HubTechnique[] => this.data.techs.filter((t) => t.p === n);
  level(id: string): 'n' | 'l' | 'c' { const b = this.state.tech[id]?.box ?? 0; return b === 0 ? 'n' : b < 3 ? 'l' : 'c'; }

  modStatus(n: number) {
    const ts = this.modTechs(n); const c = ts.filter((t) => this.level(t.id) === 'c').length; const l = ts.filter((t) => this.level(t.id) === 'l').length; const q = this.state.quiz[`p${n}`];
    const done = Boolean(q && q.best >= 7) || c >= Math.ceil((ts.length * 2) / 3);
    return { ts, c, l, q, done, started: done || c + l > 0 || Boolean(q) };
  }
  trackDone(t: HubTrack): number { return t.mods.filter((n) => this.modStatus(n).done).length; }
  dueCount(): number { const t = today(); return this.data.techs.filter((x) => { const s = this.state.tech[x.id]; return s && s.box > 0 && (s.due ?? '') <= t; }).length; }
  streak(): number { const s = new Set(this.state.days); let d = today(); if (!s.has(d)) d = addDays(d, -1); let n = 0; while (s.has(d)) { n++; d = addDays(d, -1); } return n; }
  returning(): boolean { return Object.values(this.state.tech).some((s) => s.box > 0) || Object.keys(this.state.quiz).length > 0; }
  touch(): void { const t = today(); if (!this.state.days.includes(t)) this.state.days.push(t); }

  /** Called by a module page with what it can see of its own module. Also keeps `quiz` in step. */
  setRollup(n: number, r: ModuleRollup): void {
    const old = this.state.roll[`p${n}`];
    if (old && old.at >= r.at && JSON.stringify({ ...old, at: 0 }) === JSON.stringify({ ...r, at: 0 })) return;
    this.state.roll[`p${n}`] = r;
    // The quiz best used to arrive only when the learner pressed "Save score to Study Hub". It is in
    // the module's own storage all along, so take it here and stop losing scores to a missed click.
    if (r.quizBest !== null && r.quizBest > (this.state.quiz[`p${n}`]?.best ?? -1)) {
      const o = this.state.quiz[`p${n}`];
      this.state.quiz[`p${n}`] = { best: r.quizBest, last: o?.last ?? r.quizBest, at: o?.at ?? today() };
    }
    this.save();
  }
  /** Modules with evidence, most recently worked on first. Drives the home page's in-progress list. */
  rollups(): readonly (readonly [number, ModuleRollup])[] {
    return Object.entries(this.state.roll).map(([k, v]) => [Number(k.slice(1)), v] as const).sort((a, b) => b[1].at - a[1].at);
  }

  rate(id: string, good: boolean): void {
    const t = today(); const s = { ...(this.state.tech[id] ?? { box: 0 }) };
    if (!s.box) s.intro = t;
    s.box = good ? Math.min((s.box || 0) + 1, 4) : 1; s.due = addDays(t, INTERVALS[s.box] ?? 14); s.last = Date.now();
    this.state.tech[id] = s; this.touch(); this.save();
  }
  /** Cycles a technique new → learning → confident → new from a track page chip. */
  cycle(id: string): void {
    const lv = this.level(id); const t = today();
    if (lv === 'n') this.state.tech[id] = { box: 1, due: addDays(t, 1), intro: t, last: Date.now() };
    else if (lv === 'l') this.state.tech[id] = { ...this.state.tech[id], box: 3, due: addDays(t, 7), last: Date.now() };
    else this.state.tech[id] = { box: 0, last: Date.now() };
    this.touch(); this.save();
  }
  /** Records a quiz score passed back from a module page (#quiz-p<n>-<score>). Returns a toast message. */
  recordQuiz(n: number, score: number): string {
    const k = `p${n}`; const sc = Math.min(10, score); const o = this.state.quiz[k];
    this.state.quiz[k] = { best: Math.max(o ? o.best : 0, sc), last: sc, at: today() }; this.touch(); this.save();
    return `Saved ${this.M(n).name} quiz: ${sc} / 10${o && o.best > sc ? ` (best stays ${o.best})` : ''}`;
  }

  save(): void {
    storage.set(KEY, JSON.stringify(this.state));
    if (this.mode !== 'db' || !this.ref) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), 700);
  }
  private async flush(): Promise<void> {
    if (this.writing) { this.again = true; return; }
    this.writing = true;
    try { await this.ref?.set(JSON.parse(JSON.stringify(this.state))); } catch { this.mode = 'local'; }
    this.writing = false; if (this.again) { this.again = false; void this.flush(); }
  }
  private static merge(a: ProgressState, b: ProgressState): ProgressState {
    const out: ProgressState = { tech: { ...a.tech }, quiz: { ...a.quiz }, days: [...new Set([...(a.days ?? []), ...(b.days ?? [])])].sort().slice(-400), roll: { ...a.roll } };
    // Rollups merge by recency, like techniques: the device that worked on a module last knows most.
    for (const [k, v] of Object.entries(b.roll ?? {})) if (!out.roll[k] || v.at > (out.roll[k]?.at ?? 0)) out.roll[k] = v;
    for (const [k, v] of Object.entries(b.tech ?? {})) if (!out.tech[k] || (v.last ?? 0) > (out.tech[k]?.last ?? 0)) out.tech[k] = v;
    for (const [k, v] of Object.entries(b.quiz ?? {})) { const o = out.quiz[k]; out.quiz[k] = !o ? v : { best: Math.max(o.best, v.best), last: (v.at || '') > (o.at || '') ? v.last : o.last, at: (v.at || '') > (o.at || '') ? v.at : o.at }; }
    return out;
  }
  /** Connects to the Claude artifact database when available. Resolves true if the account copy needs seeding. */
  async connect(): Promise<boolean> {
    try {
      const c = (globalThis as { claude?: { use?: (k: string) => Promise<any> } }).claude;
      if (!c?.use) return false;
      const [db, user] = await Promise.all([c.use('db'), c.use('user')]);
      const uid = user ? await user.id() : null; if (!db || !uid) return false;
      this.ref = db.doc(`data/users/${uid}/progress`) as DocRef; const snap = await this.ref.get();
      if (snap.exists) this.state = HubProgress.merge(this.state, snap.data());
      this.mode = 'db'; storage.set(KEY, JSON.stringify(this.state));
      return !snap.exists && (Object.keys(this.state.tech).length > 0 || Object.keys(this.state.quiz).length > 0);
    } catch { this.mode = 'local'; return false; }
  }
}
