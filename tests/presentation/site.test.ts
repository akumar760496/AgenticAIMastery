import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { EVALUATION_PLAYGROUNDS } from '@/modules/evaluation';
import type { ModuleData } from '@/presentation/site/content';
import { esc, html, trusted } from '@/presentation/site/html';
import { mountModulePage } from '@/presentation/site/module/ModulePage';
import { QuizEngine } from '@/presentation/site/module/QuizEngine';
import { mountLegacyPlayground } from '@/presentation/site/playground/LegacyPlaygroundRenderer';
import { parseRoute } from '@/presentation/site/SiteApp';
import { PlaygroundSession } from '@/application/PlaygroundSession';
import { systemEvalPlayground } from '@/modules/evaluation/playgrounds/systemEval.playground';

const evalData = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/modules/eval.json'), 'utf8')) as ModuleData;
const promptingData = JSON.parse(readFileSync(join(process.cwd(), 'src/content/site/modules/prompting.json'), 'utf8')) as ModuleData;
const moduleDir = join(process.cwd(), 'src/content/site/modules');
const allModules = readdirSync(moduleDir).filter((f) => f.endsWith('.json'))
  .map((f) => [f.replace('.json', ''), JSON.parse(readFileSync(join(moduleDir, f), 'utf8')) as ModuleData] as const);

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
  window.scrollTo = () => {};
  window.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as never;
});

describe('html helpers', () => {
  it('escapes interpolated values and keeps trusted content', () => {
    expect(html`<b>${'<img onerror=x>'}</b>`.value).toBe('<b>&lt;img onerror=x&gt;</b>');
    expect(html`<b>${trusted('<i>ok</i>')}</b>`.value).toBe('<b><i>ok</i></b>');
    expect(esc('"&')).toBe('&quot;&amp;');
  });
});

describe('parseRoute', () => {
  it('recognises hub, module and interview routes', () => {
    expect(parseRoute('#home')).toEqual({ kind: 'hub', view: 'home' });
    expect(parseRoute('')).toEqual({ kind: 'hub', view: 'home' });
    expect(parseRoute('#m-eval~system')).toEqual({ kind: 'mod', slug: 'eval', sub: 'system' });
    expect(parseRoute('#iv~s03')).toEqual({ kind: 'iv', sub: 's03' });
    expect(parseRoute('#t-qual')).toEqual({ kind: 'hub', view: 't-qual' });
  });
});

describe('course playground renderer', () => {
  it('renders course markup and updates outputs when a control changes', () => {
    const root = document.createElement('div'); document.body.replaceChildren(root);
    const session = new PlaygroundSession(systemEvalPlayground);
    mountLegacyPlayground(root, systemEvalPlayground, session);
    expect(root.querySelector('.pl-grid .pl-in table.cells')).not.toBeNull();
    const before = root.querySelector('.pl-out')!.textContent;
    root.querySelector<HTMLButtonElement>('button.cell.no')!.click();
    expect(root.querySelector('.pl-out')!.textContent).not.toBe(before);
    expect(session.snapshot.activePreset).toBeNull();
  });
});

describe('QuizEngine', () => {
  it('draws ten distinct questions from the technique bank', () => {
    const quiz = new QuizEngine(evalData, '', () => {});
    const ids = quiz.draw('system');
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
    const bank = new Set((evalData.cx?.qb['system'] ?? []).map((r) => r[0]));
    expect(ids.every((id) => bank.has(id))).toBe(true);
  });
  it('spreads a mixed review across techniques (at most three from one)', () => {
    const quiz = new QuizEngine(evalData, '', () => {});
    const ids = quiz.draw('mix');
    const per = new Map<string, number>();
    for (const [tid, rows] of Object.entries(evalData.cx?.qb ?? {})) for (const r of rows) if (ids.includes(r[0])) per.set(tid, (per.get(tid) ?? 0) + 1);
    expect(Math.max(...per.values())).toBeLessThanOrEqual(3);
  });
});

