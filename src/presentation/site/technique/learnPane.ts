/** Learn pane: at-a-glance GIF, step-by-step animated lesson with highlighted code, key metrics, remember box and diagram. */
import { $, $$, esc, html, reducedMotion, storage, trusted, type TrustedHtml } from '../html';
import type { Technique } from '../content';
import type { ModuleContext } from '../module/ModuleContext';
import { highlightLine } from './codeHighlight';
import { mountSx } from '../sx/SxPlayer';

let glancePlaying = !reducedMotion();
const glanceDark = (): boolean => document.documentElement.dataset['pageTheme'] !== 'light';

function glanceHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const alt = ctx.data.gifs?.[t.id];
  if (!alt) return html``;
  return html`<figure class="glance" id="glance"><div class="glance-media"><img id="glance-img" width="800" height="450" alt="Animated summary of ${t.name}. ${alt}"></div>
    <figcaption><span><b>At a glance</b><span class="pl-note"> · an 8-second loop of the whole technique</span></span>
      <span class="glance-ctl"><button class="btn mini" type="button" id="glance-play"></button><button class="btn mini" type="button" id="glance-dl">Download GIF</button></span></figcaption>
    <p class="pl-note glance-msg" id="glance-msg" aria-live="polite"></p></figure>`;
}

function lessonHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const L = ctx.data.lessons[t.id];
  if (!L) return html``;
  const hasPred = Boolean(ctx.data.cx?.pred?.[t.id]);
  return html`<div class="lesson">
    <div class="l-stage">
      <div class="l-fig" id="l-svg"></div>
      <div class="l-side">
        <div class="l-pred" id="l-pred" hidden aria-live="polite"></div>
        <div class="l-narr" id="l-narr" aria-live="polite"><span class="eyebrow" id="l-count"></span><h4 id="l-title"></h4><p id="l-text"></p><div class="l-fb" id="l-fb" hidden></div></div>
        <div class="l-bottom" id="l-bottom">
          <div class="l-ctrl"><button class="btn" type="button" id="l-prev">← Back</button><button class="btn primary" type="button" id="l-play">▶ Play</button><button class="btn" type="button" id="l-next">Next →</button></div>
          ${hasPred ? html`<div class="l-opts"><label class="tog"><input type="checkbox" id="l-predict" checked> Predict before each step</label><span class="pl-note" id="l-pscore"></span></div>` : ''}
          <div class="l-dots" role="tablist" aria-label="Lesson steps">${L.steps.map((s, i) => html`<button type="button" class="l-dot" data-k="${i + 1}" aria-label="Step ${i + 1}: ${s[0]}"></button>`)}</div>
        </div>
      </div>
    </div>
    <div class="p-card code-card"><div class="code-bar"><span class="l-file">${L.file}</span><span class="l-hint">Highlighted lines implement this step</span></div><pre class="code l-code"><code id="l-code"></code></pre></div>
  </div>`;
}

export function learnPaneHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  return html`<p class="d-what">${trusted(t.what)}</p>
    ${glanceHTML(t, ctx)}
    ${ctx.scene(t.id) ? html`<div class="blk"><h3>See it run</h3><div id="sx-root"></div></div>` : ''}
    <div class="blk"><h3>${ctx.scene(t.id) ? 'Code walkthrough' : 'Animated walkthrough'}</h3>${lessonHTML(t, ctx)}</div>
    <div class="p-row"><div class="blk"><h3>${trusted(t.mLabel)}</h3><dl class="metrics">${t.metrics.map((m) => html`<div><dt>${trusted(m[0])}</dt><dd>${trusted(m[1])}</dd></div>`)}</dl></div>
      <div class="blk"><div class="remember"><b>Remember</b><p>${trusted(t.remember)}</p></div>
      <figure class="fig" style="margin:0"><div class="fig-top"><span>Diagram</span><button class="btn" type="button" id="replay">↻ Replay</button></div><div id="diag">${trusted(ctx.data.diagrams[t.id])}</div><figcaption>${trusted(t.cap)}</figcaption></figure></div></div>`;
}

