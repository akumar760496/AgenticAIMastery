# Working in this repo

Notes for whoever picks this up next, human or agent. Everything here is either a measured
cost or a bug that has already been shipped once. Read the two tables; skim the rest.

---

## 1. What is actually expensive

Not the tests. The content files.

| Thing | Size | Cost of reading it whole |
|---|---|---|
| `src/content/site/modules/<slug>.json` | **~350 KB, on one line** | ~90k tokens, and no partial read is possible |
| All 18 module JSONs | 6.4 MB | do not |
| `src/content/site/hub.json` | 253 KB, one line | ~65k tokens |
| `src/content/site/modules/<slug>.css` | ~53 KB, 730 lines | fine with `sed -n`/`grep -n` |

**Never `cat` or `Read` a module JSON.** They are minified to a single line, so line-range reads
do not help. Query them:

```bash
python3 -c "
import json; d=json.load(open('src/content/site/modules/eval.json',encoding='utf-8'))
for t in d['techniques']: print(t['id'], '|', t['q'])
"
```

Same for writing — see §7. For CSS use `grep -n 'selector' file` then `sed -n 'A,Bp'`.

Keep tool output small: pipe tests through `grep -E "Tests |FAIL|→"` and builds through `tail -2`.
A full unfiltered vitest run is several thousand tokens of noise.

**Every storage key, so you do not have to go looking.** Finding these cost a dozen greps once.

| Key | Written by | Holds |
|---|---|---|
| `aam-progress-v1` | `HubProgress` | technique boxes, quiz bests, study days, per-module rollups |
| `aam-mix-v1` | `DailyMix` | today's five item keys, `done`, `miss` |
| `aam-iv-v1` | `interviewRoom` | drill attempts (`att`) and mock scorecards (`mk`) |
| `qz-p<n>` | `QuizEngine` | every attempt and a per-question record |
| `capstone-p<n>-<case>` | `capstone` | selections, `tries`, `shown`, `solved` |
| `goals-<techId>` | `practicePane` | ticked practice goals |
| `teach-<techId>` | `explainPane` | the explain-it-back text |
| `aam-tab-p<n>` | `ModulePage` | the technique that module was last showing |
| `aam-path` · `aam-theme` · `aam-glance` · `aam-iv-tab` | various | preferences |

---

## 2. Which check to run

Measured on this machine. Pick the cheapest row that covers what you touched.

| You changed | Run | Time |
|---|---|---|
| Types, signatures, any `.ts` | `npx tsc --noEmit` | 3.5 s |
| Site rendering, module content, module CSS | `npx vitest run tests/presentation/site.test.ts` | 5.9 s |
| One concern inside that file | add `-t "authored capstone"` | 2.0 s |
| `src/modules/**` or a playground definition | `npx vitest run tests/modules` | 1 s |
| Finishing a task, or any shared-code change | `npm run check && npx vite build` | ~14 s |

`npm run check` = typecheck + `validate` + all 1345 tests. It is only ~10 s, so the reason to
skip it mid-task is output noise, not wall clock. Run it before handing work back. Always.

The 1296-test `playgroundContracts` file only matters if you touched `src/modules/**`. Site work
does not need it.

**A new test file slows the existing ones.** Vitest runs files in parallel, so adding one can push a
slow neighbour past the 5 s default timeout. The 18-module band-layout test takes ~2.2 s alone and
started failing at ~5.2 s for exactly this reason; it now carries an explicit `}, 30000)`. Before
calling an intermittent failure flaky, read the duration — if it is just over 5000 ms, it is the
timeout, not chance.

**`npm run validate` does not validate what the site renders.** It checks
`src/modules/*/content/*.json` against a zod schema. The site reads
`src/content/site/**`, which has **no schema gate** — `tests/presentation/site.test.ts` is the
only thing standing between a bad content edit and a broken page. Treat it as the content gate.

---

## 3. Traps that have each cost a bug already

**Every module ships its own copy of the CSS.** 18 files, largely identical. A class styled in
one renders unstyled in the other 17. This shipped once (the capstone case chips). When adding a
rule the renderers emit, add it to all 18 in one scripted pass and list the selector in the
`REQUIRED` array in the stylesheet test.

**A module's theme lives in `:root:root:root`, not at the top of the file.** Each module CSS opens
with `:root` / `@media (prefers-color-scheme: dark)` / `[data-theme="dark"]` blocks — and then
near the bottom overrides `--accent` and friends in:

