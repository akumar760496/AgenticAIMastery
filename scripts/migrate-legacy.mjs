/**
 * One-off migration: reads the legacy module files (pN.js, lN.js, xN/zN/yN/cN/qN.py)
 * and writes one validated-ready JSON content file per technique.
 *
 * Usage: LEGACY_DIR=../panels MODULE=1 SLUG=evaluation node scripts/migrate-legacy.mjs
 *
 * After migration the JSON files are the single source of truth; the legacy files
 * are no longer read at build or run time.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import vm from 'node:vm';

const LEGACY_DIR = resolve(process.env.LEGACY_DIR ?? '../panels');
const MODULE = Number(process.env.MODULE ?? 1);
const SLUG = process.env.SLUG ?? 'evaluation';
const OUT_DIR = resolve(`src/modules/${SLUG}/content`);

/** Load legacy JS into a sandbox with just enough DOM stubs for top-level code. */
function loadLegacyJs() {
  const stubElement = { innerHTML: '', style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, setAttribute() {}, querySelectorAll: () => [], querySelector: () => null };
  const sandbox = {
    window: { addEventListener() {} },
    document: { getElementById: (id) => (id === 'capstone' ? null : stubElement), addEventListener() {}, querySelectorAll: () => [] },
    console,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  vm.createContext(sandbox);
  const files = ['helpers.js', `p${MODULE}.js`, 'core.js', `l${MODULE}.js`];
  const source = 'const RM=true;\n' + files.map((f) => readFileSync(join(LEGACY_DIR, f), 'utf8')).join('\n;\n') +
    '\n;globalThis.__legacy={T,DIAG,QS,LESSON,DECIDE,MISSION};';
  vm.runInContext(source, sandbox, { filename: `legacy-module-${MODULE}.js` });
  return sandbox.__legacy;
}

/** Dump the Python data dictionaries for this module as JSON. */
function loadLegacyPython() {
  const script = `
import json, sys
ns = {}
for name in ['x','z','y','c','q']:
    exec(open('${LEGACY_DIR}/' + name + '${MODULE}.py', encoding='utf-8').read(), ns)
keys = ['P','PX','TECH','GLOSS','SOURCES','BUGS','PRED','TEACH','MENTOR','QB']
out = {k: ns.get(k) for k in keys}
json.dump(out, sys.stdout, ensure_ascii=False, default=list)
`;
  return JSON.parse(execFileSync('python3', ['-c', script], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
}

/** Legacy lesson code carries "#@1,2" step tags at line ends; split them into structured highlights. */
function parseTaggedCode(code) {
  const lines = code.split('\n').map((raw) => {
    const match = raw.match(/\s*#@([\d,]+)\s*$/);
    return { text: match ? raw.slice(0, match.index) : raw, steps: match ? match[1].split(',').map(Number) : [] };
  });
  return lines;
}

const toQuiz = (rows) => (rows ?? []).map(([id, kind, industry, question, options, correct, explanation]) => ({
  id, kind: kind === 'm' ? 'multi' : 'single', industry, question, options, correct, explanation,
}));

const legacyJs = loadLegacyJs();
const legacyPy = loadLegacyPython();
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(join(OUT_DIR, 'diagrams'), { recursive: true });

const ids = legacyJs.T.map((t) => t.id);
for (const technique of legacyJs.T) {
  const id = technique.id;
  const lesson = legacyJs.LESSON[id];
  const decide = legacyJs.DECIDE[id];
  const guide = legacyPy.PX?.[id];
  const practice = legacyPy.P?.[id];
  const tech = legacyPy.TECH?.[id];

  writeFileSync(join(OUT_DIR, 'diagrams', `${id}.svg`), legacyJs.DIAG[id]());
  const sceneSvgs = (lesson?.scene ?? []).map(([step, , render]) => ({ step, svg: render(0) }));

  const content = {
    id,
    moduleSlug: SLUG,
    name: technique.name,
    shortName: technique.short,
    question: technique.q,
    summary: technique.what,
    useCases: technique.use,
    keyFacts: { label: technique.mLabel, items: technique.metrics.map(([term, detail]) => ({ term, detail })) },
    steps: technique.steps,
    pitfalls: technique.pitfalls,
    tools: technique.tools,
    remember: technique.remember,
    caption: technique.cap,
    comparison: technique.cmp,
    diagram: { file: `diagrams/${id}.svg` },
    lesson: lesson && {
      file: lesson.file,
      language: lesson.lang,
      code: parseTaggedCode(lesson.code),
      steps: lesson.steps.map(([title, text]) => ({ title, text })),
      sceneHeight: lesson.h,
      scenes: sceneSvgs,
    },
    decision: decide && {
      pros: decide.pros, cons: decide.cons, avoidWhen: decide.avoid,
      tools: decide.tools.map(([name, type, what, url]) => ({ name, type, what, url })),
    },
    playgroundGuide: guide && {
      scenario: guide.scenario, controls: guide.controls,
      outputs: guide.outputs.map(([name, meaning]) => ({ name, meaning })),
      presets: guide.presets, missions: guide.missions, tools: guide.tools,
      quickPicks: (guide.quick ?? []).map(([need, tool]) => ({ need, tool })), goals: guide.goals,
    },
    practice: practice && {
      scenario: practice.sc,
      industries: practice.ind.map(([industry, use]) => ({ industry, use })),
      analogy: practice.an,
      library: { name: practice.lib[0], what: practice.lib[1], install: practice.lib[2] || undefined },
      note: practice.note ?? undefined,
      samples: practice.code.map(([file, language, code]) => ({ file, language, code })),
    },
    numericDrill: tech && {
      question: tech.t, answer: tech.a,
      expected: tech.num ? { value: tech.num[0], tolerance: tech.num[1], label: tech.num[2] } : undefined,
      interview: tech.iv.map(([q, a]) => ({ question: q, answer: a })),
      mistakes: tech.mis.map(([mistake, fix]) => ({ mistake, fix })),
    },
    quiz: toQuiz(legacyPy.QB?.[id]),
  };
  writeFileSync(join(OUT_DIR, `${id}.json`), JSON.stringify(content, null, 2) + '\n');
}

const moduleContent = {
  slug: SLUG,
  number: MODULE,
  techniqueOrder: ids,
  glossary: (legacyPy.GLOSS ?? []).map(([term, definition]) => ({ term, definition })),
  sources: Object.entries(legacyPy.SOURCES ?? {}).map(([id, [title, url]]) => ({ id, title, url })),
  symptomRouter: legacyJs.QS.map(([symptom, techniqueId, advice]) => ({ symptom, techniqueId, advice })),
};
writeFileSync(join(OUT_DIR, 'module.json'), JSON.stringify(moduleContent, null, 2) + '\n');
console.log(`Migrated ${ids.length} techniques to ${OUT_DIR}: ${ids.join(', ')}`);
