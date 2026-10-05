/**
 * Global chrome shared by every page: top navigation, theme toggle, "you are here" breadcrumbs,
 * section band, section-contents rail, previous/next module links and the page-load bar.
 */
import { $, esc, html, reducedMotion, setHtml, storage, type TrustedHtml } from '../html';
import type { HubProgress } from '../hub/HubProgress';
import type { HubModule, HubTrack } from '../content';

export type Crumb = readonly [label: string, name: string, href?: string, isSection?: boolean];

export function shellHTML(): TrustedHtml {
  return html`<header class="gn"><div class="gn-in">
    <a class="gn-brand" href="#home"><i aria-hidden="true"></i>Agentic AI Mastery</a>
    <nav class="gn-nav" aria-label="Main"><a href="#home" data-area="learn">Learn</a><a href="#review" data-area="review">Review</a><a href="#practise" data-area="practise">Practise</a><a href="#library" data-area="library">Library</a></nav>
    <button class="theme-tog" id="themeTog" type="button">Light mode</button>
  </div><div class="gn-crumb"><div class="gn-in"><button class="gn-back" type="button" id="gnBack" hidden>← Back</button><nav class="gn-jnav" aria-label="You are here"><ol class="gn-jr" id="gnBc"></ol></nav><div class="gn-band" id="gnBand"></div><a class="gn-home" href="#home">⌂ Home</a><button class="gn-sc" type="button" id="gnSc" aria-expanded="false" aria-controls="gnRail">Section contents</button></div></div><div class="gn-load" id="gnLoad" aria-hidden="true"></div></header>
<div id="modroot" hidden></div>
<div class="wrap" id="hubroot">
  <main id="view" aria-live="polite"></main>
  <!-- After #view on purpose: below 901px there is no rail, and this must then fall after the page
       content rather than before it, with focus order still matching what is on screen. -->
  <aside class="hub-rail" id="hubRail" aria-label="Your progress" hidden></aside>
  <footer><span>Agentic AI Mastery · 18 modules · 145 techniques</span><span id="status" class="status-line">Loading your progress…</span><button type="button" id="flip" hidden></button></footer>
</div>
<div class="toast" id="toast" hidden role="status"></div>`;
}

export class SiteShell {
  private ro: ResizeObserver | null = null;
  constructor(private readonly progress: HubProgress) {}

  private get data() { return this.progress.data; }
  private el(id: string): HTMLElement { return document.getElementById(id) as HTMLElement; }
  secLabel(t: HubTrack): string { return `Section · ${this.data.tracks.indexOf(t) + 1} of ${this.data.tracks.length}`; }

  /** `signal` lets the caller detach the document- and window-level listeners again, for hot reloads. */
  init(signal?: AbortSignal): void {
    const root = document.documentElement; const tog = this.el('themeTog');
    if (storage.get('aam-theme') === 'light') root.dataset['pageTheme'] = 'light';
    const label = () => { tog.textContent = root.dataset['pageTheme'] === 'light' ? 'Dark mode' : 'Light mode'; };
    label();
    tog.addEventListener('click', () => {
      const light = root.dataset['pageTheme'] !== 'light';
      if (light) root.dataset['pageTheme'] = 'light'; else delete root.dataset['pageTheme'];
      storage.set('aam-theme', light ? 'light' : 'dark'); label(); window.dispatchEvent(new Event('aam-theme'));
    });
    this.pinCrumb(); addEventListener('resize', () => this.pinCrumb(), { signal });
    try { this.ro = new ResizeObserver(() => this.pinCrumb()); this.ro.observe(document.querySelector('.gn') as Element); } catch { /* old browser */ }
    signal?.addEventListener('abort', () => { this.ro?.disconnect(); this.ro = null; });
    try { sessionStorage.setItem('aam-visits', String(Number(sessionStorage.getItem('aam-visits') ?? 0) + 1)); } catch { /* ignore */ }
    this.el('gnBack').addEventListener('click', () => {
      let v = 0; try { v = Number(sessionStorage.getItem('aam-visits')); } catch { /* ignore */ }
      if (v > 1 && history.length > 1) history.back(); else location.hash = (this.el('gnBack').dataset['parent'] ?? '#home').slice(1);
    });
    this.el('gnSc').addEventListener('click', () => {
      const r = document.getElementById('gnRail'); if (!r) return;
      const open = !r.classList.contains('open');
      if (open) r.style.top = `${Math.max(0, (document.querySelector('.gn') as HTMLElement).getBoundingClientRect().bottom)}px`;
      r.classList.toggle('open', open); this.el('gnSc').setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const tb = target.closest<HTMLElement>('.gn-rail [data-tab]');
      if (tb) { const b = document.querySelector<HTMLElement>(`#modroot #tabs .tab[data-id="${CSS.escape(tb.dataset['tab'] ?? '')}"]`); if (b) { b.click(); this.jumpTo(document.getElementById('tabs')); } this.closeRail(); return; }
      const jb = target.closest<HTMLElement>('.gn-rail [data-jump]');
      if (jb) { this.jumpTo(document.getElementById(jb.dataset['jump'] ?? '')); this.closeRail(); return; }
      if (target.closest('.gn-rail a')) this.closeRail();
    }, { signal });
  }

