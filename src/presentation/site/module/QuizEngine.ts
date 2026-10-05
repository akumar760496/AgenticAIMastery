/**
 * Scenario quiz engine for one module: per-technique banks of 20, a fresh weighted random draw of 10 per attempt,
 * retry of misses, mixed review weighted to weak spots, and an attempt history persisted per module.
 */
import { $, $$, html, reducedMotion, setHtml, storage, trusted, type TrustedHtml } from '../html';
import type { ModuleData, QuizRow, Technique } from '../content';

const N = 10;
interface QuestionRecord { n: number; r: number; ok: boolean; at: number }
interface Attempt { k: string; at: number; s: number; n: number; ids: string[]; miss: string[]; retry: boolean }
interface QuizState { v: 1; att: Attempt[]; q: Record<string, QuestionRecord> }
interface BankItem { id: string; t: string; multi: boolean; ind: string; q: string; o: readonly string[]; c: readonly number[]; e: string }
export interface QuizStats { pool: number; seen: number; ok: number; att: number; best: number | null; last: Attempt | null; trend: number[]; acc: number | null }

/** Techniques that moved between modules keep their quiz history: technique id → module it came from. */
const MOVED: Record<string, number> = { procmem: 6, llm: 4, qoa: 5 };

const shuffle = <T>(a: readonly T[]): T[] => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j] as T, b[i] as T]; } return b; };
const fmtDate = (ts: number) => { const d = new Date(ts); return `${d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`; };
const spark = (tr: number[]) => (tr.length ? html`<span class="qz-spark" aria-label="Last ${tr.length} scores">${tr.map((v) => html`<i style="height:${Math.max(18, v * 100)}%" class="${v >= 0.8 ? 'hi' : v >= 0.5 ? 'md' : 'lo'}"></i>`)}</span>` : html`<span class="pl-note">–</span>`);

export class QuizEngine {
  private state: QuizState = { v: 1, att: [], q: {} };
  private readonly bank: Record<string, BankItem> = {};
  private readonly subs = new Set<() => void>();
  private readonly key: string;
  private readonly techById: Record<string, Technique>;

  constructor(private readonly data: ModuleData, private readonly hubUrl: string, private readonly openTechnique: (id: string) => void) {
    this.key = `qz-p${data.n}`;
    this.techById = Object.fromEntries(data.techniques.map((t) => [t.id, t]));
    for (const [tid, rows] of Object.entries(data.cx?.qb ?? {})) for (const r of rows as readonly QuizRow[]) this.bank[r[0]] = { id: r[0], t: tid, multi: r[1] === 'm', ind: r[2], q: r[3], o: r[4], c: r[5], e: r[6] };
    const saved = storage.json<QuizState | null>(this.key, null);
    if (saved && Array.isArray(saved.att) && saved.q) this.state = saved;
    const here = data.techniques.filter((t) => MOVED[t.id] && MOVED[t.id] !== data.n);
    new Set(here.map((t) => MOVED[t.id] as number)).forEach((p) => this.importFrom(storage.json<QuizState | null>(`qz-p${p}`, null), here.map((t) => t.id)));
  }

  get techniqueCount(): number { return this.data.techniques.length; }
  get hasBank(): boolean { return Object.keys(this.bank).length > 0; }
  subscribe(fn: () => void): () => void { this.subs.add(fn); return () => this.subs.delete(fn); }

  private importFrom(src: QuizState | null, techIds: string[]): void {
    if (!src || !Array.isArray(src.att)) return;
    const ids = new Set(techIds.flatMap((t) => (this.data.cx?.qb[t] ?? []).map((r) => r[0])));
    const part: QuizState = { v: 1, att: src.att.filter((a) => techIds.includes(a.k)), q: Object.fromEntries(Object.entries(src.q ?? {}).filter(([id]) => ids.has(id))) };
    if (part.att.length || Object.keys(part.q).length) this.state = QuizEngine.merge(this.state, part);
  }