```css
:root:root:root{ ... --accent:<track colour>; }
:root:root:root[data-page-theme="light"]{ ... --accent:<track colour>; }
```

Theme tokens put in the top blocks are dead for anything `:root:root:root` sets, and the theme
switch is **`[data-page-theme="light"]`**, not `prefers-color-scheme`. Both mistakes shipped.

**`--accent` is the track colour, not a fixed hue.** Six tracks:
`start` amber `#F2B25C` · `qual` rose `#F07A8A` · `prod` violet `#A48BF0` ·
`retr` teal `#3CC4B4` · `found` blue `#5B8DEF` · `front` green `#6CCB8A` (dark-theme values).
Never hardcode a colour in module CSS — derive from `var(--accent)` with `color-mix`, which the
stylesheets already use.

**Check contrast numerically.** Hand-picked tints shipped once at a 1.01 contrast ratio — cards
invisible against their container. Before committing a palette, compute the ratios. Thresholds
used here: text ≥ 4.5, adjacent surfaces ≥ 1.14, accent on surface ≥ 3.0.

**`select()` wipes the cleanup list.** `mountModulePage` calls `runCleanups()` on every technique
switch. Subscriptions that belong to the page, not the technique pane, go in `pageCleanups` or
they die on the first tab click. Shipped once.

**Deep links must keep working.** `#m-<slug>~<technique>`, `~capstone`, `~quiz`, `~glossary`.
`~glossary` now redirects to `#library~p<n>`. If a section moves or collapses, the route has to
open or redirect it, not scroll to something hidden.

**`hidden` loses to any author rule, and that broke every hub navigation.** The router swaps pages by
setting `#modroot.hidden` / `#hubroot.hidden`, but `hidden` is only `display:none` from the UA sheet,
and `#modroot.has-rail{display:grid}` (nav.css, inside `@media (min-width:901px)`) outranks it. Once a
module had been opened, `has-rail` stayed on, so Home, Back and every track link updated the hash and
the breadcrumbs while the module page stayed on screen — now under hub.css, so it rendered unstyled.
Every stylesheet must carry `[hidden]{display:none!important}`; the 18 module sheets and interview.css
always did, nav.css and hub.css did not. **jsdom cannot catch this**: it applies the cascade but
ignores `@media` blocks, and `modroot.hidden` reads `true` either way, so the only coverage is the
source check in the `hidden attribute` test. Do not trust a jsdom navigation test to prove a page is
actually visible.

**`--accent` does not exist on hub pages.** Module stylesheets set it in `:root:root:root`; `nav.css`
and `hub.css` never define it, and the hub's accent is **`--t`**, set per area by `setArea`. A missing
custom property is not a graceful fallback: `background:var(--accent)` computes to `rgba(0,0,0,0)`,
which is how the Daily Mix progress bar shipped invisible at the right width and fully transparent.
There is no `--accent-soft` here either — soft fills are `color-mix(in srgb,var(--t) 13%,transparent)`,
the idiom the rest of hub.css uses. `.lib-filter` in hub.css still carries this bug. jsdom cannot catch
it; only a real browser resolves the cascade, so probe `getComputedStyle(...).backgroundColor` when a
colour looks wrong rather than trusting the inline width.

**`CSS.escape` is undefined in jsdom.** A click handler that builds a selector from stored data throws
an uncaught exception that fails the whole run rather than one assertion. Match on the property
instead: `$$(document, '[data-x]').find((el) => el.dataset['x'] === k)`. Keys here contain `:`, `|`
and `.`, so an unescaped selector is wrong in a browser too.

**`shell.hubCrumbs()` clears `gnBand`.** Anything written into the crumb-bar band slot must be written
*after* that call or it is wiped in the same tick. The mobile progress chip silently rendered nothing
until the order was swapped.

**`route()` is async, and two navigations can overlap.** `showModule` awaits a lazy ~350 KB module
JSON, so a click during that wait runs `route()` again. Every navigation takes a token from `this.nav`
and must re-check it after any `await`; a loser that carries on will overwrite the winner's stylesheet,
fill a hidden `#modroot` and leave `current` naming a page nobody is looking at — which made that
module's link dead until a different one was opened. Do not claim `current` before the await either:
the same-slug branch would then treat the next click as an in-place update and do nothing.

**A hash the app wrote itself comes back as a navigation.** `select()` and the band cards both
`replaceState` the technique or panel into the hash. Real browsers fire no `hashchange` for that, jsdom
does, so `mountModulePage`'s `show(sub, nav)` ignores a sub it is already displaying. Keep it that way,
or opening the capstone panel immediately closes it again.