export function wireLearnPane(root: HTMLElement, t: Technique, ctx: ModuleContext): { stop: () => void } {
  const diag = $(root, '#diag');
  $(root, '#replay')?.addEventListener('click', () => { if (diag) diag.innerHTML = ctx.data.diagrams[t.id] ?? ''; });
  wireGlance(root, t, ctx);
  const scene = ctx.scene(t.id); const sxRoot = $(root, '#sx-root');
  if (scene && sxRoot) { const sx = mountSx(sxRoot, scene, t.id); ctx.onCleanup(sx.kill); }
  return wireLesson(root, t, ctx);
}

function wireLesson(root: HTMLElement, t: Technique, ctx: ModuleContext): { stop: () => void } {
  const L = ctx.data.lessons[t.id];
  const noop = { stop: () => {} };
  if (!L) return noop;
  const N = L.steps.length; const PR = ctx.data.cx?.pred?.[t.id] ?? null;
  let k = 1; const answers: Record<number, number> = {}; let timer: ReturnType<typeof setInterval> | null = null;
  const lines = L.code.split('\n').map((raw) => { const m = raw.match(/\s*#@([\d,]+)\s*$/); return { txt: m ? raw.slice(0, m.index) : raw, steps: m ? (m[1] ?? '').split(',').map(Number) : [] }; });
  const codeEl = $(root, '#l-code') as HTMLElement; const pre = codeEl.parentElement as HTMLElement;
  codeEl.innerHTML = lines.map((l, i) => `<span class="cl" data-i="${i}"><span class="lnum">${i + 1}</span>${(highlightLine(l.txt, L.lang) ?? esc(l.txt)) || ' '}</span>`).join('');
  const playBtn = $(root, '#l-play') as HTMLButtonElement; const predBox = $(root, '#l-pred') as HTMLElement; const narr = $(root, '#l-narr') as HTMLElement;
  const fb = $(root, '#l-fb') as HTMLElement; const pscore = $(root, '#l-pscore'); const ptog = $<HTMLInputElement>(root, '#l-predict');
  const predictOn = () => Boolean(PR && ptog?.checked);
  const stop = () => { if (timer) clearInterval(timer); timer = null; playBtn.textContent = '▶ Play'; };
  const score = () => {
    if (!pscore || !PR) return;
    const n = Object.keys(answers).length; const c = Object.entries(answers).filter(([s, v]) => PR[s] && v === PR[s][2]).length;
    pscore.textContent = n ? `Predictions: ${c} of ${n} correct` : '';
  };
  function draw(): void {
    const step = L!.steps[k - 1] ?? ['', ''];
    ($(root, '#l-svg') as HTMLElement).innerHTML = `<svg viewBox="0 0 360 ${L!.h}" role="img" aria-label="Step ${k}: ${esc(step[0])}">${L!.frames[k - 1] ?? ''}</svg>`;
    predBox.hidden = true; narr.hidden = false; ($(root, '#l-bottom') as HTMLElement).hidden = false;
    ($(root, '#l-count') as HTMLElement).textContent = `Step ${k} of ${N}`;
    ($(root, '#l-title') as HTMLElement).textContent = step[0];
    ($(root, '#l-text') as HTMLElement).textContent = step[1];
    const p = PR?.[String(k)];
    if (p && k in answers) { const ok = answers[k] === p[2]; fb.hidden = false; fb.className = `l-fb ${ok ? 'ok' : 'no'}`; fb.innerHTML = `<b>${ok ? '✓ You predicted correctly.' : '✗ Not quite.'}</b> ${p[3]}`; } else fb.hidden = true;
    $$(root, '.l-dot').forEach((d) => { const n = Number(d.dataset['k']); d.classList.toggle('on', n === k); d.classList.toggle('done', n < k); d.setAttribute('aria-current', n === k ? 'step' : 'false'); });
    let first: HTMLElement | null = null;
    $$(codeEl, '.cl').forEach((el) => { const on = lines[Number(el.dataset['i'])]?.steps.includes(k) ?? false; el.classList.toggle('on', on); if (on && !first) first = el; });
    if (first) { const top = (first as HTMLElement).offsetTop - pre.offsetTop - 24; pre.scrollTo?.({ top: Math.max(0, top), behavior: reducedMotion() ? 'auto' : 'smooth' }); }
    ($(root, '#l-prev') as HTMLButtonElement).disabled = k === 1; ($(root, '#l-next') as HTMLButtonElement).disabled = k === N;
    ctx.glossify(narr); score();
  }
  function askPredict(n: number): void {
    stop(); const p = PR?.[String(n)]; if (!p) return;
    narr.hidden = true; ($(root, '#l-bottom') as HTMLElement).hidden = true; predBox.hidden = false;
    let h = 0; for (const c of p[0]) h = (h * 31 + c.charCodeAt(0)) | 0;
    const order = (h >>> 3) & 1 ? [1, 0] : [0, 1];
    predBox.innerHTML = `<span class="eyebrow">Predict step ${n} of ${N}</span><h4>What happens next?</h4><p>${p[0]}</p>
      <div class="l-popts">${order.map((i, j) => `<button class="btn l-popt" type="button" data-i="${i}"><span class="k">${'AB'[j]}</span>${p[1][i]}</button>`).join('')}</div>
      <button class="btn link-btn" type="button" id="l-skip">Skip prediction</button>`;
    $$(predBox, '.l-popt').forEach((b) => b.addEventListener('click', () => { answers[n] = Number(b.dataset['i']); k = n; draw(); ($(root, '#l-next') as HTMLElement).focus(); }));
    $(predBox, '#l-skip')?.addEventListener('click', () => { k = n; draw(); });
    $(predBox, '.l-popt')?.focus();
  }
  function go(n: number): void {
    if (n < 1 || n > N) return;
    if (n === k + 1 && predictOn() && PR?.[String(n)] && !(n in answers)) { askPredict(n); return; }
    k = n; draw();
  }
  $(root, '#l-prev')?.addEventListener('click', () => { stop(); go(k - 1); });
  $(root, '#l-next')?.addEventListener('click', () => { stop(); go(k + 1); });
  $$(root, '.l-dot').forEach((d) => d.addEventListener('click', () => { stop(); go(Number(d.dataset['k'])); }));
  playBtn.addEventListener('click', () => {
    if (timer) { stop(); return; }
    if (k === N) { k = 1; draw(); }
    playBtn.textContent = '❚❚ Pause';
    timer = setInterval(() => { if (k < N) go(k + 1); if (k === N) stop(); }, 4800);
  });
  draw();
  return { stop };
}

function wireGlance(root: HTMLElement, t: Technique, ctx: ModuleContext): void {
  const img = $<HTMLImageElement>(root, '#glance-img');
  const gifs = ctx.data.gifs;
  if (!img || !gifs) return;
  const media = img.parentElement as HTMLElement; const keys = Object.keys(gifs); const gi = keys.indexOf(t.id); const gn = keys.length;
  const base = () => `${ctx.assetBase}gif/${t.id}${glanceDark() ? '-dark' : ''}`;
  media.setAttribute('role', 'img'); media.setAttribute('aria-label', img.alt); img.setAttribute('aria-hidden', 'true');
  const set = () => {
    if (!document.body.contains(img)) return;
    if (glancePlaying) { media.style.backgroundImage = ''; img.hidden = false; img.src = `${base()}.gif`; }
    else {
      img.hidden = true; img.removeAttribute('src');
      media.style.backgroundImage = `url(${ctx.assetBase}gif/stills${glanceDark() ? '-dark' : ''}.webp)`;
      media.style.backgroundSize = `100% ${gn * 100}%`; media.style.backgroundRepeat = 'no-repeat';
      media.style.backgroundPosition = `0 ${gn > 1 ? (gi / (gn - 1)) * 100 : 0}%`;
    }
    const b = $(root, '#glance-play'); if (b) { b.textContent = glancePlaying ? 'Pause' : 'Play'; b.setAttribute('aria-pressed', String(!glancePlaying)); }
  };
  set();
  window.addEventListener('aam-theme', set);
  ctx.onCleanup(() => window.removeEventListener('aam-theme', set));
  $(root, '#glance-play')?.addEventListener('click', () => { glancePlaying = !glancePlaying; storage.set('aam-glance', glancePlaying ? '1' : '0'); set(); });
  $(root, '#glance-dl')?.addEventListener('click', () => { window.open(`${base()}.gif`, '_blank', 'noopener'); });
}
