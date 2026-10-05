/**
 * "See it run": step-through system animations. A scene declares nodes, links, toggles and meters; its build()
 * returns the steps for the current toggles. Each step lights nodes, flies a packet along links, adds to the
 * meters and trace, and may ask the learner to predict what happens next.
 */
import { reducedMotion } from '../html';

export interface SxNode { id: string; kind: string; x: number; y: number; w: number; h: number; label: string; sub?: string; hidden?: boolean; dim?: boolean }
export interface SxLink { id: string; kind?: string; d: string; label?: string; lx?: number; ly?: number; hidden?: boolean }
export interface SxToggle { id: string; label: string; brk?: boolean; def?: boolean; excl?: string[] }
export interface SxStep {
  cap: string; on?: string[]; path?: string[]; par?: string[]; tr?: [string, string][]; ctx?: number; ctxSet?: number; call?: number; loop?: number;
  tok?: number; inr?: number; ms?: number; show?: string[]; hide?: string[]; sub?: Record<string, string>; mark?: Record<string, string>;
  predict?: { q: string; opts: string[]; ok: number; why: string }; ok?: boolean; bad?: boolean;
}
export interface SxScene {
  intro?: string; note?: string; alt?: string; nodes: SxNode[]; links: SxLink[]; toggles?: SxToggle[]; meters?: string[];
  ctx?: { max: number; label?: string } | null; rate?: number; hot?: Record<string, number>; build: (opts: Record<string, boolean>) => SxStep[];
}

