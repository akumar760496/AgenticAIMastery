/** Practice pane: goals checklist, try-it calculation, common mistakes, spot-the-bug, scenario quiz, interview questions, connections. */
import { $, $$, esc, html, reducedMotion, setHtml, storage, trusted, type TrustedHtml } from '../html';
import type { Technique } from '../content';
import type { ModuleContext } from '../module/ModuleContext';
import type { QuizEngine } from '../module/QuizEngine';

const ACTIVITIES: readonly (readonly [string, string, string])[] = [
  ['Try it', '5 min', 'Do by hand the calculation the tools do for you. Type your answer to check it, then read the worked answer.'],
  ['Common mistakes', '2 min', 'For each “Don’t”, say what you would do instead before reading the “Do”.'],
  ['Spot the bug', '3 min', 'A short snippet from a real implementation hides one mistake. Click the line you think is wrong.'],
  ['Check yourself', '10 min', 'Ten scenario questions drawn at random from a bank of 20 industry cases. A new set every attempt, and your scores are tracked.'],
  ['Interview questions', '5 min', 'Answer out loud in about a minute before opening the model answer, then compare.'],
  ['Connects to', '2 min', 'See where this technique meets others, so you can explain the whole system.'],
];

function introHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const X = ctx.data.play[t.id]; const saved = storage.json<number[]>(`goals-${t.id}`, []);
  return html`<div class="pi">
    <div class="pi-main"><span class="eyebrow">What you’re practising</span><h3 class="pi-h">${t.name}: from understanding to explaining it</h3>
      <p>Learn showed how the technique works and Play let you experiment. Practice checks that you can use it and explain it, which is what projects and interviews ask of you. Work through the six activities in order; the whole set takes about 25 minutes. When you’re done, the Explain tab lets you put it in your own words.</p></div>
    <div class="pi-goals"><h4>By the end you should be able to</h4><ul class="goals">${(X?.goals ?? []).map((g, i) => html`<li><label class="tog"><input type="checkbox" data-g="${i}"${saved.includes(i) ? html` checked` : ''}> <span>${trusted(g)}</span></label></li>`)}</ul>
      <p class="pl-note" id="pi-done">Tick each goal once you can do it without looking.</p></div>
  </div>
  <ol class="acts">${ACTIVITIES.map((a) => html`<li><div class="act-h"><b>${a[0]}</b><span>${a[1]}</span></div><p>${a[2]}</p></li>`)}</ol>`;
}

function studyHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const s = ctx.data.study.tech[t.id]; if (!s) return html``;
  const conn = ctx.data.study.conn[t.id] ?? [];
  return html`<section class="study flat" aria-label="Study and revise">
    <div class="practice-head"><h3>Study &amp; revise</h3><span>Try it yourself, interview practice, common mistakes and links to other modules</span></div>
    <div class="s-grid">
      <div class="p-card tryit"><h4>Try it</h4><p style="color:var(--ink)">${trusted(s.t)}</p>
        ${s.num ? html`<div class="row"><label for="try-in">${trusted(s.num[2])}</label><input id="try-in" class="num" inputmode="decimal" autocomplete="off"><button class="btn" id="try-check" type="button">Check</button></div><span class="fb" id="try-fb" aria-live="polite"></span>` : ''}
        <div><button class="btn" id="try-show" type="button" aria-expanded="false">Show worked answer</button></div>
        <div class="reveal" id="try-ans" hidden>${trusted(s.a)}</div></div>
      <div class="p-card"><h4>Common mistakes</h4><div class="mist">${s.mis.map((m) => html`<div><p class="dont"><b>Don't</b>${trusted(m[0])}</p><p class="do"><b>Do</b>${trusted(m[1])}</p></div>`)}</div></div>
    </div>
    ${bugHTML(t, ctx)}${ctx.data.cx?.qb?.[t.id] ? html`<div class="p-card check" id="check"><h4>Check yourself: real-world scenarios</h4>
      <div class="quiz" id="chk" aria-live="polite"></div>
      <p class="pl-note">All your attempts are listed in the <button class="btn link-btn" type="button" id="chk-hist">quiz tracker</button> further down this page.</p></div>` : ''}
    <div class="p-card"><h4>Interview questions</h4><div class="ivs">${s.iv.map((q) => html`<details class="iv"><summary>${trusted(q[0])}</summary><p>${trusted(q[1])}</p></details>`)}</div></div>
    ${conn.length ? html`<div class="p-card"><h4>Connects to</h4><div class="conn">${conn.map((c) => html`<a href="${c.url}"${c.p === ctx.data.study.panel ? html` data-local="${c.id}"` : ''}><span class="pn">${c.pn}${c.p === ctx.data.study.panel ? ' · this page' : ' →'}</span><b>${c.name}</b><span>${trusted(c.note)}</span></a>`)}</div></div>` : ''}
  </section>`;
}

function bugHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  const B = ctx.data.cx?.bugs?.[t.id]; if (!B) return html``;
  return html`<div class="p-card bug" id="bug"><h4>Spot the bug</h4>
    <p>This snippet (${trusted(B.title)}) contains <b>one planted mistake</b>. Click the line you think is wrong.</p>
    <div class="code-card bug-code"><pre class="code"><code>${B.code.split('\n').map((l, i) => html`<button type="button" class="bl" data-l="${i + 1}"><span class="lnum">${i + 1}</span>${l || ' '}</button>`)}</code></pre></div>
    <div class="bug-fb" id="bug-fb" aria-live="polite"></div>
    <div><button class="btn" type="button" id="bug-show">Show the answer</button></div></div>`;
}

export function practicePaneHTML(t: Technique, ctx: ModuleContext): TrustedHtml {
  return html`${introHTML(t, ctx)}${studyHTML(t, ctx)}`;
}

export function wirePracticePane(root: HTMLElement, t: Technique, ctx: ModuleContext, quiz: QuizEngine): void {
  // goals
  const boxes = $$<HTMLInputElement>(root, '.goals input'); const note = $(root, '#pi-done');
  const updGoals = () => {
    const on = boxes.filter((b) => b.checked).map((b) => Number(b.dataset['g']));
    storage.set(`goals-${t.id}`, JSON.stringify(on));
    if (note) setHtml(note, on.length === boxes.length && boxes.length ? html`All goals met. <a href="${ctx.hubUrl}#t-${ctx.data.study.track}">Mark ${t.short} as confident on the track page</a>` : html`${on.length} of ${boxes.length} goals met. Tick each once you can do it without looking.`);
  };
  boxes.forEach((b) => b.addEventListener('change', updGoals)); updGoals();
  // try it
  const s = ctx.data.study.tech[t.id];
  if (s) {
    const show = $(root, '#try-show'); const ans = $(root, '#try-ans');
    show?.addEventListener('click', () => { if (!ans) return; ans.hidden = !ans.hidden; show.setAttribute('aria-expanded', String(!ans.hidden)); show.textContent = ans.hidden ? 'Show worked answer' : 'Hide worked answer'; });
    const chk = $(root, '#try-check');
    if (chk && s.num) {
      const inp = $<HTMLInputElement>(root, '#try-in')!; const fb = $(root, '#try-fb')!; const num = s.num;
      const go = () => {
        const v = parseFloat(inp.value.replace(/[,$₹%\s]/g, ''));
        if (Number.isNaN(v)) { fb.className = 'fb bad'; fb.textContent = 'Enter a number.'; return; }
        const ok = Math.abs(v - num[0]) <= num[1]; fb.className = `fb ${ok ? 'ok' : 'bad'}`;
        fb.textContent = ok ? 'Correct. Check the worked answer for the reasoning.' : 'Not quite. Try again or show the worked answer.';
      };
      chk.addEventListener('click', go); inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    }
  }
  $$(root, '.conn a[data-local]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); ctx.selectTechnique(a.dataset['local'] ?? '', true); document.getElementById('tech-h')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); }));
  // bug
  const B = ctx.data.cx?.bugs?.[t.id];
  if (B) {
    const fb = $(root, '#bug-fb')!; let tries = 0;
    const reveal = (won: boolean) => {
      $$<HTMLButtonElement>(root, '.bl').forEach((b) => { b.disabled = true; b.classList.toggle('hit', Number(b.dataset['l']) === B.line); });
      setHtml(fb, html`<div class="verdict ${won ? 'ok' : 'mid'}"><b>${won ? `Found it${tries > 1 ? ` in ${tries} tries` : ''}.` : `The bug is on line ${B.line}.`}</b> ${trusted(B.explain)}</div>
        <p class="pl-note" style="margin-top:8px">Fixed line:</p><div class="code-card"><pre class="code"><code>${B.fix}</code></pre></div>`);
      const sb = $(root, '#bug-show'); if (sb) sb.hidden = true;
    };
    $$(root, '.bl').forEach((b) => b.addEventListener('click', () => {
      tries++; const l = Number(b.dataset['l']);
      if (l === B.line) { reveal(true); return; }
      b.classList.add('miss');
      setHtml(fb, html`<div class="verdict no"><b>Not line ${l}.</b> ${trusted(B.also?.[String(l)] ?? 'That line is correct. Look again at what the code is supposed to compute.')}</div>`);
    }));
    $(root, '#bug-show')?.addEventListener('click', () => reveal(false));
  }
  // scenario quiz
  const chkRoot = $(root, '#chk');
  if (chkRoot) {
    quiz.intro(chkRoot, t.id);
    const unsub = quiz.subscribe(() => { if (chkRoot.querySelector('.qz-intro')) quiz.intro(chkRoot, t.id); });
    ctx.onCleanup(unsub);
    $(root, '#chk-hist')?.addEventListener('click', () => {
      // The quiz centre is its own section in the original layout, and a card in the band layout.
      const card = document.getElementById('bc-quiz');
      if (card) { if (card.getAttribute('aria-expanded') !== 'true') card.click(); else card.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); return; }
      document.getElementById('quiz-h')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' });
    });
  }
  void esc;
}
