/**
 * Router behaviour, which had no coverage: a navigation that interrupts a module load, and sub-routes
 * arriving for the module already on screen. Both were silently broken — see the comments in SiteApp.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { HubData } from '@/presentation/site/content';
import { SiteApp } from '@/presentation/site/SiteApp';
import hubCss from '@/content/site/hub.css?raw';

const hub = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/hub.json'), 'utf8')) as HubData;

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  window.scrollTo = () => {};
  window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as never;
});
beforeEach(() => { localStorage.clear(); });

/** What a browser does for a fragment link: set the hash, then tell listeners. */
const hop = (h: string) => { const before = location.hash; location.hash = h.replace(/^#/, ''); if (location.hash !== before) window.dispatchEvent(new HashChangeEvent('hashchange')); };
/** Module content is fetched lazily, so wait on the condition rather than on a guessed delay. */
async function waitFor(what: string, pred: () => boolean, ms = 5000): Promise<void> {
  const t0 = Date.now();
  while (!pred() && Date.now() - t0 < ms) await new Promise((r) => setTimeout(r, 15));
  expect(pred(), `timed out waiting for ${what}`).toBe(true);
}
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const showing = () => ((document.getElementById('modroot') as HTMLElement).hidden ? 'hub' : 'mod');
const tab = () => document.querySelector('#modroot #tabs [aria-selected="true"]')?.textContent?.trim();
const panelOpen = (id: string) => document.querySelector<HTMLElement>(`#panel-${id}`)?.hidden === false;
const nextLink = () => document.querySelector<HTMLAnchorElement>('#modroot .gn-pn a.nx');

let live: SiteApp | null = null;
async function boot(hash: string) {
  // Without this the previous app keeps its hashchange listener and its own page stylesheet, and two
  // routers then fight over one #modroot — which looks exactly like the bug under test.
  live?.destroy(); live = null;
  const root = document.createElement('div'); document.body.replaceChildren(root);
  location.hash = hash;
  const app = new SiteApp(root, hub, () => ({}), () => ({}));
  live = app;
  await app.start();
  if (hash.startsWith('m-')) await waitFor(`${hash} to mount`, () => !!tab());
  else await tick();
  return app;
}

describe('a navigation that interrupts a module load', () => {
  it('leaves the hub showing, and does not strand the module it abandoned', async () => {
    await boot('');
    expect(showing()).toBe('hub');

    // Click a module, then a top-nav link before the module's content arrives.
    hop('m-multi'); hop('home');
    await tick(300);
    expect(showing(), 'the later navigation must win').toBe('hub');

    // The abandoned module must still be reachable: before the fix this link was dead for good.
    hop('m-multi');
    await waitFor('#m-multi to mount after an interrupted load', () => showing() === 'mod' && !!tab());
    expect(document.title).toContain('Multi-Agent Systems');
  }, 30000);

  it('keeps the hub stylesheet when a module load loses the race', async () => {
    await boot('');
    hop('m-cost'); hop('review');
    await tick(300);
    expect(showing()).toBe('hub');
    expect((document.getElementById('pagecss') as HTMLStyleElement).textContent,
      'a losing module load must not overwrite the hub stylesheet').toBe(hubCss);
  }, 30000);
});

describe('a sub-route for the module already on screen', () => {
  it('switches technique, opens a band panel, and resets on the bare module link', async () => {
    await boot('m-arch~react');
    expect(tab()).toBe('ReAct Loop');

    hop('m-arch~hitl'); await tick();
    expect(tab(), 'a technique deep link must select it').toBe('Human-in-the-Loop Checkpoints');

    hop('m-arch~capstone'); await tick();
    expect(panelOpen('capstone'), '~capstone must open the capstone panel').toBe(true);

    hop('m-arch~quiz'); await tick();
    expect(panelOpen('quiz'), '~quiz must open the quiz panel').toBe(true);
    expect(panelOpen('capstone'), 'only one panel at a time').toBe(false);

    // The breadcrumb and the rail both link to the bare module url while a technique is in the hash.
    hop('m-arch'); await tick();
    expect(showing()).toBe('mod');
    expect(tab(), 'the bare module link must return to its first technique').toBe('Workflow Patterns');
    expect(panelOpen('capstone')).toBe(false);
    expect(panelOpen('quiz')).toBe(false);
  }, 30000);

  it('is what the breadcrumb and rail links actually do', async () => {
    await boot('m-arch~react');
    for (const sel of ['#gnBc a[href="#m-arch"]', '#gnRail a.curm']) {
      hop('m-arch~react'); await tick();
      expect(tab(), sel).toBe('ReAct Loop');
      const a = document.querySelector<HTMLAnchorElement>(sel);
      expect(a, `${sel} should exist`).not.toBeNull();
      hop(a!.getAttribute('href') ?? ''); await tick();
      expect(tab(), `${sel} must change what is rendered`).toBe('Workflow Patterns');
    }
  }, 30000);
});

describe('module navigation links', () => {
  it('sends the last module of every track to the next track', async () => {
    await boot('');
    for (const t of hub.tracks) {
      const last = t.mods[t.mods.length - 1] as number;
      const url = hub.mods.find((m) => m.n === last)!.url;
      hop(url);
      await waitFor(`${url} to mount`, () => showing() === 'mod' && !!nextLink());
      const ti = hub.tracks.indexOf(t); const next = hub.tracks[ti + 1];
      expect(nextLink()!.getAttribute('href'), `${url}: next link target`).toBe(next ? `#t-${next.id}` : '#home');
      hop(nextLink()!.getAttribute('href') ?? '');
      await waitFor(`${url} next link to land on the hub`, () => showing() === 'hub');
      expect(document.querySelector('#view h1,#view h2')?.textContent?.trim(), url)
        .toBe(next ? next.name : 'Design AI agents that hold up in production');
    }
  }, 60000);
});