**A sub-route for the module already on screen must be applied, not dropped.** The breadcrumb and the
rail both link to the bare `#m-<slug>` while the hash carries `~<technique>`; returning early there
makes them dead links. `tests/presentation/routing.test.ts` covers all of this — it is the only
coverage the router has.

**Do not restart the dev server.** `src/main.ts` self-accepts HMR, and everything — site code,
module JSON, module CSS, hub content — reaches the page in place with scroll position kept. The
only change needing a restart is one to the HMR block in `main.ts` itself.

---

## 4. Where progress lives, and what may claim completion

Two stores, and they are not interchangeable.

**Hub state** — `aam-progress-v1`, owned by `HubProgress`, synced to the learner's account inside a
Claude artifact. Small, merged across devices, read on every page.

**Module-local keys** — written by the panes, never synced, and **not usefully readable by the hub**:
finding them needs quiz ids, case ids and technique ids, which live in that module's ~350 KB JSON.
The home page cannot open eighteen of those to draw a progress bar.

So **a module reports itself**. `ModulePage` calls `onProgress(moduleRollup(data))` on mount and on
teardown — teardown being every navigation away, so leaving a module half-finished and starting
another records both. `HubProgress.setRollup` keeps about 120 bytes per module. Anything the hub needs to
know about work inside a module goes through that rollup; do not make the hub read module-local keys,
and do not widen the rollup without remembering it syncs to the account.

**Evidence is tiered, and only the top tier may claim completion.**

| Tier | Signal | Trust |
|---|---|---|
| Demonstrated | quiz ≥ 7 on the 10-question mix · capstone case **solved** | marked against an answer they could not see |
| Practised | quiz attempted · case opened · goals ticked | real work, proves nothing |
| Self-rated | spaced-review boxes, track chips | the learner's own opinion |

`demonstrated()` requires **every** demonstrated source a module offers, not any one of them. An
earlier version accepted the quiz alone, and a module with 8/10 and none of its three cases solved
vanished from "Still open" as though finished.

**Beware a flag that conflates *saw the answer* with *got it right*.** `capstone`'s `shown` is set both
when the plan is correct and when the hints run out, which is why `solved` had to be added beside it.
The same mistake shipped in the Daily Mix, where "Still learning" ticked the row and struck it through
while the scheduler was simultaneously booking it for tomorrow. Separate *attempted* from *correct*
in the state, not just in the wording.

**Do not make the learner press a button to record what already happened.** Quiz scores reached the
hub only via a "Save score to Study Hub" link; anyone who finished a quiz and navigated away lost it.
The data was in `qz-p<n>` the whole time.

---

## 5. Layout conventions

- **Left rail means "contents of this page"** (`.gn-rail`, module pages). **Right rail means "your
  status"** (`.hub-rail`, home). One position, one meaning — do not give left a second job.
- Breakpoints are **901px** (rail ↔ no rail) and **560px**. Do not invent others.
- **Rail markup goes after `#view` in the DOM.** Below 901px it then falls after the page content with
  focus order still matching the screen. Reordering with CSS does not, and that is an accessibility bug.
- Below 901px the same summary rides the crumb bar's `gn-band` slot as one sticky line. That slot is
  free on hub routes and costs no vertical space. A drawer suits a table of contents; it is wrong for
  anything people are meant to notice — burying the mix is what made it undiscoverable the first time.
- **An element the router hides with `hidden` must also be hidden by the stylesheet** wherever the
  layout would otherwise still place it (see the `[hidden]` trap in §3). `.hub-rail` rendered at the
  bottom of every phone page, repeating the chip, until `@media (max-width:900px){.hub-rail{display:none}}`.
- **Do not say the same thing twice on one screen.** The "Up next" card repeated the hero's Continue
  button, and "Still open" repeated both. If a panel lists items, every listed item must show the
  evidence that earned its place — a card of all-zero bars gives the reader no reason for its presence.
- Status panels belong beside the content, not on top of it. Two stacked status cards put ~720 px
  between the top of home and the page's own first words.

---

## 6. Add behaviour by content flag, not by branching on slug

New features are keyed to the presence of content, so modules without that content keep the old
path and rollback is deleting a key. Current flags:

