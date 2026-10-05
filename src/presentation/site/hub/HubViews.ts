/** Hub pages: home, track (section) pages, today's review, practise (interview room + case library) and library. */
import { $, $$, html, setHtml, storage, trusted, type TrustedHtml } from '../html';
import type { HubTechnique } from '../content';
import { addDays, HubProgress, NEW_PER_DAY, today } from './HubProgress';
import { DailyMix, type MixItem } from './DailyMix';
import { demonstrated, touched, type ModuleRollup } from '../module/moduleProgress';
import type { SiteShell } from '../shell/SiteShell';

const numWord = (n: number) => ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'][n] ?? String(n);
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const tv = (id: string) => `var(--t-${id})`;

export class HubViews {
  private pathId: string;
  private queue: HubTechnique[] = [];
  private revealed = false;
  private forceNew = false;
  private caseSector = 'All'; private caseLimit = 12;
  private libTab: 'gloss' | 'conn' = 'gloss';
  /** Module number the Library is filtered to, from a `library~p13` link on a module page. */
  private libMod: number | null = null;
  private lastView: string | null = null;
  /** Built on first render, not in the constructor, so the pick sees progress restored from the account. */
  private mixObj: DailyMix | null = null;
  private mixOpen: string | null = null;
  private readonly mixRevealed = new Set<string>();
  /** Option index the learner chose for a case item, so the marked answer survives a re-render. */
  private readonly mixPicked = new Map<string, number>();

  constructor(private readonly p: HubProgress, private readonly shell: SiteShell) {
    const saved = storage.get('aam-path');
    this.pathId = saved && p.data.paths.some((x) => x.id === saved) ? saved : p.data.paths[0]?.id ?? '';
    const view = shell.view();
    view.addEventListener('click', (e) => this.onClick(e));
    view.addEventListener('input', (e) => { const id = (e.target as HTMLElement).id; if (id === 'csearch') { this.caseLimit = 12; this.renderCases(); } if (id === 'gsearch') this.renderLib(); });
    view.addEventListener('change', (e) => { const id = (e.target as HTMLElement).id; if (id === 'cindia' || id === 'ccap') { this.caseLimit = 12; this.renderCases(); } });
    document.getElementById('flip')?.addEventListener('click', () => { this.forceNew = !this.forceNew; if (location.hash && location.hash !== '#home') location.hash = 'home'; else this.route('home'); });
  }

  private get d() { return this.p.data; }
  private link(p: number, id: string) { return `${this.p.M(p).url}~${id}`; }
  private returning() { return !this.forceNew && this.p.returning(); }

  route(h: string): void {
    let markup: TrustedHtml;
    // A view may carry an argument, as in `library~p13` for the Library filtered to one module.
    const [base = '', arg = ''] = h.split('~');
    if (base === 'library') { const m = /^p(\d+)$/.exec(arg); this.libMod = m ? Number(m[1]) : null; if (this.libMod) this.libTab = 'gloss'; }
    if (base.startsWith('t-')) markup = this.viewTrack(base.slice(2));
    else if (base === 'review') markup = this.viewReview();
    else if (base === 'practise') markup = this.viewPractise();
    else if (base === 'library') markup = this.viewLibrary();
    else markup = this.viewHome();
    const view = this.shell.view();
    setHtml(view, markup);
    if (base === 'review') { this.buildQueue(); this.revealed = false; this.renderReviewCard(); this.renderReviewSide(); }
    if (base === 'practise') this.renderCases();
    if (base === 'library') this.renderLib();
    // After hubCrumbs, which clears the band slot the chip lives in.
    this.shell.hubCrumbs(base);
    this.renderRail(base || 'home');
    if (this.lastView !== h) { if (this.lastView !== null) this.shell.loadBar('run'); this.shell.enter(view); this.lastView = h; }
    if (base === 'tracks') document.getElementById('tracks')?.scrollIntoView(); else window.scrollTo(0, 0);
    const flip = document.getElementById('flip');
    if (flip) { flip.hidden = !this.p.returning(); flip.textContent = this.forceNew ? 'Back to your progress' : 'Preview the welcome page for new learners'; }
  }

  private nextModule(): number | null {
    const path = this.d.paths.find((x) => x.id === this.pathId);
    return path?.steps.map((s) => s[0]).find((n) => !this.p.modStatus(n).done) ?? this.d.tracks.flatMap((t) => t.mods).find((n) => !this.p.modStatus(n).done) ?? null;
  }

  private pathHTML(tabs = true): TrustedHtml {
    const path = this.d.paths.find((x) => x.id === this.pathId); if (!path) return html``;
    return html`${tabs ? html`<div class="ptabs" role="tablist" aria-label="Roles">${this.d.paths.map((x) => html`<button class="ptab" role="tab" type="button" aria-selected="${x.id === this.pathId}" data-path="${x.id}">${x.role}</button>`)}</div>` : ''}
      <p class="pgoal">${path.goal}</p>
      <ol class="steps">${path.steps.map(([n, why], i) => { const m = this.p.M(n); const st = this.p.modStatus(n);
        return html`<li class="${st.done ? 'done' : ''}" style="--c:${tv(m.track)}"><span class="sn">${st.done ? '✓' : i + 1}</span><a href="${m.url}"><b>${m.name}</b><small>${why}</small></a><span class="pr">${st.c} / ${st.ts.length} confident</span></li>`; })}</ol>`;
  }

  private trackCards(): TrustedHtml {
    return html`<div class="tgrid">${this.d.tracks.map((t) => { const done = this.p.trackDone(t);
      return html`<a class="tcard" href="#t-${t.id}" style="--c:${tv(t.id)}"><span class="tn">${t.name}</span><p>${t.blurb}</p>
        <div class="mini"><i style="width:${(done / t.mods.length) * 100}%"></i></div><span class="tm"><span>${t.mods.length} module${t.mods.length > 1 ? 's' : ''}</span><span>${done} done</span></span></a>`; })}</div>`;
  }