describe('module page (Evaluation)', () => {
  it('renders every section and switches techniques and panes', () => {
    const root = document.createElement('div'); document.body.replaceChildren(root);
    const changes: string[] = [];
    mountModulePage(root, { data: evalData, hubUrl: '', assetBase: '/m/eval/', playgrounds: EVALUATION_PLAYGROUNDS, scenes: {}, initial: 'pairwise', onTechniqueChange: (id) => changes.push(id) });
    for (const id of ['loop-h', 'ch-h', 'tech-h', 'band-h']) expect(root.querySelector(`#${id}`), id).not.toBeNull();
    expect(root.querySelectorAll('#tabs .tab')).toHaveLength(evalData.techniques.length);
    expect(root.querySelector('#tab-pairwise')?.getAttribute('aria-selected')).toBe('true');
    expect(changes).toEqual(['pairwise']);
    root.querySelector<HTMLElement>('#tab-system')!.click();
    expect(root.querySelector('#detail h2')?.textContent).toBe('System-Level Eval');
    root.querySelector<HTMLElement>('#st-play')!.click();
    expect(root.querySelector<HTMLElement>('#pane-play')!.hidden).toBe(false);
    expect(root.querySelector('#play-root .pl-grid')).not.toBeNull();
    expect(root.querySelector('#pl-story')?.textContent).not.toBe('');
    expect(root.querySelectorAll('#cmp tbody tr')).toHaveLength(evalData.techniques.length);
    expect(root.querySelectorAll('#cards .card').length).toBeGreaterThanOrEqual(evalData.techniques.length);
    expect(root.querySelectorAll('#capstone .cap-case')).toHaveLength(3);
  });
});

