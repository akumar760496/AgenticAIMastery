/**
 * Renders any declarative PlaygroundDefinition with the course's playground markup
 * (.pl-grid / .pl-in / .pl-out, .pl-btns selects, .togs toggles, .rng sliders, meter rows, .kv rows, verdicts).
 * Strategy per control and output kind, so new kinds plug in without touching the shell.
 */
import type { ControlSpec, OutputSpec, PlaygroundDefinition } from '@/domain/playground/PlaygroundDefinition';
import type { PlaygroundSession, PlaygroundSnapshot } from '@/application/PlaygroundSession';
import { $$, esc, html, join, meterRow, setHtml, tick, type TrustedHtml } from '../html';

let seq = 0;
const uid = (p: string) => `${p}-${++seq}`;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const read = (state: unknown, key: string): any => (state as Record<string, unknown>)[key];

function controlHTML<S>(spec: ControlSpec<S>, state: S, id: string): TrustedHtml {
  switch (spec.kind) {
    case 'select': {
      const cur = read(state, spec.key);
      return html`<div class="pl-btns"><label class="sel" for="${id}">${spec.label}</label><select id="${id}" data-key="${spec.key}" data-num="${typeof cur === 'number' ? '1' : ''}">${spec.options.map((o) => html`<option value="${o.value}"${String(cur) === o.value ? html` selected` : ''}>${o.label}</option>`)}</select></div>`;
    }
    case 'choice': {
      const cur = read(state, spec.key);
      return html`<div class="pl-btns" role="group" aria-label="${spec.label}"><span class="sel">${spec.label}</span>${spec.options.map((o) => html`<button class="btn" type="button" data-choice="${spec.key}" data-value="${o.value}" aria-pressed="${cur === o.value}">${o.label}</button>`)}</div>`;
    }
    case 'steps': {
      const v = read(state, spec.key) as number; const i = Math.max(0, spec.values.indexOf(v));
      return html`<label class="rng" for="${id}">${spec.label} <b>${spec.format(v)}</b></label><input type="range" id="${id}" data-steps="${spec.key}" min="0" max="${spec.values.length - 1}" step="1" value="${i}">`;
    }
    case 'toggle': {
      const enabled = spec.isEnabled ? spec.isEnabled(state) : true;
      return html`<label class="tog"><input type="checkbox" data-toggle="${spec.key}"${read(state, spec.key) ? html` checked` : ''}${enabled ? '' : html` disabled`}> ${spec.label}</label>`;
    }
    case 'flagSet': {
      const flags = read(state, spec.key) as Record<string, boolean>;
      return html`<p class="pl-note">${spec.label}</p><div class="togs">${spec.options.map((o) => html`<label class="tog"><input type="checkbox" data-flag="${spec.key}" data-value="${o.value}"${flags[o.value] ? html` checked` : ''}> ${o.label}</label>`)}</div>`;
    }
    case 'booleanGrid': {
      const grid = read(state, spec.key) as boolean[][]; const cols = grid[0]?.length ?? 0;
      return html`<table class="cells"><thead><tr><th></th>${Array.from({ length: cols }, (_, c) => html`<th>${spec.columnLabel(c)}</th>`)}</tr></thead><tbody>${grid.map((row, r) => html`<tr><th>${spec.rowLabel(r)}</th>${row.map((cell, c) => html`<td><button class="cell ${cell ? 'ok' : 'no'}" type="button" data-grid="${spec.key}" data-r="${r}" data-c="${c}" aria-label="${spec.rowLabel(r)}, ${spec.columnLabel(c).toLowerCase()}: ${cell ? 'pass' : 'fail'}. Click to flip.">${cell ? '✓' : '✗'}</button></td>`)}</tr>`)}</tbody></table>`;
    }
    case 'sequence': {
      const calls = read(state, spec.key) as string[]; const ref = spec.reference ?? [];
      return html`<p class="pl-note">${spec.label}</p><div class="seq">${calls.length ? calls.map((c, i) => html`<span class="sq ${ref.includes(c) && calls.indexOf(c) === i ? 'ref' : 'w'}">${i + 1}. ${c}</span>`) : html`<span class="pl-note">Empty. Add a tool call.</span>`}</div>
        <div class="pl-btns">${spec.palette.map((tool) => html`<button class="btn" type="button" data-seq="${spec.key}" data-add="${tool}"${calls.length >= spec.maxLength ? html` disabled` : ''}>+ ${tool}</button>`)}<button class="btn" type="button" data-seq="${spec.key}" data-undo="1"${calls.length ? '' : html` disabled`}>Undo</button></div>`;
    }
    case 'note': return html`<p class="pl-note">${spec.text}</p>`;
  }
}