const E = (s: unknown) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const LBL: Record<string, string> = { calls: 'Calls', loops: 'Loops', tok: 'Tokens', inr: 'Cost', ms: 'Time' };
const LEG: [string, string][] = [['model', 'Model'], ['tool', 'Tool'], ['mem', 'Result / memory'], ['check', 'Checker / guardrail'], ['code', 'Your code'], ['human', 'Human'], ['user', 'Customer']];
function shape(n: SxNode): string {
  const { x, y, w, h } = n;
  if (n.kind === 'tool') return `<path class="sx-shape" d="M${x + 12},${y} h${w - 24} l12,${h / 2} l-12,${h / 2} h-${w - 24} l-12,-${h / 2} z"/>`;
  const rx = n.kind === 'user' || n.kind === 'human' ? h / 2 : n.kind === 'code' ? 3 : n.kind === 'thought' ? 8 : 12;
  return `<rect class="sx-shape" x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
}
function nodeSVG(n: SxNode): string {
  const cx = n.x + n.w / 2; const two = n.sub !== undefined; const ty = n.y + n.h / 2 + (two ? -2 : 5);
  return `<g class="sx-node k-${n.kind}${n.dim ? ' dim' : ''}" id="sxn-${n.id}">${shape(n)}<text class="sx-t" x="${cx}" y="${ty}">${E(n.label)}</text>${two ? `<text class="sx-s" id="sxs-${n.id}" x="${cx}" y="${ty + 16}">${E(n.sub)}</text>` : ''}</g>`;
}
const linkSVG = (l: SxLink) => `<path class="sx-link k-${l.kind || 'model'}" id="sxl-${l.id}" d="${l.d}" marker-end="url(#sx-ah)"/>${l.label ? `<text class="sx-lbl" id="sxb-${l.id}" x="${l.lx}" y="${l.ly}">${E(l.label)}</text>` : ''}`;
function fmtMs(ms: number): string { const s = ms / 1000; if (s < 60) return `${s.toFixed(1)}s`; if (s < 3600) return `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s`; return `${Math.floor(s / 3600)}h ${String(Math.round((s % 3600) / 60)).padStart(2, '0')}m`; }
const fmtN = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Mounts a scene into `root`. Returns a handle to stop timers, speech and animation. */
export function mountSx(root: HTMLElement, S: SxScene, sid: string): { kill: () => void } {
  const Q = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel) as T;
  const QA = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];
  const meters = S.meters || ['calls', 'tok', 'inr', 'ms']; const rate = S.rate || 0.3; const hot = S.hot || {}; const togs = S.toggles || [];
  root.innerHTML = `<div class="sx" tabindex="-1">
    ${S.intro ? `<p class="sx-intro">${S.intro}</p>` : ''}
    <div class="sx-bar">${togs.map((t) => `<label class="sx-sw${t.brk ? ' brk' : ''}"><input type="checkbox" data-tog="${t.id}"${t.def ? ' checked' : ''}>${E(t.label)}</label>`).join('')}
      <span class="sx-grow"></span><label class="sx-sw"><input type="checkbox" data-voice>Read aloud</label></div>
    <div class="sx-main">
      <div class="sx-stage"><span class="sx-swipe">Swipe the diagram sideways to see all of it.</span>
        <svg viewBox="0 0 640 360" role="img" aria-label="${E(S.alt || 'Diagram of the parts involved and the path the current step takes')}">
          <defs><marker id="sx-ah" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="sx-arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>
          ${S.links.map(linkSVG).join('')}${S.nodes.map(nodeSVG).join('')}
          <circle class="sx-pk" r="7" cx="-40" cy="-40"/><circle class="sx-pk" r="7" cx="-40" cy="-40"/><circle class="sx-pk" r="7" cx="-40" cy="-40"/>
        </svg></div>
      <div class="sx-side">
        <div class="sx-meters">${meters.map((m) => `<div class="sx-m" data-m="${m}"><small>${LBL[m]}</small><b>0</b></div>`).join('')}</div>
        ${S.ctx ? `<div class="sx-ctx"><small><span>${E(S.ctx.label || 'Context window')}</span><span class="sx-ctxv"></span></small><div class="sx-bar2"><i></i></div></div>` : ''}
        <div class="sx-trace" aria-live="polite" aria-label="Trace"></div>
      </div>
    </div>
    <div class="sx-foot">
      <div class="sx-cap" aria-live="polite"></div>
      <div class="sx-predbox" hidden></div>
      <div class="sx-ctrls"><button class="btn" type="button" data-a="prev">← Back</button><button class="btn primary" type="button" data-a="play">▶ Play</button><button class="btn" type="button" data-a="next">Next →</button><button class="btn" type="button" data-a="restart">↺ Restart</button><span class="sx-kbd">Keys: ← → and Space</span><div class="sx-dots" aria-label="Steps"></div></div>
    </div>
    <div class="sx-legend" aria-label="Shape and colour key, the same in every module">${LEG.map(([k, l]) => `<span style="--c:var(--k-${k})"><i style="${k === 'user' || k === 'human' ? 'border-radius:7px' : k === 'code' ? 'border-radius:1px;border-style:dashed' : ''}"></i>${l}</span>`).join('')}</div>
    ${S.note ? `<p class="sx-note">${S.note}</p>` : ''}
  </div>`;
  const pk = QA<SVGCircleElement>('.sx-pk');
  let steps: SxStep[] = []; let cur = -1; let playing = false; let timer: ReturnType<typeof setTimeout> | undefined; let busy = 0; let answered: Record<number, boolean> = {}; let alive = true;
  const opts = () => { const o: Record<string, boolean> = {}; QA<HTMLInputElement>('[data-tog]').forEach((i) => { o[i.dataset['tog'] as string] = i.checked; }); return o; };
  const broken = () => togs.some((t) => t.brk && Q<HTMLInputElement>(`[data-tog="${t.id}"]`).checked);

  function fold(upto: number) {
    const st = { calls: 0, loops: 0, tok: 0, inr: 0, ms: 0, ctx: 0, trace: [] as [string, string][], show: {} as Record<string, boolean>, sub: {} as Record<string, string>, mark: {} as Record<string, string> };
    for (let i = 0; i <= upto; i++) {
      const s = steps[i] as SxStep;
      if (s.ctxSet !== undefined) st.ctx = s.ctxSet; else st.ctx += s.ctx || 0;
      const add = s.tok !== undefined ? s.tok : s.call ? st.ctx : s.ctx || 0;
      st.tok += add; st.inr += s.inr !== undefined ? s.inr : (add / 1000) * rate;
      st.calls += s.call || 0; st.loops += s.loop || 0; st.ms += s.ms || 0;
      if (s.tr) st.trace.push(...s.tr);
      (s.show || []).forEach((id) => { st.show[id] = true; }); (s.hide || []).forEach((id) => { st.show[id] = false; });
      Object.assign(st.sub, s.sub || {}); Object.assign(st.mark, s.mark || {});
    }
    return st;
  }
  function paint(st: ReturnType<typeof fold>): void {
    QA('.sx-m').forEach((m) => { const k = m.dataset['m'] as keyof typeof st; const v = st[k] as number; (m.querySelector('b') as HTMLElement).textContent = k === 'inr' ? `₹${v.toFixed(2)}` : k === 'ms' ? fmtMs(v) : fmtN(v); m.classList.toggle('hot', hot[k] !== undefined && v > (hot[k] as number)); });
    if (S.ctx) { const pct = Math.min(100, (st.ctx / S.ctx.max) * 100); const b = Q('.sx-bar2'); (b.querySelector('i') as HTMLElement).style.width = `${pct}%`; b.className = `sx-bar2${pct >= 95 ? ' full' : pct >= 70 ? ' warn' : ''}`; Q('.sx-ctxv').textContent = `${fmtN(Math.min(st.ctx, S.ctx.max))} / ${fmtN(S.ctx.max)}`; }
    const tr = Q('.sx-trace'); tr.innerHTML = st.trace.map(([k, t]) => `<div><span class="sx-k sxk-${k}">${k}:</span><span class="${k === 'Error' ? 'sx-err' : ''}">${E(t)}</span></div>`).join(''); tr.scrollTop = tr.scrollHeight;
    S.nodes.forEach((n) => {
      const g = Q(`#sxn-${n.id}`); const vis = st.show[n.id] !== undefined ? st.show[n.id] : !n.hidden; g.classList.toggle('sx-hid', !vis);
      g.classList.remove('m-sure', 'm-likely', 'm-bad', 'm-pruned', 'm-best'); if (st.mark[n.id]) g.classList.add(`m-${st.mark[n.id]}`);
      const s = root.querySelector(`#sxs-${n.id}`); if (s) s.textContent = st.sub[n.id] !== undefined ? (st.sub[n.id] as string) : n.sub ?? '';
    });
    S.links.forEach((l) => { const vis = st.show[l.id] !== undefined ? st.show[l.id] : !l.hidden; Q(`#sxl-${l.id}`).classList.toggle('sx-hid', !vis); root.querySelector(`#sxb-${l.id}`)?.classList.toggle('sx-hid', !vis); });
  }
  function highlight(s: SxStep | null): void {
    QA('.sx-node').forEach((n) => n.classList.remove('on')); QA('.sx-link,.sx-lbl').forEach((l) => l.classList.remove('on'));
    if (!s) return;
    (s.on || []).forEach((id) => root.querySelector(`#sxn-${id}`)?.classList.add('on'));
    [...(s.path || []), ...(s.par || [])].forEach((id) => {
      const l = root.querySelector(`#sxl-${id}`); if (l) { l.classList.add('on'); l.classList.remove('sx-hid'); }
      const b = root.querySelector(`#sxb-${id}`); if (b) { b.classList.add('on'); b.classList.remove('sx-hid'); }
    });
  }
  function fly(id: string, dur: number, k = 0): Promise<void> {
    return new Promise((ok) => {
      const p = root.querySelector<SVGPathElement>(`#sxl-${id}`); const c = pk[k];
      if (reducedMotion() || !p || !c || !alive || typeof p.getTotalLength !== 'function') { ok(); return; }
      const L = p.getTotalLength(); const t0 = performance.now(); const col = getComputedStyle(p).getPropertyValue('--c') || 'var(--k-model)';
      c.style.fill = col; c.style.filter = `drop-shadow(0 0 6px ${col})`;
      const f = (now: number) => {
        const q = Math.min(1, (now - t0) / dur); const e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2; const pt = p.getPointAtLength(e * L);
        c.setAttribute('cx', String(pt.x)); c.setAttribute('cy', String(pt.y));
        if (q < 1 && alive) requestAnimationFrame(f); else { c.setAttribute('cx', '-40'); ok(); }
      };
      requestAnimationFrame(f);
    });
  }
  function say(t: string): void {
    const v = root.querySelector<HTMLInputElement>('[data-voice]'); if (!v?.checked || !window.speechSynthesis) return;
    speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t.replace(/₹/g, 'rupees ').replace(/<[^>]+>/g, '')); u.lang = 'en-IN'; u.rate = 1.02; speechSynthesis.speak(u);
  }
  function dots(): void { Q('.sx-dots').innerHTML = steps.map((s, i) => `<button type="button" class="${i === cur ? 'c' : i < cur ? 'd' : s.predict && !answered[i] ? 'p' : ''}" aria-label="Step ${i + 1}${s.predict ? ', predict' : ''}" data-i="${i}"></button>`).join(''); }
  function caption(s: Partial<SxStep> | null, i: number): void { const c = Q('.sx-cap'); c.className = `sx-cap${s?.bad ? ' bad' : s?.ok ? ' ok' : ''}`; c.innerHTML = s ? `<span class="n">${i + 1} / ${steps.length}</span><span>${s.cap}</span>` : ''; }
  const blocked = () => { const n = steps[cur + 1]; return Boolean(n?.predict && !answered[cur + 1] && !Q('.sx-predbox').hidden); };
  function controls(): void {
    Q<HTMLButtonElement>('[data-a=prev]').disabled = cur <= 0; Q<HTMLButtonElement>('[data-a=next]').disabled = cur >= steps.length - 1 || blocked();
    Q('[data-a=play]').textContent = playing ? '❚❚ Pause' : cur >= steps.length - 1 ? '▶ Replay' : '▶ Play';
  }
  async function go(i: number, animate = true): Promise<void> {
    if (i < 0 || i >= steps.length) return; const s = steps[i] as SxStep;
    if (s.predict && !answered[i] && i > cur) { showPredict(i); return; }
    const pb = Q('.sx-predbox'); pb.hidden = true; pb.innerHTML = '';
    const my = ++busy; cur = i; highlight(s); caption(s, i); dots(); controls(); say(s.cap);
    const stg = Q('.sx-stage');
    if (stg.scrollWidth > stg.clientWidth + 4 && s.on?.length) { const g = root.querySelector(`#sxn-${s.on[s.on.length - 1]}`); if (g) { const r = g.getBoundingClientRect(); const sr = stg.getBoundingClientRect(); stg.scrollBy({ left: r.left + r.width / 2 - (sr.left + sr.width / 2), behavior: reducedMotion() ? 'auto' : 'smooth' }); } }
    if (animate) {
      const d = broken() ? 520 : 800;
      for (const id of s.path || []) { await fly(id, d); if (my !== busy) return; }
      if (s.par?.length) { await Promise.all(s.par.map((id, k) => fly(id, d, k % 3))); if (my !== busy) return; }
    }
    if (my !== busy) return; paint(fold(i)); highlight(s); controls();
  }
  function showPredict(i: number): void {
    stop(); const p = steps[i]?.predict; if (!p) return; const box = Q('.sx-predbox');
    box.hidden = false; box.innerHTML = `<div class="sx-pred"><span class="eyebrow">Predict before you see it</span><p>${p.q}</p><div class="sx-opts">${p.opts.map((o, k) => `<button type="button" class="sx-opt" data-k="${k}">${String.fromCharCode(65 + k)}. ${o}</button>`).join('')}</div><div class="sx-why" hidden></div></div>`;
    caption({ cap: 'Pause here. What would a careful engineer expect?' }, i); dots(); controls(); say(p.q);
    box.querySelectorAll<HTMLButtonElement>('.sx-opt').forEach((b) => b.addEventListener('click', () => {
      const k = Number(b.dataset['k']); answered[i] = true;
      box.querySelectorAll<HTMLButtonElement>('.sx-opt').forEach((x) => { x.disabled = true; if (Number(x.dataset['k']) === p.ok) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
      const w = box.querySelector('.sx-why') as HTMLElement; w.hidden = false;
      w.innerHTML = `<b>${k === p.ok ? 'Right.' : 'Not quite.'}</b> ${p.why} <button class="btn primary" type="button" data-see style="margin-left:6px">See what happens →</button>`;
      const see = w.querySelector('[data-see]') as HTMLElement; see.addEventListener('click', () => void go(i)); see.focus(); dots();
      try { window.dispatchEvent(new CustomEvent('sx-predict', { detail: { scene: sid, step: i, correct: k === p.ok } })); } catch { /* ignore */ }
    }));
    box.querySelector<HTMLElement>('.sx-opt')?.focus();
  }
  function stop(): void { playing = false; clearTimeout(timer); if (alive) controls(); }
  function tick(): void {
    if (!playing || !alive) return; if (cur >= steps.length - 1) { stop(); return; }
    const n = steps[cur + 1] as SxStep; if (n.predict && !answered[cur + 1]) { void go(cur + 1); return; }
    void go(cur + 1).then(() => { if (playing && alive) timer = setTimeout(tick, broken() ? 700 : 2300); });
  }
  function play(): void { if (playing) { stop(); return; } if (cur >= steps.length - 1) reset(false); playing = true; controls(); tick(); }
  function reset(show = true): void { stop(); busy++; steps = S.build(opts()); cur = -1; answered = {}; Q('.sx-predbox').hidden = true; paint(fold(-1)); highlight(null); if (show) void go(0); }
  Q('.sx').addEventListener('click', (e) => {
    const target = e.target as HTMLElement; const a = target.closest<HTMLElement>('[data-a]');
    if (a) { const k = a.dataset['a']; if (k === 'prev') { stop(); void go(cur - 1, false); } else if (k === 'next') { stop(); void go(cur + 1); } else if (k === 'play') play(); else if (k === 'restart') reset(); return; }
    const d = target.closest<HTMLElement>('.sx-dots button');
    if (d) { stop(); const i = Number(d.dataset['i']); const blk = steps.findIndex((s, k) => k <= i && s.predict && !answered[k]); void go(blk >= 0 ? blk : i, false); }
  });
  QA<HTMLInputElement>('[data-tog]').forEach((inp) => inp.addEventListener('change', () => {
    const t = togs.find((x) => x.id === inp.dataset['tog']);
    if (inp.checked && t?.excl) t.excl.forEach((o) => { const x = root.querySelector<HTMLInputElement>(`[data-tog="${o}"]`); if (x) x.checked = false; });
    reset(); if (broken()) play();
  }));
  Q<HTMLInputElement>('[data-voice]').addEventListener('change', (e) => { if (!(e.target as HTMLInputElement).checked && window.speechSynthesis) speechSynthesis.cancel(); else if (steps[cur]) say((steps[cur] as SxStep).cap); });
  Q('.sx').addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement; if (target.closest('input,textarea,.sx-opt')) return;
    if (e.key === 'ArrowRight' && !Q<HTMLButtonElement>('[data-a=next]').disabled) { e.preventDefault(); stop(); void go(cur + 1); }
    else if (e.key === 'ArrowLeft' && !Q<HTMLButtonElement>('[data-a=prev]').disabled) { e.preventDefault(); stop(); void go(cur - 1, false); }
    else if (e.key === ' ' && !target.closest('button')) { e.preventDefault(); play(); }
  });
  reset();
  return { kill() { alive = false; playing = false; busy++; clearTimeout(timer); try { speechSynthesis.cancel(); } catch { /* ignore */ } } };
}