describe('capstone cases (Prompting)', () => {
  const mount = () => {
    const root = document.createElement('div'); document.body.replaceChildren(root);
    localStorage.clear();
    mountModulePage(root, { data: promptingData, hubUrl: '', assetBase: '/m/prompting/', playgrounds: {}, scenes: {}, initial: 'schema', onTechniqueChange: () => {} });
    return root.querySelector<HTMLElement>('#capstone')!;
  };

  it('offers every case, and every choice a case judges', () => {
    const cap = mount();
    const cases = promptingData.cx!.cases!;
    expect(cases).toHaveLength(3);
    expect(cap.querySelectorAll('.cap-case')).toHaveLength(3);
    // Model tiering is judged by the cases but is not a technique tab, so it still needs a checkbox.
    const picks = [...cap.querySelectorAll<HTMLInputElement>('.cap-t input')].map((i) => i.value);
    expect(picks).toContain('tiering');
    for (const c of cases) for (const id of Object.keys(c.verdict)) expect(picks, `${c.id}/${id}`).toContain(id);
    // Every technique of the module is judged by every case: no free picks.
    for (const c of cases) for (const t of promptingData.techniques) expect(Object.keys(c.verdict), `${c.id}/${t.id}`).toContain(t.id);
  });

  it('names every id it shows, and covers only ids it offers', () => {
    const cap = mount();
    const picks = [...cap.querySelectorAll<HTMLInputElement>('.cap-t input')].map((i) => i.value);
    for (const c of promptingData.cx!.cases!) {
      expect(c.covers).toHaveLength(c.evidence.length);
      for (const ids of c.covers ?? []) for (const id of ids) expect(picks, `${c.id}: ${id}`).toContain(id);
      for (const id of c.order) expect(Object.keys(c.why), `${c.id}: ${id}`).toContain(id);
    }
  });

  it('withholds the answer while the plan is wrong, and hints about the symptom instead', () => {
    const cap = mount();
    const tick = (id: string) => cap.querySelector<HTMLInputElement>(`.cap-t input[value="${id}"]`)!.click();
    const go = () => cap.querySelector<HTMLButtonElement>('#cap-go')!.click();
    const out = () => cap.querySelector<HTMLElement>('#cap-out')!;
    expect(cap.querySelector('#cap-go')!.textContent).toBe('Check my plan');
    tick('schema'); tick('fewshot');
    go();
    // Confirms what is right, names no verdict and shows no model answer.
    expect(out().textContent).toContain('1 of 3 essential techniques chosen');
    expect(out().textContent).toContain('Symptom 1 is covered by JSON Schema');
    expect(out().querySelectorAll('.cap-hint').length).toBe(3);
    expect(out().textContent).not.toContain('Model answer');
    expect(out().textContent).not.toContain('Essential');
    // The first hint asks about the symptom and does not name the technique that fixes it.
    const first = out().querySelector('.cap-hint')!.textContent ?? '';
    expect(first).toContain('What checks that a number is');
    expect(first).not.toContain('Validation and Repair');
    expect(out().querySelectorAll('[data-see]')).toHaveLength(0);
    // A needless pick is questioned too, without being told it is wrong.
    expect(out().textContent).toContain('Which of the four symptoms is about a category or a style?');
    // Second check: a stronger hint, now with a way into the technique.
    go();
    expect(out().querySelector('.cap-hint')!.textContent).toContain('after the model has answered');
    expect(out().querySelectorAll('[data-see]').length).toBeGreaterThan(0);
    // Third check names it; the fourth gives up and shows the answer.
    go();
    expect(out().querySelector('.cap-hint')!.textContent).toContain('Validation and Repair Loops');
    expect(out().textContent).toContain('The next check shows the model answer');
    go();
    expect(out().textContent).toContain('Shown after 4 checks');
    expect(out().textContent).toContain('Model answer');
  });

  it('lets a learner give up early', () => {
    const cap = mount();
    cap.querySelector<HTMLInputElement>('.cap-t input[value="schema"]')!.click();
    cap.querySelector<HTMLButtonElement>('#cap-go')!.click();
    cap.querySelector<HTMLButtonElement>('#cap-show')!.click();
    expect(cap.querySelector('#cap-out')!.textContent).toContain('Model answer');
  });

  it('reveals a correct plan at once, with symptom cover and a score', () => {
    const cap = mount();
    for (const id of ['schema', 'repair', 'sysprompt']) cap.querySelector<HTMLInputElement>(`.cap-t input[value="${id}"]`)!.click();
    const wf = cap.querySelector<HTMLInputElement>('input[name="cap-wf"][value="1"]')!;
    wf.click();
    const fix = cap.querySelector<HTMLSelectElement>('select[data-fix="sysprompt"]')!;
    fix.value = '0'; fix.dispatchEvent(new Event('change'));
    cap.querySelector<HTMLButtonElement>('#cap-go')!.click();
    const out = cap.querySelector<HTMLElement>('#cap-out')!;
    expect(out.textContent).toContain('Your plan holds up');
    expect(out.textContent).toContain('in 1 check');
    expect(out.textContent).toContain('3 of 3 essential');
    expect(out.textContent).toContain('Your reason for going first is the model');
    // Symptom 4 is only fixed by a "useful" technique, so it never blocked the answer, but it is still reported.
    expect(out.querySelectorAll('.cap-cv.no').length).toBe(1);
    // The learner mapped the system prompt to the wrong symptom, and is told which one it belongs to.
    expect(out.textContent).toContain('System Prompt Design \u2192 symptom 1');
    expect(out.textContent).toContain('symptom 1 needs JSON Schema and Constrained Decoding or Validation and Repair Loops');
    expect(out.textContent).toContain('belongs to symptom 3');
    expect(out.textContent).toContain('Model Tiering');
    expect(out.textContent).not.toMatch(/\btiering\b/);
    expect(out.querySelector('#cap-next')).not.toBeNull();
  });

  it('keeps a separate plan per case', () => {
    const cap = mount();
    cap.querySelector<HTMLInputElement>('.cap-t input[value="schema"]')!.click();
    cap.querySelector<HTMLElement>('.cap-case[data-c="1"]')!.click();
    const second = document.querySelector<HTMLElement>('#capstone')!;
    expect(second.querySelector('.cap-brief h3')?.textContent).toBe('The triage agent nobody trusts');
    expect(second.querySelectorAll('.cap-plan > li.pl-note')).toHaveLength(1);
    second.querySelector<HTMLElement>('.cap-case[data-c="0"]')!.click();
    expect(document.querySelector<HTMLInputElement>('#capstone .cap-t input[value="schema"]')!.checked).toBe(true);
  });
});

