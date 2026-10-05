/** Build pane: implementation steps, go-to library with runnable code, and tool cards with a prototype/production filter. */
import { $, $$, esc, html, trusted, type TrustedHtml } from '../html';
import type { Practice, Technique, ToolCard } from '../content';
import type { ModuleContext } from '../module/ModuleContext';

const dots = (n: number) => html`<span class="dots" aria-hidden="true">${[1, 2, 3].map((i) => html`<i class="${i <= n ? 'on' : ''}"></i>`)}</span>`;
const LEVEL = ['', 'Limited', 'Good', 'Strong'];
function verdictTag(x: ToolCard): string {
  if (x.tag) return x.tag;
  if (x.prod >= 3 && x.start >= 3) return 'Prototype and production';
  if (x.prod >= 3) return 'Production-grade';
  if (x.start >= 3) return 'Best for prototypes';
  return 'Learning and research';
}

/** Library card plus tabbed code samples; shared with the Practice section of older modules. */
export function codeRowHTML(p: Practice | undefined): TrustedHtml {
  if (!p) return html``;
  return html`<div class="p-row code-row">
      <div class="p-card"><h4>Go-to library</h4><div class="lib-name">${trusted(p.lib[0])}</div><p>${trusted(p.lib[1])}</p>
        ${p.lib[2] ? html`<div class="cmd"><code>${p.lib[2]}</code><button class="btn copy" type="button" data-copy="${p.lib[2]}">Copy</button></div>` : ''}
        <p class="code-note">${trusted(p.note || 'Minimal starting point. Check the library docs for current versions and options.')}</p></div>
      <div class="p-card code-card"><div class="code-bar"><div class="code-tabs" role="tablist" aria-label="Code examples">${p.code.map((c, i) => html`<button class="code-tab" type="button" role="tab" aria-selected="${i === 0}" data-i="${i}">${c[0]}</button>`)}</div><button class="btn copy-code" type="button">Copy code</button></div>${p.code.map((c, i) => html`<pre class="code"${i ? html` hidden` : ''} data-i="${i}"><code class="language-${c[1]}">${c[2]}</code></pre>`)}</div></div>`;
}

function toolsHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const X = ctx.data.play[t.id];
  if (!X) return html``;
  return html`<div class="quick">${X.quick.map((q) => html`<div><span>${trusted(q[0])}</span><b>${trusted(q[1])}</b></div>`)}</div>
    <div class="t-filter" role="group" aria-label="Filter tools"><span class="pl-note">Show:</span>
      <button class="btn tf" type="button" data-f="all" aria-pressed="true">All (${X.tools.length})</button>
      <button class="btn tf" type="button" data-f="proto" aria-pressed="false">Great for prototypes</button>
      <button class="btn tf" type="button" data-f="prod" aria-pressed="false">Production-ready</button></div>
    <div class="tcards">${X.tools.map((x) => html`<article class="tcard" data-start="${x.start}" data-prod="${x.prod}">
      <div class="tc-top"><div><h4>${trusted(x.n)}</h4><span class="tc-type">${trusted(x.type)}</span></div><span class="vtag">${verdictTag(x)}</span></div>
      <div class="grades"><div><span>Prototype</span>${dots(x.start)}<em>${LEVEL[x.start]}</em></div><div><span>Production</span>${dots(x.prod)}<em>${LEVEL[x.prod]}</em></div></div>
      <p class="tc-best">${trusted(x.best)}</p>
      <p class="tc-ex"><b>Example:</b> ${trusted(x.ex)}</p>
      <div class="tc-pc"><ul class="pro">${x.pros.map((p) => html`<li>${trusted(p)}</li>`)}</ul><ul class="con">${x.cons.map((p) => html`<li>${trusted(p)}</li>`)}</ul></div>
      <a class="tc-link" href="${x.url}" target="_blank" rel="noopener">Official site ↗</a></article>`)}</div>
    <p class="pl-note">Ratings compare tools for this technique: <b>Prototype</b> is how quickly you can get useful results; <b>Production</b> covers scale, team features, reliability and support.</p>`;
}

export function buildPaneHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  return html`<div class="blk"><h3>How to implement it</h3><ol class="steps">${t.steps.map((x) => html`<li><span>${trusted(x)}</span></li>`)}</ol></div>
    ${codeRowHTML(ctx.data.practice[t.id])}
    <div class="blk"><h3>Tools and libraries on the market</h3>${toolsHTML(t, ctx)}</div>`;
}

export function wireTools(root: HTMLElement): void {
  $$(root, '.tf').forEach((b) => b.addEventListener('click', () => {
    const f = b.dataset['f'];
    $$(root, '.tf').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $$(root, '.tcard').forEach((c) => { c.hidden = f === 'proto' ? Number(c.dataset['start']) < 3 : f === 'prod' ? Number(c.dataset['prod']) < 3 : false; });
  }));
}

export function copyText(text: string, btn: HTMLElement): void {
  const old = btn.textContent;
  navigator.clipboard?.writeText(text).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = old; }, 1400); }, () => {});
}

/** Code tabs and copy buttons inside any code row under `root`. */
export function wireCodeRows(root: HTMLElement): void {
  $$(root, '.code-row').forEach((row) => {
    $$(row, '.code-tab').forEach((b) => b.addEventListener('click', () => {
      $$(row, '.code-tab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      $$(row, 'pre.code').forEach((p) => { p.hidden = p.dataset['i'] !== b.dataset['i']; });
    }));
    $(row, '.copy-code')?.addEventListener('click', (e) => { const vis = $(row, 'pre.code:not([hidden]) code'); if (vis) copyText(vis.textContent ?? '', e.currentTarget as HTMLElement); });
  });
  $$(root, '.copy').forEach((b) => b.addEventListener('click', () => copyText(b.dataset['copy'] ?? '', b)));
  void esc;
}
