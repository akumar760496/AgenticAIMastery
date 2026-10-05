/**
 * Capstone case studies: pick techniques, order them, say which symptom each one fixes,
 * then check the plan. A case that carries `hints` withholds the model answer while the plan is
 * still wrong and points the learner back at the page instead; a correct plan is revealed at once.
 */
import { $, $$, html, meterRow, setHtml, storage, trusted, type TrustedHtml } from '../html';
import type { Capstone, ModuleData, Verdict } from '../content';
import type { ModuleContext } from './ModuleContext';

interface PlanState {
  sel: string[];
  why: Record<string, string>;
  /** Technique id to the index of the symptom the learner says it fixes. */
  fix: Record<string, number>;
  /** Answer to the case's "why does anything go first" question. */
  first: number | null;
  /** How many times the plan has been checked. */
  tries: number;
  /** Set once the model answer has been shown, so it stays shown. */
  shown: boolean;
  /**
   * The plan was right when it was checked, as opposed to the answer being revealed after the hints
   * ran out. `shown` alone cannot tell the two apart, so it cannot stand for "the learner solved it".
   * Only set for a gated case: an ungated one has nothing to check against.
   */
  solved?: boolean;
}
/** Hints run out after this many checks, and the answer is shown whether or not the plan is right. */
const PATIENCE = 4;
const LABEL: Record<Verdict, string> = { essential: 'Essential', useful: 'Useful', 'not-needed': 'Not needed here' };
const blank = (): PlanState => ({ sel: [], why: {}, fix: {}, first: null, tries: 0, shown: false });

type Issue =
  | { kind: 'cover'; sym: number; ids: readonly string[] }
  | { kind: 'drop'; id: string }
  | { kind: 'first' };

/** How far the learner has got through a module's cases, for the card that links to them. */
export function capstoneProgress(data: ModuleData): { total: number; done: number; started: number; solved: number } {
  const cases = data.cx?.cases?.length ? data.cx.cases : data.cx?.capstone ? [data.cx.capstone] : [];
  let done = 0; let started = 0; let solved = 0;
  for (const c of cases) {
    const st = storage.json<Partial<PlanState>>(c.id ? `capstone-p${data.n}-${c.id}` : `capstone-p${data.n}`, {});
    if (st.shown) done += 1; else if ((st.tries ?? 0) > 0 || (st.sel?.length ?? 0) > 0) started += 1;
    // `done` counts answers seen, which includes giving up; `solved` is the one that is evidence.
    if (st.solved) solved += 1;
  }
  return { total: cases.length, done, started, solved };
}