describe('band layout (Prompting)', () => {
  const page = (initial = 'schema') => {
    const root = document.createElement('div'); document.body.replaceChildren(root);
    mountModulePage(root, { data: promptingData, hubUrl: '', assetBase: '/m/prompting/', playgrounds: {}, scenes: {}, initial, onTechniqueChange: () => {} });
    return root;
  };

  it('puts the chooser before the techniques and everything module-wide into one band', () => {
    const root = page();
    const ids = [...root.querySelectorAll<HTMLElement>('.wrap > .sec > .sec-head > h2')].map((h) => h.id);
    expect(ids).toEqual(['loop-h', 'ch-h', 'tech-h', 'band-h']);
    // The six stacked sections are gone; their content is inside the band.
    const band = root.querySelector<HTMLElement>('.band')!;
    expect(band.querySelector('#capstone')).not.toBeNull();
    expect(band.querySelector('#qz-center')).not.toBeNull();
    expect(band.querySelector('#cards')).not.toBeNull();
    expect(band.querySelector('#cmp')).not.toBeNull();
    // Side by side is collapsed, and the glossary has moved to the hub Library.
    expect(root.querySelector<HTMLDetailsElement>('#cmp-d')!.open).toBe(false);
    expect(root.querySelector('#glist')).toBeNull();
    expect(root.querySelector<HTMLAnchorElement>('.band-lib a')!.getAttribute('href')).toBe('#library~p13');
    expect(root.querySelector('.band-lib')!.textContent).toContain(`${promptingData.study.gloss.length} terms`);
  });

  it('keeps both panels shut until a card is clicked, then one at a time', () => {
    const root = page();
    const panel = (k: string) => root.querySelector<HTMLElement>(`#panel-${k}`)!;
    const card = (k: string) => root.querySelector<HTMLButtonElement>(`#bc-${k}`)!;
    expect(panel('capstone').hidden).toBe(true);
    expect(panel('quiz').hidden).toBe(true);
    card('capstone').click();
    expect(panel('capstone').hidden).toBe(false);
    expect(card('capstone').getAttribute('aria-expanded')).toBe('true');
    card('quiz').click();
    expect(panel('capstone').hidden).toBe(true);
    expect(panel('quiz').hidden).toBe(false);
    card('quiz').click();
    expect(panel('quiz').hidden).toBe(true);
  });

  it('shows what the learner has already done on each card', () => {
    localStorage.clear();
    let root = page();
    expect(root.querySelector('#bs-capstone')!.textContent).toBe('3 cases · not started yet');
    expect(root.querySelector('#bs-quiz')!.textContent).toContain('160 questions · no attempts yet');
    // Work on a case, and the card says so on the next visit.
    root.querySelector<HTMLButtonElement>('#bc-capstone')!.click();
    root.querySelector<HTMLInputElement>('#capstone .cap-t input[value="schema"]')!.click();
    root = page();
    expect(root.querySelector('#bs-capstone')!.textContent).toBe('3 cases · 1 in progress');
  });

  it('opens the right panel from a deep link, and sends ~glossary to the Library', () => {
    const root = page('capstone');
    expect(root.querySelector<HTMLElement>('#panel-capstone')!.hidden).toBe(false);
    expect(root.querySelector<HTMLElement>('#panel-quiz')!.hidden).toBe(true);
    const quizRoot = page('quiz');
    expect(quizRoot.querySelector<HTMLElement>('#panel-quiz')!.hidden).toBe(false);
    location.hash = '';
    page('glossary');
    expect(location.hash).toBe('#library~p13');
  });
});

