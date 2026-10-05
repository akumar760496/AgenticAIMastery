/** Play pane: scenario brief, presets with expected outcomes, the live playground, narration and missions. */
import { PlaygroundSession } from '@/application/PlaygroundSession';
import { $, $$, html, trusted, type TrustedHtml } from '../html';
import type { Technique } from '../content';
import type { ModuleContext } from '../module/ModuleContext';
import { mountLegacyPlayground } from '../playground/LegacyPlaygroundRenderer';

export function playPaneHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const X = ctx.data.play[t.id];
  if (!X) return html`<p class="pl-note">No playground for this technique.</p>`;
  return html`<div class="brief">
      <div class="brief-scn"><span class="eyebrow">The scenario</span><p>${trusted(X.scenario)}</p></div>
      <div class="brief-cols"><div><h4>What you control</h4><ul class="plain">${X.controls.map((c) => html`<li>${trusted(c)}</li>`)}</ul></div>
        <div><h4>What each result means</h4><dl class="defs">${X.outputs.map((o) => html`<div><dt>${trusted(o[0])}</dt><dd>${trusted(o[1])}</dd></div>`)}</dl></div></div>
    </div>
    <div class="presets"><span class="pl-note">Load a scenario:</span>${X.presets.map((p, i) => html`<button class="btn preset" type="button" data-k="${p.k}" aria-pressed="${i === 0}">${trusted(p.name)}</button>`)}</div>
    <div class="expect" id="pl-expect" aria-live="polite"><b>Expected outcome:</b> <span></span></div>
    <div class="play" id="play-root"></div>
    <div class="story"><span class="eyebrow">What’s happening</span><p id="pl-story" aria-live="polite"></p></div>
    <div class="missions"><div class="m-head"><h4>Missions</h4><span id="pl-mprog"></span></div>
      <ol>${X.missions.map((m) => html`<li data-k="${m.k}"><span class="m-box" aria-hidden="true"></span><div><p>${trusted(m.text)}</p><details><summary>Hint</summary><p>${trusted(m.hint)}</p></details></div></li>`)}</ol></div>`;
}

export function wirePlayPane(root: HTMLElement, t: Technique, ctx: ModuleContext): void {
  const X = ctx.data.play[t.id]; const def = ctx.playground(t.id); const host = $(root, '#play-root');
  if (!X || !host) return;
  if (!def) { host.innerHTML = '<p class="pl-note">This playground is being rebuilt.</p>'; return; }
  const session = new PlaygroundSession(def);
  const done = new Set<string>();
  const exp = $(root, '#pl-expect span') as HTMLElement; const story = $(root, '#pl-story') as HTMLElement; const prog = $(root, '#pl-mprog') as HTMLElement;
  const presetButtons = $$(root, '.preset');
  const setExpect = (k: string | null) => {
    const p = k ? X.presets.find((x) => x.k === k) : undefined;
    exp.textContent = p ? p.expect : 'Your own setup. Read “What’s happening” below for the result.';
    presetButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['k'] === k)));
  };
  const unmount = mountLegacyPlayground(host, def, session);
  const unsubscribe = session.subscribe((snap) => {
    story.textContent = snap.narrative;
    snap.completedMissions.forEach((m) => done.add(m));
    $$(root, '.missions li').forEach((li) => li.classList.toggle('done', done.has(li.dataset['k'] ?? '')));
    prog.textContent = `${done.size} of ${X.missions.length} complete${done.size === X.missions.length ? ' · well done!' : ''}`;
    setExpect(snap.activePreset);
  });
  presetButtons.forEach((b) => b.addEventListener('click', () => { const k = b.dataset['k']; if (k && def.presets[k]) session.applyPreset(k); }));
  ctx.onCleanup(() => { unsubscribe(); unmount(); });
}
