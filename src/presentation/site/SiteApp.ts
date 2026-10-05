/**
 * The site's front controller: hash routing between hub pages (#home, #t-<track>, #review, #practise, #library)
 * and module pages (#m-<slug>~<technique>), page CSS switching, and lazy loading of module content.
 */
import type { PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import hubCss from '@/content/site/hub.css?raw';
import type { HubData, ModuleData } from './content';
import { HubProgress } from './hub/HubProgress';
import { HubViews } from './hub/HubViews';
import { mountModulePage } from './module/ModulePage';
import { html, setHtml } from './html';
import { shellHTML, SiteShell } from './shell/SiteShell';
import type { SxScene } from './sx/SxPlayer';

type PlaygroundMap = Readonly<Record<string, PlaygroundDefinition<any, any>>>;
const moduleJson = import.meta.glob<ModuleData>('../../content/site/modules/*.json', { import: 'default' });
const moduleCss = import.meta.glob<string>('../../content/site/modules/*.css', { query: '?raw', import: 'default' });

type Route = { kind: 'hub'; view: string } | { kind: 'mod'; slug: string; sub: string } | { kind: 'iv'; sub: string };
export function parseRoute(hash: string): Route {
  const h = hash.replace(/^#/, ''); let m: RegExpExecArray | null;
  if ((m = /^m-([a-z]+)(?:~([A-Za-z0-9_.-]+))?$/.exec(h))) return { kind: 'mod', slug: m[1] as string, sub: m[2] ?? '' };
  if ((m = /^iv(?:~([A-Za-z0-9_.-]+))?$/.exec(h))) return { kind: 'iv', sub: m[1] ?? '' };
  return { kind: 'hub', view: h || 'home' };
}

export class SiteApp {
  private readonly progress: HubProgress;
  private readonly shell: SiteShell;
  private readonly hub: HubViews;
  private pageStyle: HTMLStyleElement;
  private current: { kind: string; slug?: string; sub?: string; destroy?: () => void; show?: (sub: string, nav?: boolean) => void } = { kind: 'none' };
  /**
   * Incremented by every navigation. A page load awaits its content, so a second navigation can start
   * while the first is still fetching; comparing the token afterwards tells the slow one it has lost.
   */
  private nav = 0;
  /** Detaches the window- and document-level listeners, so the app can be replaced in place. */
  private readonly ac = new AbortController();

  constructor(private readonly root: HTMLElement, data: HubData, private readonly playgrounds: (slug: string) => PlaygroundMap, private readonly scenes: (slug: string) => Readonly<Record<string, SxScene>>) {
    setHtml(root, shellHTML());
    this.progress = new HubProgress(data);
    this.shell = new SiteShell(this.progress);
    this.shell.init(this.ac.signal);
    this.hub = new HubViews(this.progress, this.shell);
    this.pageStyle = document.createElement('style'); this.pageStyle.id = 'pagecss'; document.head.appendChild(this.pageStyle);
  }

  async start(): Promise<void> {
    window.addEventListener('hashchange', () => void this.route(), { signal: this.ac.signal });
    await this.route();
    void this.progress.connect().then((seed) => { this.shell.setStatus(); if (this.current.kind === 'hub') this.hub.route(location.hash.slice(1) || 'home'); if (seed) this.progress.save(); });
  }

  /**
   * Tears the app down completely: listeners, the mounted view and the page stylesheet.
   * Used by the dev-time hot reload in main.ts, which then builds a fresh app from the new modules.
   */
  destroy(): void {
    this.ac.abort();
    this.current.destroy?.();
    this.current = { kind: 'none' };
    this.pageStyle.remove();
    setHtml(this.root, html``);
  }

  /** A module page sends its quiz score back as #quiz-p<n>-<score>. */
  private applyQuizHash(): boolean {
    const m = /^quiz-p(\d{1,2})-(\d{1,2})$/.exec(location.hash.slice(1));
    if (!m || !this.progress.data.mods.some((x) => x.n === Number(m[1]))) return false;
    this.shell.toast(this.progress.recordQuiz(Number(m[1]), Number(m[2])));
    try { history.replaceState(null, '', `${location.pathname}${location.search}#t-${this.progress.M(Number(m[1])).track}`); } catch { /* ignore */ }
    return true;
  }

  private async route(): Promise<void> {
    this.applyQuizHash();
    const r = parseRoute(location.hash);
    const token = ++this.nav;
    if (r.kind === 'iv') {
      // The room moves between its own tabs with replaceState, which fires no hashchange, so a
      // changed sub here is a real navigation and has to be applied.
      if (this.current.kind === 'iv' && this.current.sub === r.sub) return;
      await this.showInterviewRoom(r.sub, token);
      return;
    }
    if (r.kind === 'mod') {
      // Already showing this module: apply the sub-route in place. Returning instead would make the
      // breadcrumb and rail links back to the module, and any deep link into it, do nothing at all.
      // `show` also proves the page is mounted: without that test a second navigation arriving mid-load
      // would land here, do nothing, and leave the first load to abandon itself on the token check.
      if (this.current.kind === 'mod' && this.current.slug === r.slug && this.current.show) { this.current.show(r.sub, true); return; }
      await this.showModule(r.slug, r.sub, token);
      return;
    }
    this.current.destroy?.();
    this.current = { kind: 'hub' };
    document.documentElement.dataset['mode'] = 'hub';
    this.pageStyle.textContent = hubCss;
    (document.getElementById('modroot') as HTMLElement).hidden = true;
    (document.getElementById('hubroot') as HTMLElement).hidden = false;
    document.title = 'Agentic AI Mastery';
    this.shell.setStatus();
    this.hub.route(r.view);
  }

  private async showInterviewRoom(sub: string, token: number): Promise<void> {
    this.current.destroy?.();
    this.shell.loadBar('hold');
    const [{ mountInterviewRoom }, data, css, body] = await Promise.all([
      import('./interview/interviewRoom'), import('@/content/site/interview.json'), import('@/content/site/interview.css?raw'), import('@/content/site/interview.body.html?raw'),
    ]);
    if (token !== this.nav) { this.shell.loadBar('done'); return; } // a newer navigation owns the page now
    document.documentElement.dataset['mode'] = 'iv'; document.documentElement.dataset['track'] = 'qual';
    (document.getElementById('hubroot') as HTMLElement).hidden = true;
    const host = document.getElementById('modroot') as HTMLElement; host.hidden = false; host.className = '';
    this.pageStyle.textContent = css.default;
    host.innerHTML = body.default; // build-time markup from the course content
    document.title = 'Interview Room · Agentic AI Mastery';
    const crumbs = () => {
      const tab = host.querySelector('#tabs [aria-selected="true"]')?.textContent?.trim();
      this.shell.setCrumbs([['Start', '⌂ Home', '#home'], ['Area', 'Practise', '#practise'], ['Tool', 'Interview Room', '#iv'], ['You are using', tab || 'Interview Room']], '#practise');
    };
    document.querySelectorAll('.gn-nav a').forEach((a) => { if ((a as HTMLElement).dataset['area'] === 'practise') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    (document.getElementById('gnBand') as HTMLElement).innerHTML = '';
    mountInterviewRoom(data.default, sub);
    crumbs();
    const tabs = host.querySelector('#tabs');
    if (tabs) new MutationObserver(crumbs).observe(tabs, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    this.current = { kind: 'iv', sub };
    this.shell.loadBar('done'); this.shell.enter(host); window.scrollTo(0, 0);
  }

  private async showModule(slug: string, sub: string, token: number): Promise<void> {
    const mod = this.progress.data.mods.find((x) => x.url === `#m-${slug}`);
    const load = moduleJson[`../../content/site/modules/${slug}.json`]; const loadCss = moduleCss[`../../content/site/modules/${slug}.css`];
    if (!mod || !load || !loadCss) { location.hash = 'home'; return; }
    this.current.destroy?.();
    this.shell.loadBar('hold');
    document.documentElement.dataset['mode'] = 'mod'; document.documentElement.dataset['track'] = mod.track;
    (document.getElementById('hubroot') as HTMLElement).hidden = true;
    const host = document.getElementById('modroot') as HTMLElement; host.hidden = false; host.className = '';
    host.innerHTML = '<p class="modload">Loading…</p>';
    this.shell.moduleCrumbs(mod, '');
    const [data, css] = await Promise.all([load(), loadCss()]);
    // Superseded while the content was loading. Everything below would fight the navigation that won:
    // overwrite its stylesheet, fill a hidden #modroot, and leave `current` naming a page nobody sees.
    if (token !== this.nav) { this.shell.loadBar('done'); return; }
    this.pageStyle.textContent = css;
    document.title = `${data.title} · Agentic AI Mastery`;
    host.innerHTML = '';
    const rail = document.createElement('aside'); rail.className = 'gn-rail'; rail.id = 'gnRail'; rail.setAttribute('aria-label', 'Section contents');
    const inner = document.createElement('div'); inner.style.minWidth = '0';
    host.append(rail, inner); host.classList.add('has-rail');
    const page = mountModulePage(inner, {
      data, hubUrl: '', assetBase: `${import.meta.env.BASE_URL}m/${slug}/`, playgrounds: this.playgrounds(slug), scenes: this.scenes(slug), initial: sub,
      onProgress: (r) => this.progress.setRollup(mod.n, r),
      onTechniqueChange: (id) => {
        try { history.replaceState(null, '', `#m-${slug}~${id}`); } catch { /* ignore */ }
        const name = document.querySelector('#modroot #tabs [aria-selected="true"]')?.textContent?.trim() ?? '';
        this.shell.moduleCrumbs(mod, name); this.shell.renderRail(mod);
      },
    });
    inner.appendChild(this.shell.prevNext(mod));
    this.current = { kind: 'mod', slug, destroy: page.destroy, show: page.show };
    this.shell.renderRail(mod);
    this.shell.loadBar('done'); this.shell.enter(host);
    if (!sub) window.scrollTo(0, 0);
  }
}