describe('the layout and capstone a module without the new content still gets', () => {
  /** Evaluation before this work: one case, no hints, every section stacked. */
  const legacyData = (): ModuleData => {
    const one = { ...evalData.cx!.cases![0] } as Record<string, unknown>;
    for (const k of ['covers', 'hints', 'drop', 'firstHint', 'firstWhy', 'whyFirst', 'id', 'tag', 'sector']) delete one[k];
    return { ...evalData, header: { ...evalData.header, layout: undefined }, cx: { ...evalData.cx!, cases: undefined, capstone: one } } as unknown as ModuleData;
  };

  it('stacks every section and keeps its own glossary', () => {
    const legacy = legacyData();
    const root = document.createElement('div'); document.body.replaceChildren(root);
    mountModulePage(root, { data: legacy, hubUrl: '', assetBase: '/m/eval/', playgrounds: {}, scenes: {}, initial: 'pairwise', onTechniqueChange: () => {} });
    for (const id of ['loop-h', 'tech-h', 'ch-h', 'cap-h', 'cmp-h', 'quiz-h', 'fc-h', 'glo-h']) expect(root.querySelector(`#${id}`), id).not.toBeNull();
    expect(root.querySelector('.band')).toBeNull();
    expect(root.querySelector('#glist')).not.toBeNull();
    expect(root.querySelector('#glist div')).not.toBeNull();
  });

  it('keeps the original capstone: no case chips, free text, and the answer on the first press', () => {
    const root = document.createElement('div'); document.body.replaceChildren(root);
    localStorage.clear();
    mountModulePage(root, { data: legacyData(), hubUrl: '', assetBase: '/m/eval/', playgrounds: {}, scenes: {}, initial: 'pairwise', onTechniqueChange: () => {} });
    expect(root.querySelector('#capstone .cap-cases')).toBeNull();
    expect(root.querySelector('#capstone .cap-sym')).toBeNull();
    expect(root.querySelector('#capstone .cap-brief ul.plain')).not.toBeNull();
    expect(root.querySelector('#capstone .cap-wf')).toBeNull();
    root.querySelector<HTMLInputElement>('#capstone .cap-t input')!.click();
    expect(root.querySelector('#capstone .cap-plan textarea')).not.toBeNull();
    expect(root.querySelector('#cap-go')!.textContent).toBe('Compare with the model answer');
    root.querySelector<HTMLButtonElement>('#cap-go')!.click();
    expect(root.querySelector('#cap-out')!.textContent).toContain('Model answer');
  });
});

describe('every module', () => {
  it('renders the band layout, with each choice its capstone judges available and named', () => {
    expect(allModules).toHaveLength(18);
    for (const [slug, data] of allModules) {
      const root = document.createElement('div'); document.body.replaceChildren(root);
      localStorage.clear();
      mountModulePage(root, { data, hubUrl: '', assetBase: `/m/${slug}/`, playgrounds: {}, scenes: {}, initial: '', onTechniqueChange: () => {} });
      for (const id of ['loop-h', 'ch-h', 'tech-h', 'band-h']) expect(root.querySelector(`#${id}`), `${slug}: ${id}`).not.toBeNull();
      expect(root.querySelector('.band'), slug).not.toBeNull();
      expect(root.querySelector('#glist'), `${slug}: glossary should have moved to the Library`).toBeNull();
      expect(root.querySelector<HTMLAnchorElement>('.band-lib a')!.getAttribute('href'), slug).toBe(`#library~p${data.n}`);
      expect(root.querySelector<HTMLElement>('#panel-capstone')!.hidden, slug).toBe(true);
      expect(root.querySelector<HTMLElement>('#panel-quiz')!.hidden, slug).toBe(true);
      expect(root.querySelectorAll('#cmp tbody tr'), slug).toHaveLength(data.techniques.length);

      // Every id the capstone judges must be pickable and must have a real name, not a raw id.
      root.querySelector<HTMLButtonElement>('#bc-capstone')!.click();
      const picks = [...root.querySelectorAll<HTMLInputElement>('#capstone .cap-t input')].map((i) => i.value);
      const cases = data.cx?.cases?.length ? data.cx.cases : data.cx?.capstone ? [data.cx.capstone] : [];
      const names = new Map(data.techniques.map((t) => [t.id, t.name] as const));
      for (const c of cases) {
        for (const id of [...Object.keys(c.verdict), ...c.order]) {
          expect(picks, `${slug}: ${id} is judged but cannot be chosen`).toContain(id);
          const label = names.get(id) ?? data.cx?.capLabels?.[id]?.[0];
          expect(label, `${slug}: ${id} has no display name`).toBeTruthy();
        }
      }
    }
  }, 30000);
});

