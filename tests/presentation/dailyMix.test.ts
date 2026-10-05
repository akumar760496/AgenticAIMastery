/**
 * The Daily Mix. Two things are worth holding down: the card is off unless the content asks for it,
 * and a case question never contains its own answer — a case whose text names its technique, or whose
 * technique is not one of its module's, would be unanswerable or free.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { HubData, HubTechnique, ModuleData } from '@/presentation/site/content';
import { DailyMix } from '@/presentation/site/hub/DailyMix';
import { HubProgress, addDays, today } from '@/presentation/site/hub/HubProgress';
import { SiteApp } from '@/presentation/site/SiteApp';

const hub = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/hub.json'), 'utf8')) as HubData;
const prompting = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/modules/prompting.json'), 'utf8')) as ModuleData;
const SCOPE = hub.mix?.mods ?? [];

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as never;
});
beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.useRealTimers(); });

const mix = (data: HubData = hub) => new DailyMix(new HubProgress(data));

describe('the Daily Mix content flag', () => {
  it('is off when the content names no modules, and leaves the card empty', () => {
    const { mix: _drop, ...noMix } = hub as HubData & { mix?: unknown };
    expect(mix(noMix as HubData).on).toBe(false);
    expect(mix(noMix as HubData).items()).toHaveLength(0);
    expect(mix({ ...hub, mix: { mods: [], goal: 5 } }).on).toBe(false);
  });

  it('is on for the modules the content names', () => {
    expect(SCOPE.length, 'hub.json should name at least one module').toBeGreaterThan(0);
    expect(mix().on).toBe(true);
  });

  it('draws every item from the named modules only', () => {
    for (const it of mix().items()) {
      if (it.kind === 'connect') expect(SCOPE.includes(it.conn.a) || SCOPE.includes(it.conn.b), `${it.key} is out of scope`).toBe(true);
      else expect(SCOPE, `${it.key} is out of scope`).toContain(it.kind === 'case' ? it.c.p : it.tech.p);
    }
  });
});

describe('what a day is made of', () => {
  it('fills to the goal on a first visit, and mixes the kinds', () => {
    const items = mix().items();
    expect(items).toHaveLength(hub.mix?.goal ?? 5);
    const kinds = new Set(items.map((i) => i.kind));
    // The variety is the feature: a set of five identical items is the thing this replaces.
    expect(kinds.size, `only got ${[...kinds].join(', ')}`).toBeGreaterThanOrEqual(3);
    expect(kinds).toContain('connect');
    expect(kinds).toContain('case');
  });

  it('puts due reviews first and still fills the rest of the card', () => {
    const p = new HubProgress(hub);
    const due = hub.techs.filter((t) => SCOPE.includes(t.p)).slice(0, 3);
    for (const t of due) p.state.tech[t.id] = { box: 2, due: addDays(today(), -1), intro: '2020-01-01', last: 1 };
    const items = new DailyMix(p).items();
    expect(items).toHaveLength(hub.mix?.goal ?? 5);
    expect(items[0]?.kind).toBe('review');
    // At most two reviews, so a backlog cannot crowd out the case and the connection.
    expect(items.filter((i) => i.kind === 'review')).toHaveLength(2);
    expect(items.map((i) => i.kind)).toContain('case');
  });

  it('keeps the same set for the whole day, so an answered row does not vanish', () => {
    const first = mix().items().map((i) => i.key);
    const p = new HubProgress(hub);
    // Rating every technique empties the due and unseen pools a fresh pick would have drawn from.
    for (const t of hub.techs) p.rate(t.id, true);
    expect(new DailyMix(p).items().map((i) => i.key)).toEqual(first);
  });

  it('starts a new set when the day changes', () => {
    const before = mix().items().map((i) => i.key);
    const saved = JSON.parse(localStorage.getItem('aam-mix-v1') ?? '{}') as { d: string };
    expect(saved.d).toBe(today());
    localStorage.setItem('aam-mix-v1', JSON.stringify({ ...saved, d: addDays(today(), -1), done: before }));
    const fresh = mix();
    expect(fresh.doneCount, 'yesterday’s ticks must not carry over').toBe(0);
    expect(fresh.items()).toHaveLength(hub.mix?.goal ?? 5);
  });
});

describe('the case question', () => {
  it('offers four options holding the answer exactly once', () => {
    const it = mix().items().find((x) => x.kind === 'case');
    expect(it, 'a case item should be in the set').toBeDefined();
    if (it?.kind !== 'case') return;
    expect(it.options).toHaveLength(4);
    expect(it.options.filter((o) => o === it.c.tn)).toHaveLength(1);
    expect(it.options[it.correct]).toBe(it.c.tn);
    expect(new Set(it.options).size, 'no repeated options').toBe(4);
  });

  it('never asks a question its own text answers, for any case in scope', () => {
    // The pool, not just today's pick: the filter has to hold on every day of the rotation.
    const usable = hub.cases.filter((c) => SCOPE.includes(c.p) && hub.techs.some((t) => t.p === c.p && t.name === c.tn));
    expect(usable.length, 'no usable cases in scope').toBeGreaterThan(0);
    for (const c of usable) {
      expect(c.text.toLowerCase().includes(c.tn.toLowerCase()), `${c.id}: the case text names its own technique`).toBe(false);
      expect(hub.techs.filter((t) => t.p === c.p).length, `${c.id}: too few techniques for distractors`).toBeGreaterThanOrEqual(4);
    }
  });

  it('is never answered by another row of the same day, across the whole rotation', () => {
    // The case asks which technique its story is about. If a review, a new technique or the day's
    // connection already names that technique, the card answers its own question.
    try {
      for (let day = 0; day < 40; day++) {
        vi.setSystemTime(new Date(2026, 0, 5 + day, 9, 0, 0));
        localStorage.clear();
        const items = mix().items();
        const cas = items.find((x) => x.kind === 'case');
        if (cas?.kind !== 'case') continue;
        const named = items.flatMap((x) => x.kind === 'connect' ? [x.conn.an, x.conn.bn] : x.kind === 'case' ? [] : [x.tech.name]);
        expect(named, `day ${day}: the set names the case's own answer`).not.toContain(cas.c.tn);
      }
    } finally { vi.useRealTimers(); }
  });

  it('rotates the case and the connection as the days pass', () => {
    try {
      const cases = new Set<string>(); const conns = new Set<string>();
      for (let day = 0; day < 8; day++) {
        vi.setSystemTime(new Date(2026, 0, 5 + day, 9, 0, 0));
        localStorage.clear();
        for (const x of mix().items()) { if (x.kind === 'case') cases.add(x.c.id); if (x.kind === 'connect') conns.add(x.key); }
      }
      expect(cases.size, 'the same case every day is not a daily mix').toBeGreaterThan(3);
      expect(conns.size).toBeGreaterThan(3);
    } finally { vi.useRealTimers(); }
  });

  it('draws its distractors from the same module', () => {
    const it = mix().items().find((x) => x.kind === 'case');
    if (it?.kind !== 'case') return;
    const names = hub.techs.filter((t) => t.p === it.c.p).map((t) => t.name);
    for (const o of it.options) expect(names, `${o} is not a technique of module ${it.c.p}`).toContain(o);
  });
});

describe('finishing an item', () => {
  it('ticks a right answer, counts it and marks the day studied', () => {
    const p = new HubProgress(hub);
    const mx = new DailyMix(p);
    const key = mx.items()[0]?.key as string;
    expect(mx.isDone(key)).toBe(false);
    mx.mark(key, true);
    expect(mx.isDone(key)).toBe(true);
    expect(mx.doneCount).toBe(1);
    // Answering anything in the mix is showing up, which is what the streak counts.
    expect(p.state.days).toContain(today());
    expect(p.streak()).toBe(1);
  });

  it('does NOT tick an item the learner did not get', () => {
    // "Still learning" used to mark the row done, tick it and strike it through, while the spaced
    // engine was simultaneously scheduling it for tomorrow. The card was claiming the opposite of
    // what the schedule knew.
    const p = new HubProgress(hub);
    const mx = new DailyMix(p);
    const key = mx.items()[0]?.key as string;
    mx.mark(key, false);
    expect(mx.isDone(key), 'an item not got must never read as done').toBe(false);
    expect(mx.isMissed(key)).toBe(true);
    expect(mx.isSeen(key), 'it has still been dealt with today').toBe(true);
    expect(mx.doneCount).toBe(0);
    expect(mx.seenCount).toBe(1);
    expect(mx.missCount).toBe(1);
    expect(p.state.days, 'attempting it still counts as showing up').toContain(today());
  });

  it('lets a second answer correct the first', () => {
    const mx = mix(); const key = mx.items()[0]?.key as string;
    mx.mark(key, false);
    mx.mark(key, true);
    expect(mx.doneCount).toBe(1); expect(mx.missCount).toBe(0);
    expect(mx.seenCount, 'not counted twice').toBe(1);
  });

  it('survives a reload and does not double-count', () => {
    const mx = mix(); const key = mx.items()[0]?.key as string;
    mx.mark(key, true); mx.mark(key, true);
    expect(mx.doneCount).toBe(1);
    expect(mix().doneCount, 'the tick should come back from storage').toBe(1);
  });

  it('reports what is due tomorrow inside its own modules', () => {
    const p = new HubProgress(hub);
    const inScope = hub.techs.filter((t) => SCOPE.includes(t.p)).slice(0, 2);
    const outside = hub.techs.find((t) => !SCOPE.includes(t.p)) as HubTechnique;
    for (const t of [...inScope, outside]) p.state.tech[t.id] = { box: 1, due: addDays(today(), 1), intro: today(), last: 1 };
    expect(new DailyMix(p).tomorrow()).toBe(inScope.length);
  });
});

describe('where the mix lives', () => {
  const tick = (ms = 80) => new Promise((r) => setTimeout(r, ms));
  let live: SiteApp | null = null;
  /** The rail is for returning learners, so a boot has to look like a second visit. */
  async function boot(hash = 'home', extra?: (p: HubProgress) => void) {
    const seed = new HubProgress(hub);
    seed.rate((hub.techs.find((t) => SCOPE.includes(t.p)) as HubTechnique).id, true);
    // Rollups are written by module pages, so a home-only test has to put them there itself.
    extra?.(seed);
    live?.destroy(); live = null;
    const root = document.createElement('div'); document.body.replaceChildren(root);
    location.hash = hash;
    const app = new SiteApp(root, hub, () => ({}), () => ({}));
    live = app; await app.start(); await tick();
    return app;
  }

  it('puts a summary rail on home, not the full card', async () => {
    await boot('home');
    const rail = document.getElementById('hubRail') as HTMLElement;
    expect(rail, 'no rail element').not.toBeNull();
    expect(rail.hidden, 'the rail should be showing on home').toBe(false);
    expect(document.getElementById('hubroot')?.classList.contains('has-rail')).toBe(true);
    // One dot per item, and a link to the page where the work is actually done.
    expect(rail.querySelectorAll('.hr-dots i').length).toBe(hub.mix?.goal ?? 5);
    expect(rail.querySelector<HTMLAnchorElement>('a.btn')?.getAttribute('href')).toBe('#review');
    expect(document.querySelector('#view #mix'), 'the heavy card must not be on home').toBeNull();
  });

  it('comes after the page content in the DOM, so it falls below it on a phone', async () => {
    await boot('home');
    const view = document.getElementById('view') as HTMLElement;
    const rail = document.getElementById('hubRail') as HTMLElement;
    // Reordering with CSS would leave focus order disagreeing with what is on screen.
    expect(view.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows the same summary as a crumb-bar chip, for widths with no column', async () => {
    await boot('home');
    const chip = document.querySelector<HTMLAnchorElement>('#gnBand .hr-chip');
    expect(chip, 'nothing for a phone to see').not.toBeNull();
    expect(chip?.getAttribute('href')).toBe('#review');
    expect(chip?.querySelectorAll('i').length).toBe(hub.mix?.goal ?? 5);
    // The stylesheet keys off this, showing the band and hiding the breadcrumb on home only.
    expect(document.documentElement.dataset['view']).toBe('home-rail');
  });

  it('clears the chip when leaving home', async () => {
    await boot('home');
    expect(document.querySelector('#gnBand .hr-chip')).not.toBeNull();
    location.hash = 'library'; window.dispatchEvent(new HashChangeEvent('hashchange'));
    await tick(150);
    expect(document.querySelector('#gnBand .hr-chip'), 'the chip must not follow you around').toBeNull();
    expect(document.documentElement.dataset['view']).not.toBe('home-rail');
  });

  it('hides the rail itself below the rail breakpoint, so the chip is not duplicated', () => {
    const css = readFileSync(join(process.cwd(), 'src/content/site/hub.css'), 'utf8');
    const at = css.indexOf('@media (max-width:900px){ .hub-rail{display:none} }');
    expect(at, 'without this the rail stacks under the page content and repeats the chip').toBeGreaterThan(-1);
  });

  it('does not list the module the hero already points at', async () => {
    // Reported from the running site: "Still open: Prompting" sat next to a Continue button for
    // Prompting, with every bar on zero.
    const blank = { quizBest: null, quizTried: false, capSolved: 0, capTotal: 3, capStarted: 0, goalsOn: 0, goalsTotal: 24 };
    await boot('home', (p) => {
      p.setRollup(13, { ...blank, capStarted: 1, at: Date.now() });
      p.setRollup(2, { ...blank, quizTried: true, at: Date.now() - 1000 });
    });
    const cont = document.querySelector('.hero .btn.primary')?.textContent?.replace('Continue: ', '').trim();
    const listed = [...document.querySelectorAll('.ipr .iph b')].map((e) => e.textContent?.trim());
    expect(cont, 'no Continue button to compare against').toBe('Prompting & Structured Outputs');
    // Non-vacuous: the other started module must still be listed.
    expect(listed, 'the list did not render at all').toContain('Guardrails');
    expect(listed, 'the same module is named twice on one screen').not.toContain(cont);
  });

  it('leaves no "Up next" card, which only repeated the Continue button', async () => {
    await boot('home');
    expect(document.querySelector('.cont'), 'the Up next card should be gone').toBeNull();
    expect(document.querySelector('.hero .btn.primary')?.textContent).toMatch(/^Continue: /);
  });

  it('shows what earned a module its place in the list', async () => {
    // A card with every bar on zero gives the reader no reason for its own existence.
    const blank = { quizBest: null, quizTried: false, capSolved: 0, capTotal: 3, capStarted: 0, goalsOn: 0, goalsTotal: 24 };
    await boot('home', (p) => p.setRollup(2, { ...blank, capStarted: 1, at: Date.now() }));
    const card = document.querySelector('.ipr');
    expect(card?.textContent).toContain('1 open');
  });

  it('keeps the rail off every hub page that is not home', async () => {
    await boot('practise');
    expect((document.getElementById('hubRail') as HTMLElement).hidden).toBe(true);
    expect(document.getElementById('hubroot')?.classList.contains('has-rail')).toBe(false);
  });

  it('puts the full card on the Today page, where the bodies have room', async () => {
    await boot('review');
    const card = document.getElementById('mix');
    expect(card, 'the mix belongs on #review now').not.toBeNull();
    expect(card?.querySelectorAll('.mixrow').length).toBe(hub.mix?.goal ?? 5);
    expect((document.getElementById('hubRail') as HTMLElement).hidden, 'no rail competing with it').toBe(true);
  });

  it('does not ask the same technique twice on the Today page', async () => {
    await boot('review');
    const inMix = [...document.querySelectorAll('#mix .mixrow')]
      .filter((r) => ['Review', 'New'].includes(r.querySelector('.mx-k')?.textContent?.trim() ?? ''))
      .map((r) => r.querySelector('.mx-t')?.textContent?.trim());
    const onDeck = document.querySelector('#rcard .nm')?.textContent?.trim();
    if (onDeck) expect(inMix, 'the deck below repeats a mix item').not.toContain(onDeck);
  });

  it('opens a row in place and reveals it without leaving the page', async () => {
    await boot('review');
    const row = document.querySelector<HTMLButtonElement>('#mix .mx-top');
    expect(row).not.toBeNull();
    row?.click();
    expect(document.querySelector('#mix .mx-body'), 'the row should open inline').not.toBeNull();
    expect(location.hash, 'opening a row must not navigate').toBe('#review');
    expect(document.querySelector('#mix [data-mixreveal], #mix .mopt')).not.toBeNull();
  });

  it('offers a Resume that returns to the technique last touched', async () => {
    await boot('review');
    const go = document.querySelector<HTMLAnchorElement>('#mix .mix-end a');
    expect(go, 'the card should offer a way back in').not.toBeNull();
    const seededId = (hub.techs.find((t) => SCOPE.includes(t.p)) as HubTechnique).id;
    expect(go?.getAttribute('href')).toContain(`~${seededId}`);
    expect(go?.textContent).toMatch(/^Resume: /);
  });

  it('keeps its rules in the hub stylesheet, which is the only page it renders on', () => {
    const css = readFileSync(join(process.cwd(), 'src/content/site/hub.css'), 'utf8');
    for (const cls of ['.mixc', '.mix-bar', '.mixrow', '.mx-top', '.mx-body', '.mopt', '.hub-rail', '.hr-ring', '.hr-dots']) {
      expect(css, `hub.css is missing ${cls}`).toContain(cls);
    }
  });

  it('colours itself with the hub token, not the module one', () => {
    // --accent and --accent-soft are module-page tokens, undefined on hub pages. Using them is not a
    // fallback to some default: `background:var(--accent)` computes to transparent, which is how the
    // progress bar shipped invisible. The hub's accent is --t, set per area by setArea.
    const css = readFileSync(join(process.cwd(), 'src/content/site/hub.css'), 'utf8');
    const block = css.slice(css.indexOf('.mixc{'));
    expect(block, 'the Daily Mix rules must not use --accent').not.toMatch(/var\(--accent/);

    const views = readFileSync(join(process.cwd(), 'src/presentation/site/hub/HubViews.ts'), 'utf8');
    const mixRow = views.slice(views.indexOf('private mixRow('), views.indexOf('private mixBody('));
    expect(mixRow, 'the connection row has no module, so it falls back to --t').not.toMatch(/var\(--accent/);
  });
});