  setArea(area: 'learn' | 'review' | 'practise' | 'library', track?: string): void {
    document.documentElement.dataset['track'] = track || (area === 'review' ? 'found' : area === 'practise' ? 'qual' : area === 'library' ? 'retr' : 'found');
    document.querySelectorAll('.gn-nav a').forEach((a) => { if ((a as HTMLElement).dataset['area'] === area) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  setCrumbs(items: readonly Crumb[], parent = '#home'): void {
    setHtml(this.el('gnBc'), html`${items.map((it, i) => {
      const last = i === items.length - 1; const cls = [i === 0 ? 'home' : '', it[3] ? 'sec' : '', last ? 'cur' : ''].join(' ').trim();
      return html`<li class="${cls}"><small>${it[0]}</small>${last ? html`<span aria-current="page">${it[1]}</span>` : html`<a href="${it[2] ?? '#home'}">${it[1]}</a>`}</li>`;
    })}`);
    const b = this.el('gnBack'); b.hidden = items.length < 2; b.dataset['parent'] = parent;
  }

  hubCrumbs(h: string): void {
    document.documentElement.dataset['mode'] = 'hub'; setHtml(this.el('gnBand'), html``);
    const H: Crumb = ['Start', '⌂ Home', '#home'];
    const names: Record<string, string> = { review: 'Review', practise: 'Practise', library: 'Library', tracks: 'Course map' };
    if (h.startsWith('t-')) { const t = this.progress.TR(h.slice(2)); if (t) { this.setCrumbs([H, [this.secLabel(t).replace('Section · ', 'You are in · Section '), t.name, '', true]], '#home'); return; } }
    if (names[h]) { this.setCrumbs([H, ['You are in', names[h] as string]], '#home'); return; }
    this.setCrumbs([['You are here', '⌂ Home']], '#home');
  }

  moduleCrumbs(m: HubModule, current: string): void {
    document.documentElement.dataset['mode'] = 'mod';
    const t = this.progress.TR(m.track) as HubTrack; const idx = t.mods.indexOf(m.n);
    this.setCrumbs([['Start', '⌂ Home', '#home'], [this.secLabel(t), t.name, `#t-${t.id}`, true], [`Module · ${idx + 1} of ${t.mods.length}`, m.name, m.url], ['You are learning', current || m.name]], `#t-${t.id}`);
    setHtml(this.el('gnBand'), html`<span class="ic">${this.data.tracks.indexOf(t) + 1}</span><a href="#t-${t.id}"><small>You are in ${this.secLabel(t).replace('Section · ', 'section ')}</small><b>${t.name}</b></a>`);
    document.querySelectorAll('.gn-nav a').forEach((a) => { if ((a as HTMLElement).dataset['area'] === 'learn') a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  }

  renderRail(m: HubModule): void {
    const rail = document.getElementById('gnRail'); if (!rail) return;
    const t = this.progress.TR(m.track) as HubTrack; const ti = this.data.tracks.indexOf(t); const nt = this.data.tracks[ti + 1];
    const tabs = [...document.querySelectorAll<HTMLElement>('#modroot #tabs .tab')]; const curId = document.querySelector<HTMLElement>('#modroot #tabs [aria-selected="true"]')?.dataset['id'];
    setHtml(rail, html`<h4>Section ${ti + 1} · ${t.name}</h4>${t.mods.map((n, i) => {
      const x = this.progress.M(n); const st = this.progress.modStatus(n); const here = n === m.n;
      return html`<a class="${[here ? 'curm' : '', st.done ? 'done' : ''].join(' ')}" href="${x.url}"${here ? html` aria-current="page"` : ''}><i>${st.done ? '✓' : i + 1}</i>${x.name}</a>${here ? html`${tabs.map((b) => html`<button type="button" class="sub ${b.dataset['id'] === curId ? 'on' : ''}" data-tab="${b.dataset['id']}">${b.textContent?.trim()}</button>`)}${document.getElementById('band-h') ? html`<button type="button" class="sub" data-jump="band-h">Put it together</button>` : ''}${document.getElementById('quiz-h') ? html`<button type="button" class="sub" data-jump="quiz-h">Quiz</button>` : ''}${document.getElementById('glo-h') ? html`<button type="button" class="sub" data-jump="glo-h">Glossary</button>` : ''}` : ''}`;
    })}<hr><a class="nt" href="#t-${t.id}">← ${t.name} overview</a>${nt ? html`<a class="nt" href="#t-${nt.id}">Next section: ${nt.name} →</a>` : ''}`);
  }

  prevNext(m: HubModule): HTMLElement {
    const t = this.progress.TR(m.track) as HubTrack; const i = t.mods.indexOf(m.n); const ti = this.data.tracks.indexOf(t);
    const pv = i > 0 ? this.progress.M(t.mods[i - 1] as number) : null; const nx = i < t.mods.length - 1 ? this.progress.M(t.mods[i + 1] as number) : null; const nt = this.data.tracks[ti + 1];
    const L = pv ? html`<a href="${pv.url}"><small>← Previous in ${t.name}</small><b>${pv.name}</b></a>` : html`<a href="#t-${t.id}"><small>← Back to the track</small><b>${t.name} overview</b></a>`;
    const R = nx ? html`<a class="nx" href="${nx.url}"><small>Next in ${t.name} →</small><b>${nx.name}</b></a>`
      : nt ? html`<a class="nx" href="#t-${nt.id}"><small>Track done · next track →</small><b>${nt.name}</b></a>` : html`<a class="nx" href="#home"><small>Last module in the course →</small><b>Home</b></a>`;
    const n = document.createElement('nav'); n.className = 'gn-pn'; n.setAttribute('aria-label', 'Module navigation');
    setHtml(n, html`<span class="gn-pnh">${t.name} · Module ${i + 1} of ${t.mods.length}</span>${L}${R}`);
    return n;
  }

  loadBar(state: '' | 'hold' | 'run' | 'done'): void { const l = this.el('gnLoad'); l.className = 'gn-load'; void l.offsetWidth; if (state) l.classList.add(state); }
  enter(el: HTMLElement): void { el.classList.remove('gn-enter'); void el.offsetWidth; el.classList.add('gn-enter'); setTimeout(() => el.classList.remove('gn-enter'), 1100); }
  pinCrumb(): void {
    const g = document.querySelector<HTMLElement>('.gn'); const top = g?.querySelector<HTMLElement>('.gn-in'); if (!g || !top) return;
    const off = innerWidth <= 640 ? top.offsetHeight : 0; g.style.top = off ? `${-off}px` : '';
    document.documentElement.style.setProperty('--gnh', `${g.offsetHeight - off}px`);
  }
  jumpTo(el: Element | null): void {
    if (!el) return;
    const g = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--gnh')) || 100;
    window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - g - 12, behavior: reducedMotion() ? 'auto' : 'smooth' });
  }
  closeRail(): void { document.getElementById('gnRail')?.classList.remove('open'); this.el('gnSc').setAttribute('aria-expanded', 'false'); }
  toast(msg: string): void { const t = this.el('toast'); t.textContent = msg; t.hidden = false; setTimeout(() => { t.hidden = true; }, 4200); }
  setStatus(): void { (document.querySelector('#hubroot #status') as HTMLElement).textContent = this.progress.mode === 'db' ? 'Progress saved to your Claude account.' : 'Progress saved in this browser only.'; }
  view(): HTMLElement { return this.el('view'); }
}
export { $, esc };