describe('authored capstone cases', () => {
  const withCases = allModules.filter(([, d]) => (d.cx?.cases?.length ?? 0) > 1);

  it('hold to the contract the renderer relies on', () => {
    expect(withCases.length).toBeGreaterThan(0);
    for (const [slug, d] of withCases) {
      const ids = new Set(d.techniques.map((t) => t.id));
      const known = new Set([...ids, ...Object.keys(d.cx?.capLabels ?? {})]);
      // A capLabel is a [name, question] pair. A bare string indexes to its first letter, which
      // reads as truthy everywhere and renders the technique as "P".
      for (const [id, label] of Object.entries(d.cx?.capLabels ?? {})) {
        expect(Array.isArray(label), `${slug}: capLabels.${id} must be a [name, question] pair`).toBe(true);
        expect(label, `${slug}: capLabels.${id}`).toHaveLength(2);
        for (const part of label) expect(typeof part, `${slug}: capLabels.${id}`).toBe('string');
      }
      for (const c of d.cx!.cases!) {
        const at = `${slug}/${c.id}`;
        // No free picks: every technique of the module is judged, and nothing unknown is.
        for (const id of ids) expect(Object.keys(c.verdict), `${at}: ${id} unjudged`).toContain(id);
        for (const id of Object.keys(c.verdict)) {
          expect(known.has(id), `${at}: judges unknown id ${id}`).toBe(true);
          expect(c.why[id], `${at}: no reason for ${id}`).toBeTruthy();
        }
        const ess = Object.keys(c.verdict).filter((k) => c.verdict[k] === 'essential');
        const nn = Object.keys(c.verdict).filter((k) => c.verdict[k] === 'not-needed');
        // Exactly the essentials get escalating hints; exactly the needless ones get a question.
        expect(Object.keys(c.hints ?? {}).sort(), `${at}: hints`).toEqual([...ess].sort());
        for (const [k, v] of Object.entries(c.hints ?? {})) expect(v, `${at}: ${k} hint levels`).toHaveLength(3);
        expect(Object.keys(c.drop ?? {}).sort(), `${at}: drop`).toEqual([...nn].sort());
        // Symptom cover must be answerable, or the gate can never be satisfied.
        expect(c.covers, `${at}: covers/evidence`).toHaveLength(c.evidence.length);
        for (const row of c.covers ?? []) for (const id of row) expect(known.has(id), `${at}: covers ${id}`).toBe(true);
        for (const e of ess) expect((c.covers ?? []).some((r) => r.includes(e)), `${at}: essential ${e} covers nothing`).toBe(true);
        for (const id of c.order) expect(known.has(id), `${at}: order ${id}`).toBe(true);
        // The hint for a wrong first step must never be written for the right one.
        expect(c.firstWhy?.[c.order[0]!], `${at}: firstWhy covers the right answer`).toBeUndefined();
        expect(c.firstHint, `${at}: firstHint`).toBeTruthy();
        const wf = c.whyFirst!;
        expect(wf.options[wf.correct], `${at}: whyFirst correct index`).toBeTruthy();
        expect(c.model, `${at}: model answer`).toBeTruthy();
        expect(c.note, `${at}: note`).toBeTruthy();
      }
      // The cases must disagree, or there is nothing to learn from having three.
      const first = d.cx!.cases!.map((c) => c.order[0]);
      expect(new Set(first).size, `${slug}: cases share a first move`).toBeGreaterThan(1);
    }
  });
});