  private static merge(a: QuizState, b: QuizState): QuizState {
    const seen = new Set<string>(); const att: Attempt[] = [];
    for (const x of [...a.att, ...b.att]) { const k = `${x.at}|${x.k}`; if (!seen.has(k)) { seen.add(k); att.push(x); } }
    att.sort((x, y) => x.at - y.at);
    const q = { ...a.q };
    for (const [id, v] of Object.entries(b.q)) { const o = q[id]; const newer = !o || (v.at || 0) > (o.at || 0); q[id] = { ...(newer ? v : o!), n: Math.max(v.n || 0, o?.n || 0), r: Math.max(v.r || 0, o?.r || 0) }; }
    return { v: 1, att: att.slice(-300), q };
  }

  private save(): void { storage.set(this.key, JSON.stringify(this.state)); this.subs.forEach((f) => { try { f(); } catch { /* view gone */ } }); }
  private ids(k: string): string[] { return k === 'mix' ? Object.keys(this.bank) : (this.data.cx?.qb[k] ?? []).map((r) => r[0]); }
  name(k: string): string { return k === 'mix' ? 'Mixed review' : this.techById[k]?.name ?? k; }

  stats(k: string): QuizStats {
    const ids = this.ids(k); const A = this.state.att.filter((a) => a.k === k); const Q = this.state.q;
    const seen = ids.filter((id) => (Q[id]?.n ?? 0) > 0); const ok = ids.filter((id) => Q[id]?.ok);
    const answers = seen.reduce((s, id) => s + (Q[id]?.n ?? 0), 0); const rights = seen.reduce((s, id) => s + (Q[id]?.r ?? 0), 0);
    return { pool: ids.length, seen: seen.length, ok: ok.length, att: A.length, best: A.length ? Math.max(...A.map((a) => a.s)) : null,
      last: A.at(-1) ?? null, trend: A.slice(-6).map((a) => a.s / a.n), acc: answers ? rights / answers : null };
  }

  draw(k: string, n = N): string[] {
    const Q = this.state.q; const A = this.state.att.filter((a) => a.k === k); const lastSet = new Set(A.at(-1)?.ids ?? []);
    const techAcc: Record<string, number> = {};
    if (k === 'mix') this.data.techniques.forEach((t) => { techAcc[t.id] = this.stats(t.id).acc ?? 0.5; });
    let pool = this.ids(k).map((id) => {
      const r = Q[id]; let w = !r || !r.n ? 3 : r.ok === false ? 4 : r.r >= 2 ? 0.6 : 1;
      if (lastSet.has(id)) w *= 0.25; if (k === 'mix') w *= 1.4 - (techAcc[this.bank[id]!.t] ?? 0.5);
      return { id, w };
    });
    const out: string[] = []; const per: Record<string, number> = {};
    while (out.length < n && pool.length) {
      const tot = pool.reduce((s, p) => s + p.w, 0); let r = Math.random() * tot; let j = 0;
      while (j < pool.length - 1 && r >= (pool[j]?.w ?? 0)) { r -= pool[j]!.w; j++; }
      const id = pool.splice(j, 1)[0]!.id; const t = this.bank[id]!.t;
      if (k === 'mix' && (per[t] ?? 0) >= 3 && pool.some((p) => (per[this.bank[p.id]!.t] ?? 0) < 3)) continue;
      per[t] = (per[t] ?? 0) + 1; out.push(id);
    }
    pool = [];
    return out;
  }