function outputHTML<R>(spec: OutputSpec<R>, r: R): TrustedHtml {
  switch (spec.kind) {
    case 'meter': { const warn = spec.emphasis?.(r) === 'warn'; return meterRow(spec.label, spec.value(r), spec.detail?.(r) ?? '', warn ? 'warn' : ''); }
    case 'value': { const warn = spec.emphasis?.(r) === 'warn'; const d = spec.detail?.(r); return html`<div class="kv"><span>${spec.label}</span><b class="${warn ? 't-no' : ''}">${spec.value(r)}</b></div>${d ? html`<small class="mf">${d}</small>` : ''}`; }
    case 'check': { const d = spec.detail?.(r); return html`<div class="kv"><span>${spec.label}</span>${tick(spec.value(r))}</div>${d ? html`<small class="mf">${d}</small>` : ''}`; }
    case 'badges': return html`<div class="chips">${spec.items(r).map((b) => html`<span class="chip ${b.emphasis === 'warn' ? 'warn' : ''}">${b.text}</span>`)}</div>`;
    case 'code': return html`<p class="pl-note">${spec.label}</p><pre class="p5-plan">${spec.value(r)}</pre>`;
    case 'itemList': return html`<h4 class="pl-h">${spec.title}</h4><div class="items">${spec.items(r).map((it) => html`<div class="item ${it.tone} ${it.flagged ? 'flag' : ''}"><div class="kv"><span><b>${it.label}</b> ${it.text}</span><b class="${it.tone === 'no' ? 't-no' : it.tone === 'ok' ? 't-ok' : ''}">${it.status}</b></div>${it.detail ? html`<small class="mf">${it.detail}</small>` : ''}</div>`)}</div>`;
    case 'table': return html`<div class="tbl-wrap"><table class="pl-t"><thead><tr>${spec.columns.map((c) => html`<th>${c}</th>`)}</tr></thead><tbody>${spec.rows(r).map((row, i) => html`<tr class="${spec.highlightFirstRow && i === 0 ? 'on' : ''}">${row.map((c, j) => (j === 0 ? html`<th scope="row">${c}</th>` : html`<td>${c}</td>`))}</tr>`)}</tbody></table></div>`;
  }
}

/** Groups consecutive toggles into one .togs block, as the course pages do. */
function controlsHTML<S>(def: PlaygroundDefinition<S, unknown>, state: S): TrustedHtml {
  const parts: TrustedHtml[] = []; let togs: TrustedHtml[] = [];
  const flush = () => { if (togs.length) { parts.push(html`<div class="togs">${togs}</div>`); togs = []; } };
  def.controls.forEach((spec, i) => {
    const h = controlHTML(spec, state, `plc-${i}`);
    if (spec.kind === 'toggle') togs.push(h); else { flush(); parts.push(h); }
  });
  flush();
  return join(parts);
}

/** Mounts the playground into `root` and keeps it in sync with the session. */
export function mountLegacyPlayground<S, R>(root: HTMLElement, def: PlaygroundDefinition<S, R>, session: PlaygroundSession<S, R>): () => void {
  const prefix = uid('pl');
  setHtml(root, html`<div class="pl-grid"><div class="pl-in" id="${prefix}-in"></div><div class="pl-out" id="${prefix}-out"></div></div>`);
  const inEl = root.querySelector(`#${prefix}-in`) as HTMLElement; const outEl = root.querySelector(`#${prefix}-out`) as HTMLElement;
  const write = (key: string, value: unknown) => session.update(key as keyof S, value as S[keyof S]);
  const render = (snap: PlaygroundSnapshot<S, R>) => {
    const focusId = (document.activeElement as HTMLElement | null)?.id;
    setHtml(inEl, html`<h4 class="pl-h">${def.title}</h4><p class="pl-note">${def.intro}</p>${controlsHTML(def as PlaygroundDefinition<S, unknown>, snap.state)}`);
    const v = snap.verdict;
    setHtml(outEl, html`${join(def.outputs.map((o) => outputHTML(o, snap.result)))}<div class="verdict ${v.tone}"><b>${v.headline}</b> ${v.detail}</div>`);
    if (focusId) document.getElementById(focusId)?.focus();
  };
  inEl.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    if (t instanceof HTMLSelectElement && t.dataset['key']) write(t.dataset['key'], t.dataset['num'] ? Number(t.value) : t.value);
    else if (t instanceof HTMLInputElement && t.dataset['toggle']) write(t.dataset['toggle'], t.checked);
    else if (t instanceof HTMLInputElement && t.dataset['flag']) {
      const key = t.dataset['flag']; write(key, { ...(read(session.snapshot.state, key) as object), [t.dataset['value'] as string]: t.checked });
    }
  });
  inEl.addEventListener('input', (e) => {
    const t = e.target as HTMLInputElement; const key = t.dataset['steps'];
    if (!key) return;
    const spec = def.controls.find((c) => c.kind === 'steps' && c.key === key);
    if (spec && spec.kind === 'steps') write(key, spec.values[Number(t.value)]);
  });
  inEl.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button'); if (!b) return;
    const state = session.snapshot.state;
    if (b.dataset['choice']) write(b.dataset['choice'], b.dataset['value']);
    else if (b.dataset['grid']) {
      const key = b.dataset['grid']; const r = Number(b.dataset['r']); const c = Number(b.dataset['c']);
      write(key, (read(state, key) as boolean[][]).map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? !cell : cell))));
    } else if (b.dataset['seq']) {
      const key = b.dataset['seq']; const calls = read(state, key) as string[];
      write(key, b.dataset['undo'] ? calls.slice(0, -1) : [...calls, b.dataset['add']]);
    }
  });
  const unsubscribe = session.subscribe(render);
  void $$; void esc;
  return unsubscribe;
}