describe('the hidden attribute', () => {
  /**
   * `hidden` is display:none from the UA sheet, so any author rule outranks it — and
   * `#modroot.has-rail` sets display:grid. When that wins, the router hides #modroot and it stays on
   * screen, which rendered the module page under the hub stylesheet on every hub navigation after a
   * module. jsdom ignores @media blocks, so this cannot be caught by rendering; check the source.
   */
  const GUARD = /\[hidden\]\{display:none!important\}/;

  it('outranks every rule that sets display on a page container', () => {
    const sheets = [
      ...['nav.css', 'hub.css', 'interview.css'].map((f) => [f, join(process.cwd(), 'src/content/site', f)] as const),
      ...readdirSync(moduleDir).filter((f) => f.endsWith('.css')).map((f) => [f, join(moduleDir, f)] as const),
    ];
    expect(sheets).toHaveLength(21);
    for (const [name, path] of sheets) {
      expect(GUARD.test(readFileSync(path, 'utf8')), `${name}: missing the global [hidden] guard`).toBe(true);
    }
  });

  it('is what the router relies on to swap #modroot for #hubroot', () => {
    // Guard against the rule being re-added unguarded somewhere the global rule does not reach.
    for (const f of ['nav.css', 'hub.css']) {
      const css = readFileSync(join(process.cwd(), 'src/content/site', f), 'utf8');
      const guardAt = css.search(GUARD);
      const rail = css.indexOf('#modroot.has-rail{');
      expect(guardAt, `${f}: no guard`).toBeGreaterThan(-1);
      expect(rail, `${f}: no #modroot.has-rail rule to guard`).toBeGreaterThan(-1);
      expect(css.slice(rail, rail + 120), `${f}: #modroot.has-rail must still set display`).toContain('display:grid');
    }
  });
});

describe('module stylesheets', () => {
  /** Classes the band and capstone renderers emit. Each module ships its own CSS copy, so a
   *  class styled in only one of them renders unstyled everywhere else. */
  const REQUIRED = [
    '.band{', '.band-cards{', '.bcard{', '.band-panel{', '.band-ref{', '.band-lib{', '.band-sub{',
    '.cap-cases{', '.cap-case{', '.cap-sym{', '.cap-symn{', '.cap-fix{', '.cap-cov{', '.cap-cv{',
    '.cap-map{', '.cap-ord{', '.cap-wf{', '.cap-gate{', '.cap-sofar{', '.cap-hint{',
    '.cap-brief{', '.cap-grid{', '.cap-pick,.cap-plan{', '.cap-rs{', '.cap-r{',
  ];
  const TOKENS = ['--band:', '--band-2:', '--band-rule:', '--bcard:', '--bcard-2:', '--bcard-open:', '--on-band:', '--on-band-mut:', '--band-a:'];

  it('style every class the renderers emit, in every module', () => {
    const files = readdirSync(moduleDir).filter((f) => f.endsWith('.css'));
    expect(files).toHaveLength(18);
    for (const f of files) {
      const css = readFileSync(join(moduleDir, f), 'utf8');
      for (const sel of REQUIRED) expect(css.includes(sel), `${f}: missing rule for ${sel}`).toBe(true);
      for (const t of TOKENS) expect(css.includes(t), `${f}: missing token ${t}`).toBe(true);
      // The band tokens must sit in this module's own theme block, not a generic one.
      expect(/:root:root:root\{[^}]*--band:/.test(css), `${f}: band tokens outside the module theme block`).toBe(true);
      expect(css.includes('--panel-base:#FFFFFF'), `${f}: no light-mode panel base`).toBe(true);
    }
  });
});
