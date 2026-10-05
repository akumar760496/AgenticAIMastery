/**
 * A module page: header, top diagram, technique tabs with the selected technique's detail, "Which one do I need?",
 * capstone, side-by-side table, quiz centre, self-test flip cards and glossary.
 */
import type { PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import { $, $$, html, reducedMotion, setHtml, storage, trusted, type TrustedHtml } from '../html';
import type { ModuleData, Technique } from '../content';
import { glossify } from '../technique/glossify';
import type { SxScene } from '../sx/SxPlayer';
import { renderTechniqueDetail, type PaneKey } from '../technique/TechniqueDetail';
import { capstoneProgress, mountCapstone } from './capstone';
import type { ModuleContext } from './ModuleContext';
import { moduleRollup, type ModuleRollup } from './moduleProgress';
import { QuizEngine } from './QuizEngine';

export interface ModulePageOptions {
  readonly data: ModuleData;
  readonly hubUrl: string;
  readonly assetBase: string;
  readonly playgrounds: Readonly<Record<string, PlaygroundDefinition<any, any>>>;
  readonly scenes: Readonly<Record<string, SxScene>>;
  /** Technique (or `quiz`, `glossary`, `capstone`) requested by the URL. */
  readonly initial: string;
  readonly onTechniqueChange: (id: string) => void;
  /**
   * Reports what this module can see of the learner's work, for the hub to store. Called on mount and
   * again on teardown, which is every navigation away — so leaving a module half-finished and starting
   * another one records both. The panes are not wired into this: reading their storage keys once at
   * each end of the visit is enough and keeps the quiz, capstone and practice code unaware of the hub.
   */
  readonly onProgress?: (rollup: ModuleRollup) => void;
}

export interface ModulePageHandle {
  /** Applies a sub-route to the page already on screen, so the router need not remount it. */
  readonly show: (sub: string, nav?: boolean) => void;
  readonly destroy: () => void;
}

const LEVEL_TEXT = ['', 'low', 'low to medium', 'medium to high', 'high'];
const level = (n: number) => html`<span class="lvl" aria-label="${LEVEL_TEXT[n] ?? ''}">${[1, 2, 3, 4].map((i) => html`<i class="${i <= n ? 'on' : ''}"></i>`)}</span>`;

function section(id: string, data: ModuleData, inner: TrustedHtml, fallbackTitle = ''): TrustedHtml {
  const s = data.header.sections[id];
  return html`<section class="sec" aria-labelledby="${id}"><div class="sec-head"><h2 id="${id}">${trusted(s?.title ?? fallbackTitle)}</h2><p>${trusted(s?.blurb ?? '')}</p></div>${inner}</section>`;
}

/** The sections that are about all the techniques at once, grouped behind progress cards. */
function bandHTML(d: ModuleData): TrustedHtml {
  const cap = d.cx?.capstone || d.cx?.cases?.length;
  const terms = d.study.gloss.length;
  const card = (key: string, eyebrow: string, title: string, inner: TrustedHtml): TrustedHtml =>
    html`<button class="bcard" type="button" id="bc-${key}" data-open="${key}" aria-expanded="false" aria-controls="panel-${key}"><span class="eyebrow">${eyebrow}</span><b>${title}</b><span class="bstate" id="bs-${key}"></span>${inner}<span class="barrow" aria-hidden="true">→</span></button>`;
  return section('band-h', d, html`<div class="band">
    <div class="band-cards">
      ${cap ? card('capstone', 'Case studies', d.header.sections['cap-h']?.title ?? 'Capstone', html`<span class="bnote">${trusted(d.header.sections['cap-h']?.blurb ?? '')}</span>`) : ''}
      ${card('quiz', 'Test yourself', d.header.sections['quiz-h']?.title ?? 'Quizzes', html`<span class="bnote">${trusted(d.header.sections['quiz-h']?.blurb ?? '')}</span>`)}
    </div>
    ${cap ? html`<div class="band-panel" id="panel-capstone" hidden><div class="capstone" id="capstone"></div></div>` : ''}
    <div class="band-panel" id="panel-quiz" hidden><div class="qz-center" id="qz-center"></div>
      <div class="band-sub"><h3 id="fc-h">${trusted(d.header.sections['fc-h']?.title ?? 'Self-test')}</h3><p class="pl-note">${trusted(d.header.sections['fc-h']?.blurb ?? '')}</p>
      <div class="card-bar"><button class="btn" id="flipAll" type="button">Flip all</button><button class="btn" id="resetAll" type="button">Reset</button><span id="fcCount"></span></div><div class="cards" id="cards"></div></div></div>
    <details class="band-ref" id="cmp-d"><summary><span class="eyebrow">Reference</span><b>${trusted(d.header.sections['cmp-h']?.title ?? 'Side by side')}</b><span class="bnote">${trusted(d.header.sections['cmp-h']?.blurb ?? '')}</span></summary>
      <div class="tbl-wrap"><table id="cmp"></table></div></details>
    <p class="band-lib"><span class="eyebrow">Reference</span><span>${terms} terms from this module are in the course glossary, and dotted terms on this page show their definition where you meet them.</span><a class="btn" href="#library~p${d.n}">Open the Library →</a></p>
  </div>`);
}

export function pageHTML(d: ModuleData): TrustedHtml {
  const h = d.header;
  const head = html`<svg width="0" height="0" style="position:absolute" aria-hidden="true">${trusted(h.markers)}</svg>
<div class="wrap">
  <header class="top">
    <div class="crumbs">${trusted(h.crumbs)}</div>
    <h1>${trusted(h.h1)}</h1>
    <p class="lede">${trusted(h.lede)}</p>
  </header>
  ${section('loop-h', d, html`<div class="loop" id="loop">${trusted(d.loop)}</div>`)}`;
  const chooser = section('ch-h', d, html`<div class="chooser"><div class="qs" id="qs"></div><div class="answer" id="answer"></div></div>`);
  const techniques = section('tech-h', d, html`<div class="tabs" role="tablist" aria-label="${d.title} techniques" id="tabs"></div><article class="detail" id="detail" role="tabpanel" aria-live="polite"></article>`);
  const foot = html`<footer>${h.footer.map((f) => html`<span>${trusted(f)}</span>`)}</footer>
</div>`;
  // The chooser is the way in, so it sits above the techniques; everything module-wide goes into one band.
  if (h.layout === 'bands') return html`${head}${chooser}${techniques}${bandHTML(d)}${foot}`;
  return html`${head}${techniques}${chooser}
  ${d.cx?.capstone || d.cx?.cases?.length ? section('cap-h', d, html`<div class="capstone" id="capstone"></div>`) : ''}
  ${section('cmp-h', d, html`<div class="tbl-wrap"><table id="cmp"></table></div>`)}
  ${section('quiz-h', d, html`<div class="qz-center" id="qz-center"></div>`, 'Quizzes and progress tracker')}
  ${section('fc-h', d, html`<div class="card-bar"><button class="btn" id="flipAll" type="button">Flip all</button><button class="btn" id="resetAll" type="button">Reset</button><span id="fcCount"></span></div><div class="cards" id="cards"></div>`)}
  ${section('glo-h', d, html`<input class="gsearch" id="gsearch" type="search" placeholder="Search terms" aria-label="Search the glossary"><dl class="glist" id="glist"></dl>`)}
  ${foot}`;
}

export function mountModulePage(root: HTMLElement, opts: ModulePageOptions): ModulePageHandle {
  const d = opts.data; const T = d.techniques;
  const report = () => { try { opts.onProgress?.(moduleRollup(d)); } catch { /* progress is never worth breaking the page for */ } };
  setHtml(root, pageHTML(d));
  const tabs = $(root, '#tabs')!; const detail = $(root, '#detail')!;
  const pane: { current: PaneKey } = { current: 'learn' };
  let cleanups: (() => void)[] = [];
  const runCleanups = () => { cleanups.forEach((f) => { try { f(); } catch { /* ignore */ } }); cleanups = []; };
  /** Teardown for the page itself, which outlives a technique switch. */
  const pageCleanups: (() => void)[] = [];
  const gloss = d.study.gloss;
  const scrollToTech = () => $(root, '#tech-h')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });

  const ctx: ModuleContext = {
    data: d, hubUrl: opts.hubUrl, assetBase: opts.assetBase,
    playground: (id) => opts.playgrounds[id],
    technique: (id) => T.find((t) => t.id === id),
    scene: (id) => opts.scenes[id],
    selectTechnique: (id, focus) => select(id, focus),
    gotoPane: (p) => { const b = $(detail, `#st-${p}`); if (b) { b.click(); b.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }); } },
    glossify: (el) => glossify(el, gloss),
    onCleanup: (fn) => { cleanups.push(fn); },
  };
  const quiz = new QuizEngine(d, opts.hubUrl, (id) => { select(id); setTimeout(() => ctx.gotoPane('learn'), 60); });

  setHtml(tabs, html`${T.map((t) => html`<button class="tab" role="tab" id="tab-${t.id}" aria-controls="detail" aria-selected="false" type="button" data-id="${t.id}">${t.name}</button>`)}`);
  const storeKey = `aam-tab-p${d.n}`;
  function select(id: string, focus = false): void {
    const t: Technique = T.find((x) => x.id === id) ?? T[0]!;
    $$(tabs, '.tab').forEach((b) => { const on = b.dataset['id'] === t.id; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
    runCleanups();
    renderTechniqueDetail(detail, t, ctx, quiz, pane);
    storage.set(storeKey, t.id);
    opts.onTechniqueChange(t.id);
  }
  tabs.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.tab'); if (b) select(b.dataset['id'] ?? ''); });
  tabs.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const ids = T.map((t) => t.id); const cur = ids.indexOf($(tabs, '[aria-selected="true"]')?.dataset['id'] ?? '');
    select(ids[(cur + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length] ?? '', true);
  });

  // chooser
  const qs = $(root, '#qs')!; const ans = $(root, '#answer')!;
  setHtml(qs, html`${d.chooser.map((q, i) => html`<button class="q" type="button" aria-pressed="false" data-i="${i}"><span>${trusted(q[0])}</span><span class="arrow" aria-hidden="true">→</span></button>`)}`);
  const choose = (i: number) => {
    $$(qs, '.q').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset['i']) === i)));
    const q = d.chooser[i]; const t = q ? T.find((x) => x.id === q[1]) : undefined; if (!q || !t) return;
    setHtml(ans, html`<span class="eyebrow">Use</span><div class="name">${t.name}</div><p>${trusted(q[2])}</p>
      <div class="chips">${t.metrics.slice(0, 3).map((m) => html`<span class="chip">${trusted(m[0])}</span>`)}</div>
      <div><button class="btn" type="button" id="goTo">Open the full breakdown ↑</button></div>`);
    $(ans, '#goTo')?.addEventListener('click', () => { select(t.id, true); scrollToTech(); });
  };
  qs.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('.q'); if (b) choose(Number(b.dataset['i'])); });
  choose(0);

  // capstone, comparison, quiz centre
  const cap = $(root, '#capstone'); if (cap) mountCapstone(cap, d, ctx);
  setHtml($(root, '#cmp')!, html`<thead><tr>${trusted(d.compareHead)}</tr></thead><tbody>${T.map((t) => html`<tr><th scope="row">${t.name}</th><td>${trusted(t.q)}</td><td>${trusted(t.cmp.scope)}</td><td>${level(t.cmp.cost)}</td><td>${trusted(t.cmp.needs)}</td><td>${trusted(t.cmp.best)}</td></tr>`)}</tbody>`);
  quiz.mountCenter($(root, '#qz-center')!);

  // flash cards
  const cards = $(root, '#cards')!; const cnt = $(root, '#fcCount')!; const deck = d.extra ? [...T, d.extra] : T;
  setHtml(cards, html`${deck.map((t) => html`<button class="card" type="button" aria-pressed="false" aria-label="${t.name}. Flip to reveal.">
    <div class="inner">
      <div class="face"><span class="k">Technique</span><span class="t">${t.name}</span><span class="hint">What question does it answer? Tap to flip.</span></div>
      <div class="face back"><span class="k">Answers</span><span class="t">“${trusted(t.q)}”</span><span class="m">${trusted(t.metrics[0]?.[0])}: ${trusted(t.metrics[0]?.[1])}</span><span class="hint">${trusted(t.remember)}</span></div>
    </div></button>`)}`);
  const upd = () => { cnt.textContent = `${cards.querySelectorAll('[aria-pressed="true"]').length} of ${deck.length} revealed`; };
  cards.addEventListener('click', (e) => { const c = (e.target as HTMLElement).closest('.card'); if (!c) return; c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); upd(); });
  $(root, '#flipAll')?.addEventListener('click', () => { $$(cards, '.card').forEach((c) => c.setAttribute('aria-pressed', 'true')); upd(); });
  $(root, '#resetAll')?.addEventListener('click', () => { $$(cards, '.card').forEach((c) => c.setAttribute('aria-pressed', 'false')); upd(); });
  upd();

  // glossary: its own section in the original layout, the hub Library in the band layout
  const list = $(root, '#glist'); const inp = $<HTMLInputElement>(root, '#gsearch');
  if (list && inp) {
    const rows = [...gloss].sort((a, b) => a[0].localeCompare(b[0]));
    const drawGloss = () => {
      const q = inp.value.trim().toLowerCase(); const r = rows.filter((g) => !q || g[0].toLowerCase().includes(q) || g[1].toLowerCase().includes(q));
      setHtml(list, r.length ? html`${r.map((g) => html`<div><dt>${trusted(g[0])}</dt><dd>${trusted(g[1])}</dd></div>`)}` : html`<div><dd>No matching terms.</dd></div>`);
    };
    inp.addEventListener('input', drawGloss); drawGloss();
  }
  glossify($(root, '.top .lede'), gloss);

  // band: one panel open at a time, with what the learner has already done on the card
  const bandKeys = ['capstone', 'quiz'] as const;
  const bandState = () => {
    const c = $(root, '#bs-capstone');
    if (c) {
      const p = capstoneProgress(d);
      c.textContent = p.done ? `${p.total} cases · ${p.done} answered${p.started ? `, ${p.started} in progress` : ''}`
        : p.started ? `${p.total} cases · ${p.started} in progress` : `${p.total} cases · not started yet`;
    }
    const q = $(root, '#bs-quiz');
    if (q) {
      const all = T.map((t) => quiz.stats(t.id));
      const att = all.reduce((n, x) => n + x.att, 0);
      const best = all.map((x) => x.best).filter((x): x is number => x != null);
      q.textContent = att ? `${att} attempt${att === 1 ? '' : 's'} · best ${Math.max(...best)} of 10 · ${all.filter((x) => x.att > 0).length} of ${T.length} techniques tried`
        : `${all.reduce((n, x) => n + x.pool, 0)} questions · no attempts yet`;
    }
  };
  const openBand = (key: string | null, scroll = true) => {
    for (const k of bandKeys) {
      const panel = $(root, `#panel-${k}`); const card = $(root, `#bc-${k}`);
      if (!panel || !card) continue;
      const on = k === key;
      panel.hidden = !on; card.setAttribute('aria-expanded', String(on));
    }
    if (key && scroll) $(root, `#bc-${key}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
  };
  if ($(root, '.band')) {
    bandState();
    pageCleanups.push(quiz.subscribe(bandState));
    $$(root, '.bcard').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset['open'] ?? '';
      const already = b.getAttribute('aria-expanded') === 'true';
      openBand(already ? null : key);
      if (!already) { try { history.replaceState(null, '', `#m-${d.slug}~${key}`); } catch { /* ignore */ } }
    }));
  }

  /**
   * Applies a sub-route: a technique id, or `capstone` / `quiz` / `glossary`. Called once on mount with
   * `opts.initial`, and again by the router whenever the hash points at a different part of this same
   * page — a breadcrumb or rail link back to the module, or a deep link pasted while it is already open.
   * `nav` marks those later calls, which scroll to what they opened; the mount must not scroll.
   */
  const show = (want: string, nav = false): void => {
    // Selecting a technique rewrites the hash, and so does opening a band card. Anything watching the
    // hash can therefore call back with what is already on screen; applying that again would undo it.
    if (nav && (want === 'quiz' || want === 'capstone' ? $(root, `#panel-${want}`)?.hidden === false
      : want !== '' && $(tabs, '[aria-selected="true"]')?.dataset['id'] === want)) return;
    select(T.some((t) => t.id === want) ? want : nav ? T[0]?.id ?? '' : storage.get(storeKey) ?? T[0]?.id ?? '');
    if (d.header.layout === 'bands') {
      // The glossary now lives in the hub Library, filtered to this module.
      if (want === 'glossary') { try { location.hash = `library~p${d.n}`; } catch { /* ignore */ } }
      else if (want === 'quiz' || want === 'capstone') { openBand(want, false); setTimeout(() => $(root, `#bc-${want}`)?.scrollIntoView(), 80); }
      // A technique, or no sub-route at all: collapse whatever band panel was open.
      else { openBand(null, false); if (nav) scrollToTech(); }
    } else if (want === 'quiz' || want === 'glossary' || want === 'capstone') {
      setTimeout(() => $(root, `#${want === 'quiz' ? 'quiz-h' : want === 'glossary' ? 'glo-h' : 'cap-h'}`)?.scrollIntoView(), 80);
    } else if (nav) scrollToTech();
  };
  show(opts.initial);
  report();
  return { show, destroy: () => { report(); runCleanups(); pageCleanups.forEach((f) => { try { f(); } catch { /* ignore */ } }); } };
}