  private viewHome(): TrustedHtml {
    this.shell.setArea('learn', 'found');
    const total = this.d.mods.length;
    if (this.returning()) {
      const n = this.nextModule(); const m = n ? this.p.M(n) : null;
      const weak = this.d.mods.map((x) => ({ x, q: this.p.state.quiz[`p${x.n}`] })).filter((o) => o.q && o.q.best < 7).sort((a, b) => (a.q?.best ?? 0) - (b.q?.best ?? 0)).slice(0, 3);
      return html`<section class="hero"><span class="eb">Welcome back</span><h1>Design AI agents that hold up in production</h1>
          <div class="btns">${m ? html`<a class="btn primary" href="${m.url}">Continue: ${m.name}</a>` : ''}<a class="btn" href="#review">Today</a><a class="btn" href="#practise">Practise interviews</a></div></section>
        ${this.inProgressHTML()}
        ${m ? '' : html`<section class="card"><p>You have completed every module. Keep your reviews going and try the Interview Room.</p></section>`}
        <section class="sec"><div class="sec-head"><h2>Your tracks</h2><p>Six tracks, in learning order. Open one to see its modules.</p></div>${this.trackCards()}</section>
        ${weak.length ? html`<section class="sec"><div class="sec-head"><h2>Worth another look</h2><p>Modules where your best quiz score is under 7 out of 10.</p></div><div class="qlist card">${weak.map((o) => html`<div class="qrow" style="--c:${tv(o.x.track)}"><span class="tn">${o.x.name}</span><a class="btn sm" href="${o.x.url}~quiz">Retake quiz</a><em>${o.q?.best}/10</em></div>`)}</div></section>` : ''}
        <section class="sec"><div class="sec-head"><h2>Your learning path</h2><p>A step gets a tick when you are confident in at least four of its techniques or score 7 or more in its quiz.</p></div><div id="paths">${this.pathHTML()}</div></section>`;
    }
    const t = this.d.teasers[Math.floor(Date.now() / 86400000) % this.d.teasers.length]!;
    const first = this.p.M(this.d.tracks[0]!.mods[0]!);
    return html`<section class="hero"><span class="eb">A free, hands-on course</span><h1>Design AI agents that hold up in production</h1>
        <p>${numWord(total)} modules take you from your first structured prompt to agents that handle real money, real customers and real regulators. Every idea comes with a playground, a quiz and a real-world case, many from Indian banking and fintech.</p>
        <div class="facts"><span><b>${total}</b> modules</span><span><b>${this.d.techs.length}</b> techniques</span><span><b>${this.d.cases.length}</b> real-world cases</span><span><b>18</b> interview scenarios</span></div>
        <div class="btns"><a class="btn primary" href="${first.url}">Start with ${first.name}</a><a class="btn" href="#tracks">See the course map</a></div></section>
      <section class="card teaser" id="teaser"><span class="crumb">Try one question</span><p class="q">${t.q}</p>
        <div class="opts">${t.o.map((o, i) => html`<button class="opt" type="button" data-i="${i}">${o}</button>`)}</div><p class="explain" id="texpl" hidden></p></section>
      <section class="sec"><div class="sec-head"><h2>Pick your goal</h2><p>Each role gets a short route through the modules.</p></div>
        <div class="roles">${this.d.paths.map((x) => html`<button class="role" type="button" data-role="${x.id}" aria-pressed="${x.id === this.pathId}"><b>${x.role}</b><span>${x.goal}</span><small>${x.steps.length} modules</small></button>`)}</div>
        <div id="paths">${this.pathHTML(false)}</div></section>
      <section class="sec" id="tracks"><div class="sec-head"><h2>The course map</h2><p>Six tracks, in learning order.</p></div>${this.trackCards()}</section>
      <section class="sec"><div class="sec-head"><h2>What you get</h2></div><div class="feat">
        <a href="#tracks"><em>Learn</em><b>Modules with playgrounds</b><span>Each technique has a diagram, a live playground, code and a quiz.</span></a>
        <a href="#review"><em>Review</em><b>Spaced review</b><span>Five techniques a day come back after 1, 3, 7 and 14 days until they stick.</span></a>
        <a href="#practise"><em>Practise</em><b>Interview Room</b><span>Drills, written mock interviews and spoken mocks, scored on seven areas.</span></a>
        <a href="#library"><em>Library</em><b>Cases and glossary</b><span>${this.d.cases.length} real-world cases and every term in one searchable place.</span></a></div></section>`;
  }