| Key | Turns on |
|---|---|
| `header.layout: "bands"` | the "Put it together" band layout |
| `cx.cases` (length > 1) | multi-case capstone with case chips |
| `cases[].covers` | numbered symptoms + "Fixes ▾" mapping (replaces the free-text box) |
| `cases[].hints` | holds the answer back and gives escalating hints |
| `cases[].whyFirst` | the one-tap ordering question |
| `cx.capLabels` | names a capstone choice that is not a technique of this module |
| `mix` in **hub.json** | the Daily Mix card on the home page. `mods` scopes which modules its items come from, so the rollout is a content edit; deleting the key removes the card |

Keep it that way. `if (slug === 'eval')` anywhere in `src/presentation` is a bug.

---

## 7. Editing content safely

Module JSON is UTF-8, minified, **no trailing newline**. Round-trip it so the formatting survives:

```python
import json
p = 'src/content/site/modules/eval.json'
d = json.load(open(p, encoding='utf-8'))
...                                     # mutate d
open(p, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, separators=(',', ':')))
```

`sed` on these files will corrupt them. Hand-editing them is not realistic at 350 KB on one line.

### Recipe: add capstone cases to a module

1. Read only what you need: `techniques` (`id`, `name`, `q`, `remember`, `use`, `pitfalls`) and the
   existing `cx.capstone`.
2. Write three cases whose **first moves differ** — a test enforces this. If all three reward the
   same opening technique, the module teaches a reflex instead of a judgement.
3. Per case: a verdict for **every** technique (no unjudged free picks), a `why` for each, three
   hint levels for each essential, a `drop` question for each not-needed, `covers` the same length
   as `evidence`, `order`, `firstWhy` (never for the correct first step), `firstHint`, `whyFirst`,
   `model`, `note`.
4. Set `cx.cases` and `cx.capstone = null`.
5. `npx vitest run tests/presentation/site.test.ts -t "authored capstone"` — 2 s, and it checks
   all of the above.

Hint levels mean something specific: **level 1 asks about the symptom and must not name the
technique**, level 2 narrows the family, level 3 names it. A level-1 hint that names the technique
is just the answer with extra clicks.

---

## 8. Contracts the tests already enforce

Do not re-derive these by reading the renderer:

- every technique in a module is judged by every case; nothing unknown is judged
- exactly the essentials have hints, exactly 3 levels each
- exactly the not-needed ones have a drop question
- every essential is reachable from some symptom, or the answer can never be unlocked
- `firstWhy` has no entry for the correct first step
- the three cases do not share a first move
- every capstone choice is pickable and has a display name (catches ghost ids)
- all 18 stylesheets carry every class the renderers emit and the 9 band tokens
- a module without `layout: "bands"` still renders the original stacked page and capstone
- every stylesheet carries `[hidden]{display:none!important}` (21 files)
- the Daily Mix picks only from the modules `hub.mix.mods` names, and fills to `goal`
- a day's case is never answered by another row of the same day, across the whole rotation
- a case question never contains its own answer, for every case in scope
- an item not got is never ticked: `done`, `miss` and `seen` are separate counts
- the full mix card renders on `#review` and never on home; the rail renders only on home
- "Still open" never lists the module the hero's Continue button already names
- the Daily Mix stylesheet rules use `--t`, never `--accent`

---

## 9. Restraint

- Do not reformat, re-indent or "tidy" a file you are otherwise not changing.
- Working on one module means touching **that** module's two files. Shared code is the exception,
  and then all 18 change together, scripted, in one pass.
- Prefer appending a CSS block over rewriting a stylesheet.
- Do not bulk-generate authored teaching content. The capstone cases, hints and reasons are the
  product; plausible-sounding generated versions teach the wrong instincts and are worse than the
  single case a module already has. One module at a time, read before accepting.
- Do not re-read a file to confirm an edit landed. `Edit`/`Write` fail loudly.
- **Prove a new test fails without its fix.** Delete the fix, watch it go red, put it back. A test for
  the "Still open" duplicate passed with the fix removed, because the rollups it relied on are only
  written by a module page and the list was empty either way. A green test that cannot fail is worse
  than no test: it reads as coverage.
- **Run the app, not only the suite, for anything visual.** jsdom ignores `@media`, does not resolve a
  cascade of undefined custom properties, and lacks `CSS.escape`. Three shipped bugs in this file were
  invisible to it. Headless Chrome over the DevTools protocol needs no dependency: Node has a global
  `WebSocket` and `fetch`, so a ~40-line script can seed storage, click, and read `getComputedStyle`.
- When a screenshot looks wrong, probe the live DOM before concluding anything. A blank band turned out
  to be the `.gn-enter` animation mid-flight, not a rendering failure.
