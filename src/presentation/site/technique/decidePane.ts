/** Decide pane: pros and cons, when to use or avoid, a real-world case, industries and pitfalls. */
import { html, trusted, type TrustedHtml } from '../html';
import type { Technique } from '../content';
import type { ModuleContext } from '../module/ModuleContext';

export function decidePaneHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const D = ctx.data.decide[t.id]; const p = ctx.data.practice[t.id];
  const list = (xs: readonly string[] | undefined) => (xs ?? []).map((x) => html`<li>${trusted(x)}</li>`);
  return html`<div class="p-row eq"><div class="p-card pc pro"><h4>Pros</h4><ul>${list(D?.pros)}</ul></div><div class="p-card pc con"><h4>Cons</h4><ul>${list(D?.cons)}</ul></div></div>
    <div class="p-row eq"><div class="p-card"><h4>Use it when</h4><ul class="plain">${list(t.use)}</ul></div><div class="p-card"><h4>Choose something else when</h4><ul class="plain warn">${list(D?.avoid)}</ul></div></div>
    ${p ? html`<div class="p-row"><div class="p-card"><h4>Real-world use case</h4><p>${trusted(p.sc)}</p></div><div class="p-card analogy"><h4>Think of it like</h4><p>${trusted(p.an)}</p></div></div>
    <div class="p-card"><h4>Where industry uses it</h4><div class="ind">${p.ind.map((x) => html`<div><b>${trusted(x[0])}</b><span>${trusted(x[1])}</span></div>`)}</div></div>` : ''}
    <div class="p-card"><h4>Watch out for</h4><ul class="plain warn">${list(t.pitfalls)}</ul></div>`;
}
