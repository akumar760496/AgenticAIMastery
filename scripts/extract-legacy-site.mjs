/**
 * Anti-corruption extractor for the legacy site (hub + module fragments).
 * Runs each legacy module fragment once inside jsdom, captures its data objects, and renders every
 * build-time SVG (loop, diagrams, lesson frames) to strings. Output: src/content/site/*.json.
 * Usage: LEGACY_HUB=/path/to/panels/hub node scripts/extract-legacy-site.mjs [slug ...]
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const HUB = process.env.LEGACY_HUB ?? '/home/claude/panels/hub';
const OUT = path.resolve('src/content/site');
fs.mkdirSync(path.join(OUT, 'modules'), { recursive: true });

const EXPORTS = ['T', 'EXTRA', 'CMPH', 'QS', 'TOP', 'DIAG', 'LESSON', 'DECIDE', 'PRACTICE', 'PX', 'CX', 'STUDY', 'GIFS', 'KEY'];

function extractModule(slug) {
  const f = JSON.parse(fs.readFileSync(path.join(HUB, 'm', `${slug}.json`), 'utf8'));
  const hook = `\ntry{window.__X={${EXPORTS.map((k) => `${k}:typeof ${k}!=='undefined'?${k}:undefined`).join(',')}};}catch(e){window.__XE=String(e)}\n`;
  const js = f.js.replace(/\}\)\(\);\s*$/, `${hook}})();`);
  const dom = new JSDOM(`<!doctype html><html><body><div id="modroot">${f.body}</div></body></html>`, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  w.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.HTMLElement.prototype.scrollTo = () => {};
  w.scrollTo = () => {};
  w.SVGElement.prototype.getTotalLength = () => 0;
  try { w.eval(js); } catch (e) { console.warn(slug, 'runtime:', e.message); }
  const X = w.__X;
  if (!X) throw new Error(`${slug}: no exports (${w.__XE})`);
  const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
  const diagrams = Object.fromEntries(Object.entries(X.DIAG ?? {}).map(([id, fn]) => [id, String(fn())]));
  const lessons = Object.fromEntries(Object.entries(X.LESSON ?? {}).map(([id, L]) => {
    const frames = L.steps.map((_, i) => {
      const k = i + 1; let old = '', hot = '', fresh = '', n = 0;
      for (const [at, hl, fn] of L.scene) {
        if (at > k) continue;
        if (at === k) fresh += fn(0.1 + (n++) * 0.12, k);
        else if (hl.includes(k)) hot += `<g class="still">${fn(0, k)}</g>`;
        else old += `<g class="still dim">${fn(0, k)}</g>`;
      }
      return old + hot + fresh;
    });
    return [id, { file: L.file, lang: L.lang, h: L.h, code: L.code, steps: L.steps, frames }];
  }));
  const css = f.css;
  const data = {
    n: f.n, slug, title: f.title, track: f.track,
    techniques: plain(X.T), extra: plain(X.EXTRA), compareHead: X.CMPH ?? '', chooser: plain(X.QS),
    loop: X.TOP ? String(X.TOP()) : '', diagrams, lessons,
    decide: plain(X.DECIDE), practice: plain(X.PRACTICE), play: plain(X.PX), cx: plain(X.CX), study: plain(X.STUDY), gifs: plain(X.GIFS),
    header: headerOf(f.body),
  };
  fs.writeFileSync(path.join(OUT, 'modules', `${slug}.json`), JSON.stringify(data));
  fs.writeFileSync(path.join(OUT, 'modules', `${slug}.css`), css);
  console.log(slug, 'techniques', data.techniques?.length, 'lessons', Object.keys(lessons).length, 'diagrams', Object.keys(diagrams).length);
}

/** Pulls the static header/section text out of the fragment body (titles, ledes, section blurbs). */
function headerOf(body) {
  const d = new JSDOM(`<body>${body}</body>`).window.document;
  const txt = (sel) => d.querySelector(sel)?.innerHTML.trim() ?? '';
  const secs = Object.fromEntries([...d.querySelectorAll('section.sec')].map((s) => {
    const h = s.querySelector('h2'); return [h?.id ?? '', { title: h?.innerHTML ?? '', blurb: s.querySelector('.sec-head p')?.innerHTML ?? '' }];
  }));
  const crumbs = d.querySelector('.top .crumbs')?.innerHTML.trim() ?? '';
  const foot = [...d.querySelectorAll('footer span')].map((s) => s.innerHTML);
  return { h1: txt('.top h1'), lede: txt('.top .lede'), crumbs, sections: secs, footer: foot, markers: d.querySelector('svg defs')?.outerHTML ?? '' };
}

function extractHub() {
  const html = fs.readFileSync(path.join(HUB, 'index.html'), 'utf8');
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  fs.writeFileSync(path.join(OUT, 'hub.css'), styles.join('\n'));
  const script = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).at(-1);
  const m = /const DATA\s*=\s*(\{[\s\S]*?\});\nconst INTERVALS/.exec(script);
  fs.writeFileSync(path.join(OUT, 'hub.json'), m[1]);
  console.log('hub data', m[1].length);
}

const slugs = process.argv.slice(2);
extractHub();
for (const s of slugs.length ? slugs : fs.readdirSync(path.join(HUB, 'm')).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''))) extractModule(s);