  private viewTrack(id: string): TrustedHtml {
    const t = this.p.TR(id); if (!t) return this.viewHome();
    this.shell.setArea('learn', id);
    const done = this.p.trackDone(t); const nx = t.mods.find((n) => !this.p.modStatus(n).done);
    const nt = this.d.tracks[this.d.tracks.indexOf(t) + 1];
    return html`<section class="hero"><span class="eb">Track ${this.d.tracks.indexOf(t) + 1} of ${this.d.tracks.length} · ${t.mods.length} module${t.mods.length > 1 ? 's' : ''}</span><h2>${t.name}</h2><p>${t.blurb}</p>
        <div class="mini" style="--c:var(--t);max-width:420px"><i style="width:${(done / t.mods.length) * 100}%"></i></div><span class="status-line">${done} of ${t.mods.length} done</span>
        ${nx ? html`<div class="btns"><a class="btn primary" href="${this.p.M(nx).url}">Continue: ${this.p.M(nx).name}</a></div>` : ''}</section>
      <div class="legend"><span><i style="background:var(--rule-strong)"></i>New</span><span><i style="background:color-mix(in srgb,var(--t) 50%,var(--rule-strong))"></i>Learning</span><span><i style="background:var(--t)"></i>Confident</span><span>Tap a technique to change its status.</span></div>
      <div class="mods">${t.mods.map((n, i) => { const m = this.p.M(n); const s = this.p.modStatus(n);
        return html`<article class="mod ${s.done ? 'done' : n === nx ? 'next' : ''}"><span class="num">${s.done ? '✓' : i + 1}</span>
          <div class="mh"><h3>${m.name}</h3><span class="tag ${n === nx ? 'nx' : ''}">${s.done ? 'Done' : n === nx ? 'Up next' : s.started ? 'In progress' : ''}</span></div>
          <div class="body"><p>${m.lede}</p>${m.pre.length ? html`<p class="pre">Read first: ${m.pre.map((pp, j) => html`${j ? ', ' : ''}<a href="${this.p.M(pp).url}">${this.p.M(pp).name}</a>`)}</p>` : ''}
            <div class="pbar" aria-label="${s.c} confident, ${s.l} learning of ${s.ts.length}"><i class="c" style="width:${(s.c / s.ts.length) * 100}%"></i><i class="l" style="width:${(s.l / s.ts.length) * 100}%"></i></div>
            <div class="pmeta"><span>${s.c} confident · ${s.l} learning · ${s.ts.length - s.c - s.l} new</span><span>${s.q ? `Quiz best ${s.q.best}/10` : 'Quiz not taken'}${m.ver ? ` · facts checked ${new Date(`${m.ver}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</span></div>
            <div class="m-confirm" id="mc-${n}" hidden></div><div class="tchips">${s.ts.map((x) => { const lv = this.p.level(x.id); return html`<button class="tchip ${lv}" type="button" data-id="${x.id}" aria-label="${x.name}: ${lv === 'c' ? 'confident' : lv === 'l' ? 'learning' : 'new'}. Tap to change."><i></i>${x.short}</button>`; })}</div>
            <div class="btns"><button class="btn ${n === nx ? 'primary' : ''} sm" type="button" data-open="${n}" aria-expanded="false">Open module</button><a class="btn sm" href="${m.url}~quiz">Take the quiz</a></div></div></article>`; })}</div>
      ${nt ? html`<div class="btns"><a class="btn" href="#t-${nt.id}" style="--t:${tv(nt.id)}">Next track: ${nt.name}</a></div>` : ''}`;
  }

  private viewReview(): TrustedHtml {
    this.shell.setArea('review', 'found');
    const mix = this.mixHTML();
    // The mix lives here, not on the home page: a case paragraph and its four options need the full
    // width, and this page was already the one-a-day surface sitting in the top nav at every size.
    return html`<section class="sec"><div class="sec-head"><h2>Today</h2><p>${mix.value ? 'Five mixed items: what is due, something new, how two techniques relate, and a real case.' : 'Recall the idea before you reveal it, then rate yourself honestly.'}</p></div>
      <div class="stats" id="rstats"></div>
      ${mix}</section>
      <section class="sec"><div class="sec-head"><h2>${mix.value ? 'Everything else due' : "Today's review"}</h2><p>${mix.value ? 'The rest of your schedule, beyond the five above.' : 'Recall the idea before you reveal it, then rate yourself honestly.'}</p></div>
      <div class="deck"><div class="rcard" id="rcard" aria-live="polite"></div>
        <div class="side"><div class="card"><h3>How it works</h3><p><b>Got it</b> moves a technique to the next interval. <b>Still learning</b> brings it back tomorrow.</p>
          <div class="sched"><span>1 day</span><span>→ 3 days</span><span>→ 7 days</span><span>→ 14 days</span></div><p>Up to ${NEW_PER_DAY} new techniques join each day, in course order.</p></div>
        <div class="card"><h3>Quiz scores</h3><div class="qlist" id="qlist"></div><p class="status-line">Finish a module's quiz and press Save score to Study Hub. Your best score is kept.</p></div></div></div></section>`;
  }

  private buildQueue(): void {
    const t = today(); const tech = this.p.state.tech;
    // Techniques the mix is already showing above; asking for them twice on one page is just noise.
    const mx = this.mixer();
    const taken = new Set(mx.on ? mx.items().flatMap((i) => (i.kind === 'review' || i.kind === 'new' ? [i.tech.id] : [])) : []);
    const due = this.d.techs.filter((x) => { const s = tech[x.id]; return s && s.box > 0 && (s.due ?? '') <= t && !taken.has(x.id); }).sort((a, b) => (tech[a.id]?.due ?? '').localeCompare(tech[b.id]?.due ?? ''));
    const introduced = Object.values(tech).filter((s) => s.intro === t).length;
    const fresh = this.d.tracks.flatMap((tr) => tr.mods).flatMap((n) => this.p.modTechs(n)).filter((x) => !tech[x.id]?.box && !taken.has(x.id)).slice(0, Math.max(0, NEW_PER_DAY - introduced));
    this.queue = [...due, ...fresh];
  }

  private renderReviewSide(): void {
    const ids = this.d.techs.map((t) => t.id); const c = ids.filter((i) => this.p.level(i) === 'c').length; const l = ids.filter((i) => this.p.level(i) === 'l').length;
    const qs = Object.values(this.p.state.quiz); const avg = qs.length ? Math.round((qs.reduce((a, q) => a + q.best, 0) / qs.length) * 10) : null;
    const rs = document.getElementById('rstats');
    if (rs) setHtml(rs, html`${([[html`${c}<span style="font-size:15px;color:var(--muted)"> / ${ids.length}</span>`, 'Confident'], [l, 'Learning'], [this.p.dueCount(), 'Due today'], [avg === null ? '–' : `${avg}%`, `Average best quiz · ${qs.length} of ${this.d.mods.length}`]] as const).map((s) => html`<div class="stat"><b>${s[0]}</b><span>${s[1]}</span></div>`)}`);
    const ql = document.getElementById('qlist');
    if (ql) setHtml(ql, html`${this.d.tracks.flatMap((t) => t.mods).map((n) => { const m = this.p.M(n); const q = this.p.state.quiz[`p${n}`];
      return html`<div class="qrow" style="--c:${tv(m.track)}"><span class="tn">${m.name}</span><a class="btn sm" href="${m.url}~quiz">${q ? 'Retake' : 'Take'} quiz</a><em>${q ? `${q.best}/10` : '–'}</em></div>`; })}`);
  }

  /**
   * Modules with work in them that is not finished, most recently touched first.
   *
   * The home page used to assume one position in the course: the hero's "Continue" is the first
   * unfinished module in course order, which is wrong the moment someone does half of Prompting and
   * then starts Guardrails. Both belong here, and the learner chooses.
   */
  private inProgressHTML(): TrustedHtml {
    // The hero's Continue button already points at this module by name, so listing it here as unfinished
    // work repeats the most prominent thing on the page.
    const upNext = this.nextModule();
    const rows = this.p.rollups().filter(([n, r]) => touched(r) && !demonstrated(r) && n !== upNext && this.p.M(n)).slice(0, 3);
    if (!rows.length) return html``;
    return html`<section class="sec"><div class="sec-head"><h2>Still open</h2><p>What you have started and not finished. Nothing is lost by moving between modules.</p></div>
      <div class="ipg" id="ipg">${rows.map(([n, r]) => this.inProgressCard(n, r))}</div></section>`;
  }

  private inProgressCard(n: number, r: ModuleRollup): TrustedHtml {
    const m = this.p.M(n); const tr = this.p.TR(m.track);
    // The module page stores the technique it was last showing, which is small enough for the hub to
    // read directly — unlike the evidence itself, which needs the module's content.
    const last = storage.get(`aam-tab-p${n}`);
    const bar = (label: string, on: number, total: number, note: string) => html`<div class="ipb"><span>${label}</span>
      <div class="mini"><i style="width:${total ? (on / total) * 100 : 0}%"></i></div><em>${note}</em></div>`;
    return html`<article class="ipr" style="--c:${tv(m.track)}">
      <div class="iph"><b>${m.name}</b><span class="status-line">${tr?.name}</span></div>
      ${bar('Quiz', r.quizBest ?? 0, 10, r.quizBest === null ? (r.quizTried ? 'started' : 'not taken') : `${r.quizBest} / 10`)}
      ${r.capTotal ? bar('Cases', r.capSolved, r.capTotal, `${r.capSolved} / ${r.capTotal} solved${r.capStarted ? `, ${r.capStarted} open` : ''}`) : ''}
      ${r.goalsTotal ? bar('Goals', r.goalsOn, r.goalsTotal, `${r.goalsOn} / ${r.goalsTotal}`) : ''}
      <a class="btn sm" href="${last ? `${m.url}~${last}` : m.url}">Pick up where you left off</a></article>`;
  }

  /**
   * The home page's status column. Summary only: the five items themselves are done on the Today page,
   * where a case paragraph and its four options have the width they need. At or below 900px there is
   * no column, and `renderRail` puts the same summary in the crumb bar instead.
   */
  private railHTML(): TrustedHtml {
    const mx = this.mixer(); const items = mx.items();
    const done = mx.doneCount; const total = items.length;
    const mods = this.d.mods.length; const finished = this.d.mods.filter((x) => this.p.modStatus(x.n).done).length;
    const due = this.p.dueCount(); const sk = this.p.streak();
    return html`<div class="hr-h"><b>Today</b><span class="status-line">${total ? `${done} / ${total}` : ''}</span></div>
      ${total ? html`<div class="hr-top"><div class="hr-ring" style="--v:${Math.round((done / total) * 100)}"><span>${done}/${total}</span></div>
          <div style="display:grid;gap:8px;min-width:0"><div class="hr-dots">${items.map((it) => html`<i class="${mx.isDone(it.key) ? 'ok' : mx.isMissed(it.key) ? 'miss' : ''}"></i>`)}</div>
            <a class="btn primary sm" href="#review">${done ? 'Finish today' : "Do today's five"} →</a></div></div>
        <p class="hr-sub">${mx.moduleNames()}</p>` : ''}
      <ul class="hr-facts"><li><span>Modules done</span><b>${finished} / ${mods}</b></li>
        <li><span>Reviews due</span><b>${due}</b></li><li><span>Streak</span><b>${sk} day${sk === 1 ? '' : 's'}</b></li></ul>`;
  }

  /**
   * Fills the rail, and tells the layout whether this view has one. Home only.
   *
   * Below 901px there is no column, so the same summary goes into the crumb bar's band slot as a
   * single line. That slot is already sticky and already in the shell, so it costs no vertical space
   * — which matters, because burying this behind a drawer is how it became hard to find in the first
   * place. `data-view` lets the stylesheet show the band on home and keep the breadcrumb elsewhere.
   */
  private renderRail(view: string): void {
    const rail = document.getElementById('hubRail'); const root = document.getElementById('hubroot');
    const on = view === 'home' && this.mixer().on && this.returning();
    document.documentElement.dataset['view'] = on ? 'home-rail' : view;
    root?.classList.toggle('has-rail', on);
    if (rail) { rail.hidden = !on; if (on) setHtml(rail, this.railHTML()); }
    const band = document.getElementById('gnBand');
    if (!band) return;
    if (!on) { setHtml(band, html``); return; }
    const mx = this.mixer(); const items = mx.items(); const open = this.p.rollups().filter(([n, r]) => touched(r) && !demonstrated(r) && this.p.M(n)).length;
    setHtml(band, html`<a class="hr-chip" href="#review"><span class="hr-dots">${items.map((it) => html`<i class="${mx.isDone(it.key) ? 'ok' : mx.isMissed(it.key) ? 'miss' : ''}"></i>`)}</span>
      <b>Today ${mx.doneCount} of ${items.length}</b>${open ? html`<em>${open} open</em>` : ''}<span aria-hidden="true">→</span></a>`);
  }

  private mixer(): DailyMix { return (this.mixObj ??= new DailyMix(this.p)); }

  /**
   * Where "Continue" goes: the technique touched most recently, so the learner lands back on the exact
   * pane they left rather than at the top of a module. With nothing touched yet it is the next
   * unfinished module, which on a first visit is the start of the course.
   */
  private resume(): { url: string; label: string } | null {
    const last = Object.entries(this.p.state.tech).filter(([, v]) => v.last).sort((a, b) => (b[1].last ?? 0) - (a[1].last ?? 0))[0];
    const x = last ? this.d.techs.find((t) => t.id === last[0]) : undefined;
    // "Resume", not "Continue": the hero's Continue button means the next unfinished module, and this
    // one means the pane you were last on. Two buttons a few inches apart must not say the same word.
    if (x) return { url: this.link(x.p, x.id), label: `Resume: ${this.p.M(x.p).name}` };
    const n = this.nextModule(); const m = n ? this.p.M(n) : null;
    return m ? { url: m.url, label: `${this.p.returning() ? 'Continue' : 'Start'}: ${m.name}` } : null;
  }

  /** The whole card, or nothing at all when the content names no modules for it. */
  private mixHTML(): TrustedHtml {
    const mx = this.mixer();
    if (!mx.on || !mx.items().length) return html``;
    return html`<section class="card mixc" id="mix" aria-label="Your daily mix">${this.mixInner()}</section>`;
  }

  /** Re-renders the card alone, so answering an item keeps the page and the scroll position. */
  private renderMix(): void { const el = document.getElementById('mix'); if (el) setHtml(el, this.mixInner()); }

  private mixInner(): TrustedHtml {
    const mx = this.mixer(); const items = mx.items(); const done = mx.doneCount; const tm = mx.tomorrow();
    const again = mx.missCount; const left = items.length - mx.seenCount; const go = this.resume();
    return html`<div class="mix-head"><div><span class="eb">Today · ${fmt(today())}</span><p class="mix-title">Your daily mix</p></div><span class="status-line">${done} / ${items.length} done</span></div>
      <div class="mix-bar"><i style="width:${items.length ? (done / items.length) * 100 : 0}%"></i></div>
      <ol class="mix-list">${items.map((it, n) => this.mixRow(it, n))}</ol>
      <div class="mix-end"><p class="mix-foot">${left ? `${left} to go, from ${mx.moduleNames()}.` : 'All five answered.'}${again ? ` ${again} to come back to${left ? '' : ', scheduled for tomorrow'}.` : ''}${tm ? ` ${tm} review${tm === 1 ? '' : 's'} due tomorrow.` : ''}</p>
        ${go ? html`<a class="btn primary sm" href="${go.url}">${go.label}</a>` : ''}</div>`;
  }

  private mixRow(it: MixItem, n: number): TrustedHtml {
    const mx = this.mixer(); const done = mx.isDone(it.key); const miss = mx.isMissed(it.key); const open = this.mixOpen === it.key;
    const kind = it.kind === 'review' ? 'Review' : it.kind === 'new' ? 'New' : it.kind === 'connect' ? 'Connect' : 'Case';
    const m = it.kind === 'connect' ? null : this.p.M(it.kind === 'case' ? it.c.p : it.tech.p);
    // A case title must not name its own technique, or the row gives the answer away before it opens.
    const title = it.kind === 'connect' ? `${it.conn.an} ↔ ${it.conn.bn}` : it.kind === 'case' ? `${it.c.sec} · which technique?` : it.tech.name;
    const mark = done ? '✓' : miss ? '↻' : String(n + 1);
    const state = done ? 'answered correctly' : miss ? 'attempted, coming back tomorrow' : 'not started';
    return html`<li class="mixrow${done ? ' done' : ''}${miss ? ' miss' : ''}${open ? ' open' : ''}" style="--c:${m ? tv(m.track) : 'var(--t)'}">
      <button class="mx-top" type="button" data-mix="${it.key}" aria-expanded="${open}"><span class="mx-n" aria-label="${state}">${mark}</span><span class="mx-k">${kind}</span><span class="mx-t">${title}</span><span class="mx-go">${open ? '▾' : '▸'}</span></button>
      ${open ? html`<div class="mx-body">${this.mixBody(it)}</div>` : ''}</li>`;
  }

  private mixBody(it: MixItem): TrustedHtml {
    const shown = this.mixRevealed.has(it.key);
    if (it.kind === 'review' || it.kind === 'new') {
      const x = it.tech; const m = this.p.M(x.p);
      return shown ? html`<p class="qq">“${x.q}”</p><p class="wt">${x.what}</p><div class="rm"><span class="eb">Remember</span><p>${x.remember}</p></div>
          <div class="btns"><button class="btn again" type="button" data-mixrate="again" data-k="${it.key}">Still learning</button><button class="btn good" type="button" data-mixrate="good" data-k="${it.key}">Got it</button><a class="btn" href="${this.link(x.p, x.id)}">Open in ${m.name}</a></div>`
        : html`<p class="wt">What question does this technique answer, and what is its key idea? Say it out loud, then reveal.</p>
          <div class="btns"><button class="btn primary" type="button" data-mixreveal="${it.key}">Reveal</button></div>`;
    }
    if (it.kind === 'connect') {
      const c = it.conn; const a = this.p.M(c.a); const b = this.p.M(c.b);
      return html`<div class="mx-pair"><span class="mx-chip" style="--c:${tv(a.track)}">${c.an}<small>${a.name}</small></span><span class="mx-vs">↔</span><span class="mx-chip" style="--c:${tv(b.track)}">${c.bn}<small>${b.name}</small></span></div>
        ${shown ? html`<p class="wt">${c.note}</p>
            <div class="btns"><a class="btn sm" href="${this.link(c.a, c.ai)}">${c.an} →</a><a class="btn sm" href="${this.link(c.b, c.bi)}">${c.bn} →</a><button class="btn good" type="button" data-mixrate="seen" data-k="${it.key}">Got it</button></div>`
          : html`<p class="wt">How do these two relate? Answer out loud, then reveal.</p>
            <div class="btns"><button class="btn primary" type="button" data-mixreveal="${it.key}">Reveal</button></div>`}`;
    }
    // Narrowing only: the two blocks above have returned for every other kind.
    if (it.kind !== 'case') return html``;
    const picked = this.mixPicked.get(it.key);
    return html`<p class="mx-case">${it.c.text}</p><p class="wt"><b>Which technique is this?</b></p>
      <div class="opts">${it.options.map((o, i) => html`<button class="mopt${picked === undefined ? '' : i === it.correct ? ' right' : i === picked ? ' wrong' : ''}" type="button" data-mopt="${i}" data-k="${it.key}"${picked === undefined ? '' : trusted(' disabled')}>${o}</button>`)}</div>
      ${picked === undefined ? '' : html`<p class="explain"><b>${picked === it.correct ? 'Right.' : 'Not quite.'}</b> ${it.c.tn}. <a href="${this.link(it.c.p, it.c.id)}">Read it in ${this.p.M(it.c.p).name}</a></p>`}`;
  }

  private renderReviewCard(): void {
    const el = document.getElementById('rcard'); if (!el) return;
    if (!this.queue.length) {
      const next = Object.values(this.p.state.tech).filter((s) => s.box > 0).map((s) => s.due ?? '').sort()[0];
      setHtml(el, html`<span class="eb">All caught up</span><div class="nm">Nothing due today</div><p class="wt">${next ? `Your next review is on ${fmt(next)}.` : 'Open a module or tap a technique in a track to start.'}</p>
        <div class="btns"><button class="btn" type="button" id="ahead">Review 5 upcoming now</button></div>`);
      $(el, '#ahead')?.addEventListener('click', () => {
        const tech = this.p.state.tech;
        this.queue = this.d.techs.filter((x) => (tech[x.id]?.box ?? 0) > 0).sort((x, y) => (tech[x.id]?.due ?? '').localeCompare(tech[y.id]?.due ?? '')).slice(0, 5);
        if (!this.queue.length) this.queue = this.d.techs.slice(0, 5);
        this.renderReviewCard();
      });
      return;
    }
    const x = this.queue[0]!; const s = this.p.state.tech[x.id]; const m = this.p.M(x.p);
    el.style.setProperty('--t', tv(m.track));
    setHtml(el, html`<div class="btns" style="justify-content:space-between;margin:0"><span class="eb">${this.p.TR(m.track)?.name} · ${m.name}</span><span class="status-line">${this.queue.length} left · ${s?.box ? 'review' : 'new'}</span></div>
      <div class="nm">${x.name}</div>
      ${this.revealed ? html`<p class="qq">“${x.q}”</p><p class="wt">${x.what}</p><div class="rm"><span class="eb">Remember</span><p>${x.remember}</p></div>
        <div class="btns"><button class="btn again" type="button" id="r-again">Still learning</button><button class="btn good" type="button" id="r-good">Got it</button><a class="btn" href="${this.link(x.p, x.id)}">Open in module</a></div>`
      : html`<p class="wt">What question does this technique answer, and what is its key idea? Say it out loud, then reveal.</p><div class="btns"><button class="btn primary" type="button" id="reveal">Reveal</button></div>`}`);
    const rate = (good: boolean) => { this.p.rate(x.id, good); this.queue.shift(); this.revealed = false; this.renderReviewCard(); this.renderReviewSide(); };
    if (this.revealed) { $(el, '#r-again')?.addEventListener('click', () => rate(false)); const g = $(el, '#r-good'); g?.addEventListener('click', () => rate(true)); g?.focus(); }
    else $(el, '#reveal')?.addEventListener('click', () => { this.revealed = true; this.renderReviewCard(); });
  }

  private viewPractise(): TrustedHtml {
    this.shell.setArea('practise', 'qual');
    return html`<section class="ivcard"><div style="display:grid;gap:8px"><span class="crumb">Interview practice</span><h2>Interview Room</h2>
        <p>Eighteen system-design scenarios across banking, broking, lending, insurance and other sectors.</p>
        <ul><li><b>Drills</b>, about 8 minutes: rank three candidate answers and mark what each one misses. No Claude usage.</li><li><b>Mock interviews</b>: answer an interviewer in writing, stage by stage, and get a scorecard.</li><li><b>Spoken mocks</b>: the agentic-interview skill runs a full mock in any Claude chat.</li></ul></div>
        <a class="btn primary" href="${this.d.iv}">Open the Interview Room</a></section>
      <section class="sec"><div class="sec-head"><h2>Case library</h2><p>Every real-world scenario and capstone from the modules. Filter by industry, or show only the Indian examples.</p></div>
        <div class="fchips" id="csec" aria-label="Filter by industry"></div>
        <div class="frow"><label class="visually-hidden" for="csearch">Search the case library</label><input class="gsearch" id="csearch" type="search" placeholder="Search cases, e.g. UPI, KYC, claims">
          <label><input type="checkbox" id="cindia"> Indian examples only</label><label><input type="checkbox" id="ccap"> Capstones only</label><span class="ccount" id="ccount"></span></div>
        <div class="cgrid" id="cgrid"></div><button class="btn more" type="button" id="cmore" hidden>Show more</button></section>`;
  }

  private renderCases(): void {
    const grid = document.getElementById('cgrid'); if (!grid) return;
    const secs = ['All', ...this.d.sectors.filter((s) => this.d.cases.some((c) => c.sec === s))];
    setHtml(document.getElementById('csec')!, html`${secs.map((s) => { const n = s === 'All' ? this.d.cases.length : this.d.cases.filter((c) => c.sec === s).length; return html`<button class="fchip" type="button" aria-pressed="${s === this.caseSector}" data-s="${s}">${s} · ${n}</button>`; })}`);
    const q = (document.getElementById('csearch') as HTMLInputElement).value.trim().toLowerCase();
    const ind = (document.getElementById('cindia') as HTMLInputElement).checked; const cap = (document.getElementById('ccap') as HTMLInputElement).checked;
    const rows = this.d.cases.filter((c) => (this.caseSector === 'All' || c.sec === this.caseSector) && (!ind || c.india) && (!cap || c.kind === 'Capstone') && (!q || `${c.text} ${c.tn} ${c.sec}`.toLowerCase().includes(q)));
    (document.getElementById('ccount') as HTMLElement).textContent = `${rows.length} case${rows.length === 1 ? '' : 's'}`;
    setHtml(grid, rows.length ? html`${rows.slice(0, this.caseLimit).map((c) => { const m = this.p.M(c.p); return html`<article class="case" style="--c:${tv(m.track)}"><div class="ct"><span>${c.sec}</span><span>·</span><span>${c.kind}</span>${c.india ? html`<span>·</span><span class="in">India</span>` : ''}</div>
      <h3>${c.tn}</h3><p>${c.text}</p><a href="${m.url}~${c.id}">${m.name}</a></article>`; })}` : html`<p class="status-line">No cases match these filters.</p>`);
    const more = document.getElementById('cmore') as HTMLButtonElement; more.hidden = rows.length <= this.caseLimit; more.textContent = `Show ${Math.min(12, rows.length - this.caseLimit)} more`;
  }

  private viewLibrary(): TrustedHtml {
    this.shell.setArea('library', 'retr');
    const mod = this.libMod ? this.p.M(this.libMod) : null;
    const terms = mod ? this.d.gloss.filter((g) => g[2] === this.libMod).length : this.d.gloss.length;
    return html`<section class="sec lib"><div class="sec-head"><h2>Library</h2><p>Every term from every module, and how the topics connect.</p></div>
      ${mod ? html`<p class="lib-filter"><span class="eyebrow">Filtered to</span><b>${mod.name}</b><a href="#library">Show every module \u2715</a></p>` : ''}
      <div class="ptabs" role="tablist" aria-label="Library sections"><button class="ptab" role="tab" type="button" data-lib="gloss" aria-selected="${this.libTab === 'gloss'}">Glossary · ${terms}</button><button class="ptab" role="tab" type="button" data-lib="conn" aria-selected="${this.libTab === 'conn'}">How topics connect · ${this.d.conn.length}</button></div>
      <label class="visually-hidden" for="gsearch">Search</label><input class="gsearch" id="gsearch" type="search" placeholder="${this.libTab === 'gloss' ? 'Search terms, e.g. KV cache' : 'Search connections, e.g. caching'}">
      <div id="libout"></div></section>`;
  }

  private renderLib(): void {
    const out = document.getElementById('libout'); if (!out) return;
    const q = (document.getElementById('gsearch') as HTMLInputElement).value.trim().toLowerCase();
    if (this.libTab === 'gloss') {
      const rows = this.d.gloss.filter((g) => (this.libMod === null || g[2] === this.libMod) && (!q || g[0].toLowerCase().includes(q) || g[1].toLowerCase().includes(q)));
      setHtml(out, html`<dl class="glist">${rows.length ? rows.map((g) => { const m = this.p.M(g[2]); return html`<div style="--c:${tv(m.track)}"><dt>${g[0]}<span>${m.name}</span></dt><dd>${g[1]}</dd></div>`; }) : html`<div><dd>No matching terms.</dd></div>`}</dl>`);
    } else {
      const rows = this.d.conn.filter((c) => (this.libMod === null || c.a === this.libMod || c.b === this.libMod) && (!q || `${c.an} ${c.bn} ${c.note}`.toLowerCase().includes(q)));
      setHtml(out, html`<div class="clist">${rows.length ? rows.map((c) => { const a = this.p.M(c.a); const b = this.p.M(c.b); return html`<div class="crow"><a href="${this.link(c.a, c.ai)}" style="--c:${tv(a.track)}"><span class="pn" style="color:var(--c)">${a.name}</span><b>${c.an}</b></a><span class="x">↔</span>
        <a href="${this.link(c.b, c.bi)}" style="--c:${tv(b.track)}"><span class="pn" style="color:var(--c)">${b.name}</span><b>${c.bn}</b></a><p>${c.note}</p></div>`; }) : html`<p class="status-line">No matching connections.</p>`}</div>`);
    }
  }

  private onClick(e: Event): void {
    const target = e.target as HTMLElement;
    if (this.onMixClick(target)) return;
    const pt = target.closest<HTMLElement>('[data-path],[data-role]');
    if (pt) {
      this.pathId = pt.dataset['path'] ?? pt.dataset['role'] ?? this.pathId; storage.set('aam-path', this.pathId);
      $$(document, '.role').forEach((r) => r.setAttribute('aria-pressed', String(r.dataset['role'] === this.pathId)));
      const paths = document.getElementById('paths'); if (paths) setHtml(paths, this.pathHTML(!pt.dataset['role']));
      if (pt.dataset['path']) document.querySelector<HTMLElement>(`[data-path="${this.pathId}"]`)?.focus();
      return;
    }
    const tc = target.closest<HTMLElement>('.tchip');
    if (tc) { const id = tc.dataset['id'] ?? ''; this.p.cycle(id); this.route(location.hash.slice(1) || 'home'); document.querySelector<HTMLElement>(`.tchip[data-id="${id}"]`)?.focus(); return; }
    const ob = target.closest<HTMLElement>('[data-open]');
    if (ob) {
      const n = Number(ob.dataset['open']); const box = document.getElementById(`mc-${n}`) as HTMLElement; const m = this.p.M(n); const t = this.p.TR(m.track)!; const i = t.mods.indexOf(n); const open = box.hidden;
      $$(document, '.m-confirm').forEach((x) => { x.hidden = true; }); $$(document, '[data-open]').forEach((x) => x.setAttribute('aria-expanded', 'false'));
      if (open) {
        const s = this.p.modStatus(n); const pre = m.pre.map((pp) => this.p.M(pp).name + (this.p.modStatus(pp).done ? ' ✓' : '')).join(', ');
        setHtml(box, html`<b>You are about to open: ${m.name}</b><p>${t.name} · Module ${i + 1} of ${t.mods.length} · ${s.ts.length} techniques and a 10-question quiz${pre ? ` · Builds on ${pre}` : ''}</p><div class="btns" style="margin:0"><a class="btn primary sm" href="${m.url}">Open ${m.name} →</a><button class="btn sm" type="button" data-close="${n}">Not now</button></div>`);
        box.hidden = false; ob.setAttribute('aria-expanded', 'true'); box.querySelector<HTMLElement>('a')?.focus();
      }
      return;
    }
    const cb = target.closest<HTMLElement>('[data-close]');
    if (cb) { const n = cb.dataset['close']; (document.getElementById(`mc-${n}`) as HTMLElement).hidden = true; const o = document.querySelector<HTMLElement>(`[data-open="${n}"]`); o?.setAttribute('aria-expanded', 'false'); o?.focus(); return; }
    const op = target.closest<HTMLButtonElement>('.opt');
    if (op) {
      const t = this.d.teasers[Math.floor(Date.now() / 86400000) % this.d.teasers.length]!; const i = Number(op.dataset['i']);
      $$<HTMLButtonElement>(document, '.opt').forEach((b) => { b.disabled = true; if (Number(b.dataset['i']) === t.c) b.classList.add('right'); else if (b === op) b.classList.add('wrong'); });
      const m = this.p.M(t.m); const ex = document.getElementById('texpl') as HTMLElement; ex.hidden = false;
      setHtml(ex, html`<b>${i === t.c ? 'Right.' : 'Not quite.'}</b> ${t.e} <a href="${this.link(t.m, t.t)}">Learn it in ${m.name}</a>`);
      return;
    }
    const fc = target.closest<HTMLElement>('.fchip');
    if (fc) { this.caseSector = fc.dataset['s'] ?? 'All'; this.caseLimit = 12; this.renderCases(); document.querySelector<HTMLElement>(`.fchip[data-s="${CSS.escape(this.caseSector)}"]`)?.focus(); return; }
    if (target.id === 'cmore') { this.caseLimit += 12; this.renderCases(); return; }
    const lb = target.closest<HTMLElement>('[data-lib]');
    if (lb) { this.libTab = lb.dataset['lib'] === 'conn' ? 'conn' : 'gloss'; this.route(this.libMod ? `library~p${this.libMod}` : 'library'); }
  }

  /** Handles a click inside the Daily Mix card. Returns true when it owned the click. */
  private onMixClick(target: HTMLElement): boolean {
    const row = target.closest<HTMLElement>('[data-mix]');
    if (row) {
      const k = row.dataset['mix'] ?? ''; this.mixOpen = this.mixOpen === k ? null : k;
      this.renderMix();
      // Matched rather than selected: an item key holds ':', '|' and '.', and CSS.escape is missing in jsdom.
      $$(document, '[data-mix]').find((el) => el.dataset['mix'] === k)?.focus();
      return true;
    }
    const rev = target.closest<HTMLElement>('[data-mixreveal]');
    if (rev) { this.mixRevealed.add(rev.dataset['mixreveal'] ?? ''); this.renderMix(); return true; }
    const rate = target.closest<HTMLElement>('[data-mixrate]');
    if (rate) {
      const k = rate.dataset['k'] ?? ''; const how = rate.dataset['mixrate']; const ok = how !== 'again';
      const it = this.mixer().items().find((x) => x.key === k);
      // A rating goes through the spaced-review engine, so the mix feeds the same schedule as #review.
      if (it && (it.kind === 'review' || it.kind === 'new')) this.p.rate(it.tech.id, ok);
      this.mixer().mark(k, ok);
      // "Still learning" leaves the row open: it is coming back tomorrow, not finished with.
      this.mixOpen = ok ? null : k;
      this.renderMix();
      return true;
    }
    const opt = target.closest<HTMLButtonElement>('.mopt');
    if (opt) {
      const k = opt.dataset['k'] ?? ''; const i = Number(opt.dataset['mopt']);
      const it = this.mixer().items().find((x) => x.key === k);
      this.mixPicked.set(k, i);
      this.mixer().mark(k, it?.kind === 'case' && i === it.correct);
      this.renderMix(); return true;
    }
    return false;
  }
}
export { addDays };