export function mountCapstone(root: HTMLElement, data: ModuleData, ctx?: ModuleContext): void {
  const cases: readonly Capstone[] = data.cx?.cases?.length ? data.cx.cases : data.cx?.capstone ? [data.cx.capstone] : [];
  if (!cases.length) return;
  const T = data.techniques;
  const labels = data.cx?.capLabels ?? {};
  /** Techniques of this module, plus any extra choice a case judges (model tiering, for instance). */
  const picks = [...T.map((t) => t.id), ...cases.flatMap((c) => Object.keys(c.verdict)).filter((id, i, all) => !T.some((t) => t.id === id) && all.indexOf(id) === i)];
  const name = (id: string) => T.find((x) => x.id === id)?.name ?? labels[id]?.[0] ?? id;
  const ask = (id: string) => T.find((x) => x.id === id)?.q ?? labels[id]?.[1] ?? '';
  const keyOf = (c: Capstone) => (c.id ? `capstone-p${data.n}-${c.id}` : `capstone-p${data.n}`);

  let at = Math.max(0, cases.findIndex((c) => c.id === storage.get(`capstone-p${data.n}-at`)));
  let K = cases[at]!;
  let st = blank();
  /** A case with hints holds the answer back; one without keeps the original instant comparison. */
  const gated = () => Boolean(K.hints && K.covers);

  const loadState = () => {
    const saved = storage.json<Partial<PlanState>>(keyOf(K), blank());
    st = {
      sel: Array.isArray(saved.sel) ? saved.sel.filter((id) => picks.includes(id)) : [],
      why: saved.why ?? {}, fix: saved.fix ?? {},
      first: typeof saved.first === 'number' ? saved.first : null,
      tries: saved.tries ?? 0, shown: Boolean(saved.shown), solved: Boolean(saved.solved),
    };
  };
  const save = () => storage.set(keyOf(K), JSON.stringify(st));

  const out = () => $(root, '#cap-out')!;
  const plan = () => $(root, '#cap-plan')!;

  /** The brief, the numbered symptoms and the empty plan. Re-rendered when the case changes. */
  const drawCase = () => {
    const covers = K.covers;
    const wf = K.whyFirst;
    setHtml(root, html`${cases.length > 1
      ? html`<div class="cap-cases" role="tablist" aria-label="Capstone cases">${cases.map((c, i) => html`<button class="cap-case" type="button" role="tab" aria-selected="${i === at}" data-c="${i}"><b>Case ${i + 1}${c.tag ? html` · ${trusted(c.tag)}` : ''}</b><span>${trusted(c.title)}</span></button>`)}</div>`
      : ''}
    <div class="cap-brief"><span class="eyebrow">Case study${K.sector ? html` · ${trusted(K.sector)}` : ''}</span><h3 class="pi-h">${trusted(K.title)}</h3><p>${trusted(K.brief)}</p>
      <h4>What you know</h4>
      ${covers
        ? html`<ol class="cap-sym">${K.evidence.map((e) => html`<li><span class="cap-symn" aria-hidden="true"></span><span>${trusted(e)}</span></li>`)}</ol>`
        : html`<ul class="plain">${K.evidence.map((e) => html`<li>${trusted(e)}</li>`)}</ul>`}
      <div class="expect"><b>Your task:</b> <span>${trusted(K.task)}</span></div></div>
    <div class="cap-grid"><div><h4>1. Choose techniques</h4><div class="cap-pick">${picks.map((id) => html`<label class="tog cap-t"><input type="checkbox" value="${id}"> <span><b>${name(id)}</b><span class="pl-note">${trusted(ask(id))}</span></span></label>`)}</div></div>
      <div><h4>2. Order your plan and say what each step fixes</h4><ol class="cap-plan" id="cap-plan"></ol>
      ${wf ? html`<fieldset class="cap-wf"><legend>${trusted(wf.q)}</legend>${wf.options.map((o, i) => html`<label class="tog"><input type="radio" name="cap-wf" value="${i}"${st.first === i ? html` checked` : ''}> <span>${trusted(o)}</span></label>`)}</fieldset>` : ''}</div></div>
    <div class="row-q"><button class="btn primary" type="button" id="cap-go">${gated() ? 'Check my plan' : 'Compare with the model answer'}</button><button class="btn" type="button" id="cap-reset">Start over</button>${gated() ? html`<span class="pl-note" id="cap-tries"></span>` : ''}</div>
    <div id="cap-out" aria-live="polite"></div>`);

    $$(root, '.cap-case').forEach((b) => b.addEventListener('click', () => { pick(Number(b.dataset['c'])); }));
    $$<HTMLInputElement>(root, '.cap-t input').forEach((c) => c.addEventListener('change', () => {
      if (c.checked) { if (!st.sel.includes(c.value)) st.sel.push(c.value); } else st.sel = st.sel.filter((x) => x !== c.value);
      save(); drawPlan();
    }));
    $$<HTMLInputElement>(root, 'input[name="cap-wf"]').forEach((r) => r.addEventListener('change', () => { st.first = Number(r.value); save(); }));
    $(root, '#cap-reset')?.addEventListener('click', () => { st = blank(); save(); drawCase(); });
    $(root, '#cap-go')?.addEventListener('click', () => { st.tries += 1; save(); check(); });
    drawPlan();
    drawTries();
    if (st.shown) check(true);
  };

  const drawTries = () => {
    const el = $(root, '#cap-tries'); if (!el) return;
    el.textContent = st.tries === 0 ? 'Your plan is checked against the evidence. The answer comes once you have had a go at it.'
      : st.shown ? '' : `Check ${st.tries} of ${PATIENCE}. Each one gives you a stronger hint.`;
  };

  const pick = (i: number) => {
    at = i; K = cases[i]!; storage.set(`capstone-p${data.n}-at`, K.id ?? '');
    loadState(); drawCase();
    root.scrollIntoView({ block: 'start', behavior: 'auto' });
  };

  /** The ordered plan: move buttons and the symptom each step claims to fix. */
  const drawPlan = () => {
    const covers = K.covers;
    $$<HTMLInputElement>(root, '.cap-t input').forEach((c) => { c.checked = st.sel.includes(c.value); });
    setHtml(plan(), st.sel.length
      ? html`${st.sel.map((id, i) => html`<li><div class="cap-row"><b>${i + 1}. ${name(id)}</b><span class="mv"><button class="btn mini" type="button" data-up="${i}"${i === 0 ? html` disabled` : ''} aria-label="Move up">↑</button><button class="btn mini" type="button" data-dn="${i}"${i === st.sel.length - 1 ? html` disabled` : ''} aria-label="Move down">↓</button></span></div>
        ${covers
        ? html`<label class="cap-fix"><span>Fixes</span><select data-fix="${id}"><option value="">choose a symptom…</option>${covers.map((_, n) => html`<option value="${n}"${st.fix[id] === n ? html` selected` : ''}>Symptom ${n + 1}</option>`)}</select></label>`
        : html`<label class="sr" for="cw-${id}">Why ${name(id)}?</label><textarea id="cw-${id}" data-id="${id}" rows="2" placeholder="Why this technique, and why at this point?">${st.why[id] ?? ''}</textarea>`}</li>`)}`
      : html`<li class="pl-note">Tick techniques on the left to add them here.</li>`);
    $$(plan(), '[data-up]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset['up']); [st.sel[i - 1], st.sel[i]] = [st.sel[i] as string, st.sel[i - 1] as string]; save(); drawPlan(); }));
    $$(plan(), '[data-dn]').forEach((b) => b.addEventListener('click', () => { const i = Number(b.dataset['dn']); [st.sel[i + 1], st.sel[i]] = [st.sel[i] as string, st.sel[i + 1] as string]; save(); drawPlan(); }));
    $$<HTMLTextAreaElement>(plan(), 'textarea').forEach((a) => a.addEventListener('input', () => { st.why[a.dataset['id'] ?? ''] = a.value; save(); }));
    $$<HTMLSelectElement>(plan(), 'select[data-fix]').forEach((s) => s.addEventListener('change', () => {
      const id = s.dataset['fix'] ?? '';
      if (s.value === '') delete st.fix[id]; else st.fix[id] = Number(s.value);
      save();
    }));
  };

  /** A link back to the pane that proves the point. */
  const proof = (id: string, label: string): TrustedHtml => {
    if (!ctx || !T.some((t) => t.id === id)) return html``;
    return html`<button class="btn mini cap-see" type="button" data-see="${id}" data-pane="${data.play[id] ? 'play' : 'learn'}">${label}</button>`;
  };

  /** Everything still wrong with the plan, worst first: an uncovered symptom, a needless step, the order. */
  const audit = (): Issue[] => {
    const V = K.verdict; const covers = K.covers ?? [];
    // Only a symptom with an essential fix gates the answer: leaving a "useful" one out is a choice, not an error.
    const open: Issue[] = covers
      .map((ids, sym) => ({ kind: 'cover', sym, ids: ids.filter((id) => V[id] === 'essential') } as const))
      .filter((i) => i.ids.length > 0 && !i.ids.some((id) => st.sel.includes(id)));
    const drops: Issue[] = st.sel.filter((id) => V[id] === 'not-needed').map((id) => ({ kind: 'drop', id } as const));
    const issues = [...open, ...drops];
    // Order is only worth raising once the set of techniques is right; one problem at a time.
    if (!issues.length && st.sel[0] !== K.order[0]) issues.push({ kind: 'first' });
    return issues;
  };

  const check = (quiet = false) => {
    const issues = gated() ? audit() : [];
    if (st.shown || !issues.length || st.tries >= PATIENCE) {
      st.shown = true;
      if (gated() && !issues.length) st.solved = true;
      if (!quiet) save(); reveal(issues.length === 0);
    } else { hint(issues); }
    drawTries();
  };

  /** What is right, what is still missing, and a question about each gap. No verdicts, no answer. */
  const hint = (issues: readonly Issue[]) => {
    const V = K.verdict; const covers = K.covers ?? [];
    const ess = picks.filter((id) => V[id] === 'essential');
    const got = ess.filter((id) => st.sel.includes(id));
    const level = Math.min(st.tries, 3);
    const done = covers.map((ids, sym) => ({ sym, ids })).filter((c) => c.ids.length > 0 && c.ids.some((id) => st.sel.includes(id)));

    const body = issues.map((is) => {
      if (is.kind === 'first') {
        return html`<div class="cap-hint"><b>Your techniques are right; the order is not.</b><p>${trusted(K.firstHint ?? '')}</p></div>`;
      }
      if (is.kind === 'drop') {
        return html`<div class="cap-hint"><b>${name(is.id)} is in your plan.</b><p>${trusted(K.drop?.[is.id] ?? '')}</p></div>`;
      }
      const id = is.ids.find((x) => K.hints?.[x]) ?? is.ids[0] ?? '';
      const text = K.hints?.[id]?.[level - 1] ?? '';
      return html`<div class="cap-hint"><b>Symptom ${is.sym + 1} is not covered by your plan.</b><p>${trusted(text)}</p>
        ${level >= 2 ? proof(id, level >= 3 ? `Read ${name(id)} →` : 'Open the technique that does this →') : ''}</div>`;
    });

    setHtml(out(), html`<div class="cap-gate"><h4>Where your plan stands</h4>
      <ul class="plain cap-sofar"><li class="ok">${got.length} of ${ess.length} essential techniques chosen.</li>
        ${done.map((c) => html`<li class="ok">Symptom ${c.sym + 1} is covered by ${c.ids.filter((id) => st.sel.includes(id)).map(name).join(' and ')}.</li>`)}
        ${st.sel[0] && st.sel[0] === K.order[0] ? html`<li class="ok">Your first step is the right one to start with.</li>` : ''}</ul>
      <h4>Still open</h4>${body}
      <p class="pl-note">Change your plan and check it again. ${level >= 3 ? 'The next check shows the model answer.' : 'Each check gives you a stronger hint.'}</p>
      <div class="row-q"><button class="btn" type="button" id="cap-show">I’d rather see the answer</button></div></div>`);

    $$(out(), '[data-see]').forEach((b) => b.addEventListener('click', () => {
      ctx?.selectTechnique(b.dataset['see'] ?? '', true);
      setTimeout(() => ctx?.gotoPane(b.dataset['pane'] ?? 'learn'), 60);
    }));
    $(out(), '#cap-show')?.addEventListener('click', () => { st.shown = true; save(); reveal(false); drawTries(); });
    out().scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };

  /** The full comparison: score, symptom cover, every verdict, the order and the model answer. */
  const reveal = (solved: boolean) => {
    const V = K.verdict;
    const ess = picks.filter((id) => V[id] === 'essential');
    const use = picks.filter((id) => V[id] === 'useful');
    const got = ess.filter((id) => st.sel.includes(id));
    const extra = st.sel.filter((id) => V[id] === 'not-needed');
    const firstOk = st.sel[0] === K.order[0];
    const pts = got.length * 2 + use.filter((id) => st.sel.includes(id)).length - extra.length + (firstOk ? 1 : 0);
    const max = ess.length * 2 + use.length + 1;

    const rows = picks.map((id) => {
      const v = V[id]; if (!v) return html``;
      const picked = st.sel.includes(id);
      const tone = v === 'essential' ? (picked ? 'ok' : 'no') : v === 'not-needed' ? (picked ? 'no' : 'ok') : picked ? 'ok' : 'mid';
      const note = v === 'essential' ? (picked ? 'Good call.' : 'Missed: this one matters here.')
        : v === 'not-needed' ? (picked ? 'Not needed for this problem.' : 'Right to leave it out.')
          : picked ? 'Nice extra.' : 'Optional here, worth adding later.';
      const wrong = (v === 'essential' && !picked) || (v === 'not-needed' && picked);
      return html`<div class="cap-r ${tone}"><div><b>${name(id)}</b><span class="vtag">${LABEL[v]}</span><span class="cap-you">${picked ? 'In your plan' : 'Not in your plan'} · ${note}</span></div><p>${trusted(K.why[id])}</p>${wrong ? proof(id, data.play[id] ? 'See it for yourself →' : 'Read it again →') : ''}</div>`;
    });

    const covers = K.covers;
    let coverage: TrustedHtml = html``;
    if (covers) {
      const real = covers.filter((ids) => ids.length > 0);
      const open = real.filter((ids) => !ids.some((id) => st.sel.includes(id)));
      const mapped = st.sel.filter((id) => st.fix[id] !== undefined);
      coverage = html`<h4>Symptom cover</h4>
        <div class="cap-cov">${covers.map((ids, i) => {
        const ok = ids.length === 0 ? null : ids.some((id) => st.sel.includes(id));
        return html`<div class="cap-cv ${ok === null ? 'mid' : ok ? 'ok' : 'no'}"><b>Symptom ${i + 1}</b><span>${ids.length === 0 ? 'Nothing to fix — this one is here to rule a technique out.' : ok ? `Covered by ${ids.filter((id) => st.sel.includes(id)).map(name).join(' and ')}.` : `Not addressed by any step in your plan. It needs ${ids.map(name).join(' or ')}.`}</span></div>`;
      })}</div>
        ${open.length ? html`<p class="pl-note">Your plan leaves ${open.length} of ${real.length} symptoms untouched. A plan that ships and leaves a symptom in place is the usual way this goes wrong in practice.</p>` : html`<p class="pl-note">Every symptom that needs a fix has one in your plan.</p>`}
        ${mapped.length ? html`<h4>Your mapping</h4><ul class="plain cap-map">${mapped.map((id) => {
        const n = st.fix[id]!; const right = (covers[n] ?? []).includes(id);
        const belongs = covers.map((ids, i) => (ids.includes(id) ? i + 1 : 0)).filter(Boolean).map((i) => `symptom ${i}`).join(' and ');
        return html`<li class="${right ? 'ok' : 'no'}"><b>${name(id)} → symptom ${n + 1}</b> · ${right ? 'yes, that is the symptom it fixes.' : `symptom ${n + 1} needs ${(covers[n] ?? []).length ? (covers[n] ?? []).map(name).join(' or ') : 'nothing — it is there to rule a technique out'}. ${name(id)} belongs to ${belongs || 'no symptom in this case'}.`}</li>`;
      })}</ul>` : ''}`;
    }

    const wf = K.whyFirst;
    const wfRow = wf
      ? st.first === null
        ? html`<p class="cap-ord mid"><b>You skipped the question above.</b> The strongest reason here: ${trusted(wf.options[wf.correct] ?? '')} ${trusted(wf.why)}</p>`
        : html`<p class="cap-ord ${st.first === wf.correct ? 'ok' : 'no'}"><b>${st.first === wf.correct ? 'Your reason for going first is the model’s.' : `You chose “${wf.options[st.first] ?? ''}”; the stronger reason is “${wf.options[wf.correct] ?? ''}”.`}</b> ${trusted(wf.why)}</p>`
      : html``;

    const firstNote = firstOk
      ? html`<p class="cap-ord ok"><b>Your first step is the model’s first step.</b></p>`
      : html`<p class="cap-ord no"><b>You started with ${name(st.sel[0] ?? '')}; the model starts with ${name(K.order[0] ?? '')}.</b> ${trusted(K.firstWhy?.[st.sel[0] ?? ''] ?? '')}</p>`;

    const head = gated()
      ? solved
        ? html`<p class="cap-ord ok"><b>Your plan holds up.</b> Every symptom that needs a fix has one, nothing needless is in it, and you started in the right place — in ${st.tries} check${st.tries === 1 ? '' : 's'}.</p>`
        : html`<p class="cap-ord no"><b>Shown after ${st.tries} check${st.tries === 1 ? '' : 's'}.</b> Read the reasons against your own plan rather than instead of it — the gap is the useful part.</p>`
      : html``;

    setHtml(out(), html`${head}
      ${meterRow('Your plan', Math.max(0, pts) / max, `${got.length} of ${ess.length} essential · ${extra.length} unnecessary · ${firstOk ? 'right starting point' : `consider starting with ${name(K.order[0] ?? '')}`}`)}
      ${coverage}
      <h4>Technique by technique</h4><div class="cap-rs">${rows}</div>
      <h4>Order</h4>${firstNote}${wfRow}<ol class="steps">${K.order.map((id) => html`<li><span>${name(id)}</span></li>`)}</ol>
      <h4>Model answer</h4><div class="story"><p>${trusted(K.model)}</p></div>
      <p class="pl-note">${trusted(K.note || 'Compare your justifications with the reasons above. Order matters: start with the step that tells you the most for the least effort, then build on it.')}</p>
      ${cases.length > 1 && at < cases.length - 1 ? html`<div class="row-q"><button class="btn primary" type="button" id="cap-next">Try case ${at + 2} →</button></div>` : ''}`);

    $$(out(), '[data-see]').forEach((b) => b.addEventListener('click', () => {
      ctx?.selectTechnique(b.dataset['see'] ?? '', true);
      setTimeout(() => ctx?.gotoPane(b.dataset['pane'] ?? 'learn'), 60);
    }));
    $(out(), '#cap-next')?.addEventListener('click', () => pick(at + 1));
    out().scrollIntoView({ block: 'nearest', behavior: 'auto' });
  };

  loadState();
  drawCase();
}