  /** One attempt, one question at a time. */
  run(root: HTMLElement, k: string, ids: string[], opts: { retry?: boolean } = {}): void {
    const Q = ids.map((id) => { const b = this.bank[id]!; const ord = shuffle(b.o.map((_, j) => j)); return { ...b, oo: ord.map((j) => b.o[j] ?? ''), cc: b.c.map((c) => ord.indexOf(c)).sort((x, y) => x - y) }; });
    let i = 0; let score = 0; const log: boolean[] = []; const tag = `qz${Math.random().toString(36).slice(2, 7)}`;
    const render = (): void => {
      if (i >= Q.length) { finish(); return; }
      const q = Q[i]!;
      setHtml(root, html`<div class="q-meta"><span>Question ${i + 1} of ${Q.length}</span><span>Score ${score}</span></div>
        <div class="q-bar"><i style="width:${(i / Q.length) * 100}%"></i></div>
        <div class="qz-tags"><span class="qz-ind">${q.ind}</span>${k === 'mix' ? html`<span class="qz-tech">${this.name(q.t)}</span>` : ''}<span class="qz-kind">${q.multi ? 'Select all that apply' : 'One answer'}</span></div>
        <p class="q-text">${trusted(q.q)}</p>
        <div class="opts" role="group" aria-label="Answer options">${q.oo.map((o, j) => html`<label class="opt"><input type="${q.multi ? 'checkbox' : 'radio'}" name="${tag}" value="${j}"><span class="k">${'ABCDE'[j]}</span><span>${trusted(o)}</span></label>`)}</div>
        <div class="qz-after"><button class="btn primary" type="button" data-go disabled>Check</button></div>`);
      const go = $<HTMLButtonElement>(root, '[data-go]')!;
      $$<HTMLInputElement>(root, `input[name="${tag}"]`).forEach((x) => x.addEventListener('change', () => { go.disabled = !root.querySelector(`input[name="${tag}"]:checked`); }));
      go.addEventListener('click', () => {
        const pick = $$<HTMLInputElement>(root, `input[name="${tag}"]:checked`).map((x) => Number(x.value)).sort((x, y) => x - y);
        const ok = pick.length === q.cc.length && pick.every((v, j) => v === q.cc[j]); if (ok) score++; log[i] = ok;
        const r = this.state.q[q.id] ?? { n: 0, r: 0, ok: false, at: 0 }; this.state.q[q.id] = { n: r.n + 1, r: r.r + (ok ? 1 : 0), ok, at: Date.now() };
        $$(root, '.opt').forEach((lab, j) => { (lab.querySelector('input') as HTMLInputElement).disabled = true; if (q.cc.includes(j)) lab.classList.add('right'); else if (pick.includes(j)) lab.classList.add('wrong'); });
        const full = q.multi && !ok ? ` Correct set: ${q.cc.map((c) => 'ABCDE'[c]).join(', ')}.` : '';
        setHtml($(root, '.qz-after')!, html`<div class="verdict ${ok ? 'ok' : 'no'}"><b>${ok ? 'Correct.' : 'Not quite.'}</b>${full} ${trusted(q.e)}</div>
          <div style="margin-top:10px"><button class="btn primary" type="button" data-next>${i + 1 < Q.length ? 'Next question' : 'See my result'}</button></div>`);
        ($(root, '.q-meta span:last-child') as HTMLElement).textContent = `Score ${score}`;
        const nx = $(root, '[data-next]')!; nx.focus(); nx.addEventListener('click', () => { i++; render(); });
      });
    };
    const finish = (): void => {
      const miss = Q.filter((_, j) => !log[j]); const before = this.stats(k);
      this.state.att.push({ k, at: Date.now(), s: score, n: Q.length, ids: Q.map((q) => q.id), miss: miss.map((q) => q.id), retry: Boolean(opts.retry) });
      if (this.state.att.length > 300) this.state.att = this.state.att.slice(-300);
      this.save();
      const last = before.last; const d = last && !opts.retry ? score / Q.length - last.s / last.n : null; const p = score / Q.length;
      const msg = p >= 0.9 ? 'Excellent: you can apply this in real situations.' : p >= 0.7 ? 'Solid. Review the misses below.' : p >= 0.5 ? 'Getting there. Re-read the technique behind each miss, then try a new set.' : 'Worth another pass through the Learn and Decide tabs first.';
      setHtml(root, html`<span class="eyebrow">${opts.retry ? 'Retry of missed questions' : 'Your result'}</span>
        <div class="qz-res"><div class="q-score">${score} / ${Q.length}</div>
          ${d != null ? html`<span class="qz-delta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '= '}${d ? Math.round(d * Q.length * 10) / 10 : ''} ${d ? 'vs last attempt' : 'same as last attempt'}</span>` : ''}</div>
        <p>${msg}</p>
        <div class="row-q">${miss.length ? html`<button class="btn primary" type="button" data-retry>Retry the ${miss.length} I missed</button>` : ''}
          <button class="btn${miss.length ? '' : ' primary'}" type="button" data-new>New random set</button>
          ${k === 'mix' && !opts.retry && Q.length === 10 ? html`<a class="btn" href="${this.hubUrl}#quiz-p${this.data.n}-${score}">Save score to Study Hub ↗</a>` : ''}</div>
        ${miss.length ? html`<h4 class="qz-h">Review what you missed</h4><div class="q-miss">${miss.map((q) => html`<div><span class="qz-ind">${q.ind}</span> <b>${trusted(q.q)}</b> Answer: ${trusted(q.c.map((c) => q.o[c]).join('; '))}. ${trusted(q.e)}${k === 'mix' ? html` <button class="btn link-btn" type="button" data-open="${q.t}">Study ${this.name(q.t)}</button>` : ''}</div>`)}</div>` : ''}`);
      $(root, '[data-retry]')?.addEventListener('click', () => this.run(root, k, shuffle(miss.map((q) => q.id)), { ...opts, retry: true }));
      $(root, '[data-new]')?.addEventListener('click', () => this.run(root, k, this.draw(k), { ...opts, retry: false }));
      $$(root, '[data-open]').forEach((b) => b.addEventListener('click', () => this.openTechnique(b.dataset['open'] ?? '')));
    };
    render();
  }

  /** Intro card used by a technique's Practice tab. */
  intro(root: HTMLElement, k: string): void {
    const s = this.stats(k);
    setHtml(root, html`<div class="qz-intro">
      <p>${k === 'mix' ? `10 questions drawn from all ${s.pool} scenario questions on this page, weighted towards techniques and questions you find hard.` : `A bank of ${s.pool} real-world scenarios from different industries. Each attempt draws a fresh random ${N}, favouring questions you haven’t seen or got wrong, with the options shuffled.`}</p>
      <dl class="qz-kv"><div><dt>Attempts</dt><dd>${s.att}</dd></div><div><dt>Best</dt><dd>${s.best != null ? `${s.best} / ${N}` : '–'}</dd></div>
        <div><dt>Last</dt><dd>${s.last ? `${s.last.s} / ${s.last.n}` : '–'}</dd></div><div><dt>Seen</dt><dd>${s.seen} / ${s.pool}</dd></div>
        <div><dt>Right last time</dt><dd>${s.ok} / ${s.pool}</dd></div><div><dt>Trend</dt><dd>${spark(s.trend)}</dd></div></dl>
      <div class="row-q"><button class="btn primary" type="button" data-start>Start: ${N} random questions</button>
        ${s.last?.miss?.length ? html`<button class="btn" type="button" data-miss>Retry last attempt’s ${s.last.miss.length} misses</button>` : ''}</div></div>`);
    $(root, '[data-start]')?.addEventListener('click', () => this.run(root, k, this.draw(k)));
    $(root, '[data-miss]')?.addEventListener('click', () => this.run(root, k, shuffle((s.last?.miss ?? []).filter((id) => this.bank[id])), { retry: true }));
  }

  /** The page-level quiz centre and tracker. */
  mountCenter(root: HTMLElement): void {
    const T = this.data.techniques;
    setHtml(root, html`<div class="qz-sum" id="qz-sum"></div>
      <div class="tbl-wrap"><table class="qz-table" id="qz-table"></table></div>
      <div class="qz-mix"><div><b>Mixed review</b><span class="pl-note">10 questions across all ${T.length} techniques, weighted to your weak spots.</span></div><button class="btn primary" type="button" data-k="mix">Start mixed review</button></div>
      <div class="quiz qz-run" id="qz-run" aria-live="polite" hidden></div>
      <div class="qz-hist-wrap"><h3>Attempt history</h3><div id="qz-hist"></div></div>`);
    const run = $(root, '#qz-run')!;
    const start = (k: string) => { run.hidden = false; this.run(run, k, this.draw(k)); run.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' }); };
    $(root, '.qz-mix [data-k]')?.addEventListener('click', () => start('mix'));
    let confirmReset = false;
    const draw = (): void => {
      const all = T.map((t) => [t, this.stats(t.id)] as const); const A = this.state.att; const recs = Object.values(this.state.q);
      const seen = recs.filter((r) => r.n > 0).length; const total = Object.keys(this.bank).length;
      const answered = recs.reduce((s, r) => s + r.n, 0); const right = recs.reduce((s, r) => s + r.r, 0);
      const tried = all.filter(([, s]) => s.acc != null).sort((a, b) => (a[1].acc ?? 0) - (b[1].acc ?? 0));
      setHtml($(root, '#qz-sum')!, html`
        <div class="qz-tile"><span>Attempts</span><b>${A.length}</b></div>
        <div class="qz-tile"><span>Questions seen</span><b>${seen}<small> / ${total}</small></b></div>
        <div class="qz-tile"><span>Accuracy</span><b>${answered ? `${Math.round((right / answered) * 100)}%` : '–'}</b></div>
        <div class="qz-tile"><span>Needs most work</span><b class="sm">${tried.length ? tried[0]![0].name : '–'}</b></div>
        <p class="pl-note qz-sync">History is saved in this browser.</p>`);
      setHtml($(root, '#qz-table')!, html`<thead><tr><th>Technique</th><th>Progress</th><th>Attempts</th><th>Best</th><th>Last</th><th>Recent</th><th><span class="sr">Start</span></th></tr></thead><tbody>${all.map(([t, s]) => html`
        <tr><th scope="row">${t.name}</th>
          <td><div class="qz-prog" aria-label="${s.ok} right last time, ${s.seen} seen, of ${s.pool}"><i class="ok" style="width:${s.pool ? (s.ok / s.pool) * 100 : 0}%"></i><i class="seen" style="width:${s.pool ? ((s.seen - s.ok) / s.pool) * 100 : 0}%"></i></div><span class="pl-note">${s.ok} right · ${s.seen} seen · ${s.pool} total</span></td>
          <td>${s.att}</td><td>${s.best != null ? `${s.best}/${N}` : '–'}</td><td>${s.last ? `${s.last.s}/${s.last.n}` : '–'}</td><td>${spark(s.trend)}</td>
          <td><button class="btn mini" type="button" data-k="${t.id}">${s.att ? 'New set' : 'Start'}</button></td></tr>`)}</tbody>`);
      $$(root, '#qz-table [data-k]').forEach((b) => b.addEventListener('click', () => start(b.dataset['k'] ?? '')));
      const H = A.slice(-10).reverse();
      setHtml($(root, '#qz-hist')!, H.length ? html`<ol class="qz-hist">${H.map((a) => html`<li><span class="qz-when">${fmtDate(a.at)}</span><span>${this.name(a.k)}${a.retry ? html` <span class="pl-note">(retry of misses)</span>` : ''}</span><b class="${a.s / a.n >= 0.8 ? 'hi' : a.s / a.n >= 0.5 ? 'md' : 'lo'}">${a.s} / ${a.n}</b></li>`)}</ol>
        <div class="row-q"><button class="btn link-btn" type="button" id="qz-reset">${confirmReset ? 'Click again to erase all quiz history' : 'Reset quiz history'}</button></div>`
        : html`<p class="pl-note">No attempts yet. Start with any technique above, or from its Practice tab.</p>`);
      $(root, '#qz-reset')?.addEventListener('click', () => { if (!confirmReset) { confirmReset = true; draw(); return; } confirmReset = false; this.state = { v: 1, att: [], q: {} }; this.save(); });
    };
    this.subscribe(draw); draw();
  }
}

export type { TrustedHtml };
