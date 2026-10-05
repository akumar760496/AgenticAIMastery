/** One technique, shown as six sub-tabs: Learn, Play, Build, Decide, Practice, Explain. */
import { $$, html, setHtml, trusted } from '../html';
import type { Technique } from '../content';
import type { ModuleContext } from '../module/ModuleContext';
import type { QuizEngine } from '../module/QuizEngine';
import { buildPaneHTML, wireCodeRows, wireTools } from './buildPane';
import { highlightBlocks } from './codeHighlight';
import { decidePaneHTML } from './decidePane';
import { explainPaneHTML, wireExplainPane } from './explainPane';
import { learnPaneHTML, wireLearnPane } from './learnPane';
import { playPaneHTML, wirePlayPane } from './playPane';
import { practicePaneHTML, wirePracticePane } from './practicePane';

export const PANES = [['learn', 'Learn'], ['play', 'Play'], ['build', 'Build'], ['decide', 'Decide'], ['practice', 'Practice'], ['explain', 'Explain']] as const;
export type PaneKey = (typeof PANES)[number][0];

export function renderTechniqueDetail(detail: HTMLElement, t: Technique, ctx: ModuleContext, quiz: QuizEngine, pane: { current: PaneKey }): void {
  const hasExplain = Boolean(ctx.data.cx);
  detail.classList.add('tabbed'); detail.setAttribute('aria-labelledby', `tab-${t.id}`);
  setHtml(detail, html`
  <div class="d-head"><span class="eyebrow">${t.short}</span><h2>${t.name}</h2><p class="ask">“${trusted(t.q)}”</p></div>
  <div class="subtabs" role="tablist" aria-label="${t.name} sections">${PANES.filter(([k]) => k !== 'explain' || hasExplain).map(([k, l]) => html`<button class="subtab" type="button" role="tab" id="st-${k}" aria-controls="pane-${k}" aria-selected="${k === pane.current}" data-p="${k}">${l}</button>`)}</div>
  <div class="pane" id="pane-learn" role="tabpanel" aria-labelledby="st-learn" data-p="learn">${learnPaneHTML(t, ctx)}</div>
  <div class="pane" id="pane-play" role="tabpanel" aria-labelledby="st-play" data-p="play">${playPaneHTML(t, ctx)}</div>
  <div class="pane" id="pane-build" role="tabpanel" aria-labelledby="st-build" data-p="build">${buildPaneHTML(t, ctx)}</div>
  <div class="pane" id="pane-decide" role="tabpanel" aria-labelledby="st-decide" data-p="decide">${decidePaneHTML(t, ctx)}</div>
  <div class="pane" id="pane-practice" role="tabpanel" aria-labelledby="st-practice" data-p="practice">${practicePaneHTML(t, ctx)}</div>
  ${hasExplain ? html`<div class="pane" id="pane-explain" role="tabpanel" aria-labelledby="st-explain" data-p="explain">${explainPaneHTML(t)}</div>` : ''}`);

  const lesson = wireLearnPane(detail, t, ctx);
  ctx.onCleanup(lesson.stop);
  const show = (k: PaneKey) => {
    pane.current = k;
    $$(detail, '.subtab').forEach((b) => { const on = b.dataset['p'] === k; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    $$(detail, '.pane').forEach((p) => { p.hidden = p.dataset['p'] !== k; });
    if (k !== 'learn') lesson.stop();
  };
  const tabs = $$(detail, '.subtab');
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => show(b.dataset['p'] as PaneKey));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault(); const n = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length]!; show(n.dataset['p'] as PaneKey); n.focus();
    });
  });
  show(hasExplain || pane.current !== 'explain' ? pane.current : 'learn');
  wirePlayPane(detail, t, ctx); wireTools(detail); wireCodeRows(detail); highlightBlocks(detail);
  wirePracticePane(detail, t, ctx, quiz);
  if (hasExplain) wireExplainPane(detail, t, ctx);
  ['pane-learn', 'pane-decide', 'pane-build'].forEach((id) => ctx.glossify(detail.querySelector(`#${id}`)));
}
