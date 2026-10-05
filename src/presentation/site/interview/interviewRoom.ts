// @ts-nocheck -- Interview Room logic carried over verbatim from the course site; it mounts into interview.body.html.
/**
 * Interview Room: drills (rank three candidate answers and tag what each misses), written mock interviews with a
 * scorecard (graded by Claude when available, otherwise offline), and practice history.
 */
export function mountInterviewRoom(D, sub = '') {
const KEY = 'aam-iv-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SC = Object.fromEntries(D.scen.map(s => [s.id, s]));
const TAGN = Object.fromEntries(D.tags.map(t => [t.id, t.name]));
const Q = ['strong', 'average', 'weak'];
const LABEL = {strong: 'Strong', average: 'Average', weak: 'Weak'};

/* ---------- state and storage ---------- */
let st = {v: 1, att: []}, ref = null, mode = 'local', busy = false, again = false;
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && Array.isArray(s.att)) st = s; } catch (e) {}
function merge(a, b) {
  const seen = new Set(), att = [];
  for (const x of [...(a.att || []), ...(b.att || [])]) { const k = x.at + '|' + x.s + '|' + x.set; if (!seen.has(k)) { seen.add(k); att.push(x); } }
  att.sort((x, y) => x.at - y.at);
  const mk = [], ms = new Set();
  for (const x of [...(a.mk || []), ...(b.mk || [])]) { if (!ms.has(x.id)) { ms.add(x.id); mk.push(x); } }
  mk.sort((x, y) => x.at - y.at);
  return {v: 1, att: att.slice(-400), mk: mk.slice(-150)};
}
async function save() {
  try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  if (!ref) return; if (busy) { again = true; return; } busy = true;
  try { await ref.set(JSON.parse(JSON.stringify(st))); }
  catch (e) { if (e && ['not_granted','revoked','invalid_argument','capability_removed','capability_disabled'].includes(e.code)) { ref = null; mode = 'local'; status(); } }
  busy = false; if (again) { again = false; save(); }
}
function status() {
  $('status').textContent = mode === 'db' ? 'Your practice history is saved to your Claude account, so it follows you across devices.' : 'Your practice history is saved in this browser only.';
}
(async () => { try {
  if (!window.claude || !window.claude.use) return;
  const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
  if (!db || !user) return; const uid = await user.id(); if (!uid) return;
  const r = db.doc('data/users/' + uid + '/interview'); const snap = await r.get();
  if (snap.exists) st = merge(st, snap.data() || {});
  ref = r; mode = 'db'; status(); save(); renderAll();
} catch (e) {} })();

/* ---------- helpers ---------- */
function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3800); }
async function copy(text, btn) {
  try { await navigator.clipboard.writeText(text); toast('Copied: ' + text); }
  catch (e) { const code = btn && btn.previousElementSibling; if (code) { const r = document.createRange(); r.selectNodeContents(code); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } toast('Press Ctrl+C or long-press to copy the selected text.'); }
}
const attFor = sid => st.att.filter(a => a.s === sid);
const pct = x => Math.round(x * 100) + '%';
function best(sid) { const A = attFor(sid); return A.length ? Math.max(...A.map(a => a.score)) : null; }
function tagStats() {
  const o = Object.fromEntries(D.tags.map(t => [t.id, [0, 0]]));
  for (const a of st.att) for (const [k, v] of Object.entries(a.pt || {})) if (o[k]) { o[k][0] += v[0]; o[k][1] += v[1]; }
  return o;
}
function weakestTag() {
  const ts = tagStats(); let w = null;
  for (const [k, [r, n]] of Object.entries(ts)) if (n >= 3) { const acc = r / n; if (!w || acc < w.acc) w = {id: k, acc}; }
  return w && w.acc < 0.85 ? w : null;
}
function suggest() {
  const order = D.scen.map(s => s.id);
  const fresh = order.filter(id => !attFor(id).length);
  const lastSector = st.att.length ? SC[st.att[st.att.length - 1].s].sector : null;
  if (fresh.length) {
    const other = fresh.find(id => SC[id].sector !== lastSector) || fresh[0];
    return {id: other, why: `${fresh.length} scenario${fresh.length > 1 ? 's' : ''} not tried yet`};
  }
  const w = weakestTag();
  const ranked = order.map(id => ({id, b: best(id), n: attFor(id).length})).sort((a, b) => a.b - b.b || a.n - b.n);
  return {id: ranked[0].id, why: w ? `lowest best score; your weakest checklist idea is “${TAGN[w.id]}”` : 'lowest best score so far'};
}
function nextSet(sid) { const A = attFor(sid); if (!A.length) return 0; return A[A.length - 1].set === 1 ? 1 : 0; }
function revLink(r) { const x = D.rev[r]; return x ? `<a href="${x.url}" target="_blank" rel="noopener">${esc(x.label)} ↗</a>` : ''; }

/* ---------- drill ---------- */
let cur = null; // {sid, set, order:[qi...], rank:{pos:rank}, miss:{pos:Set}, done}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function startDrill(sid, set) {
  if (set == null) set = nextSet(sid);
  cur = {sid, set, order: shuffle([0, 1, 2]), rank: {}, miss: {0: new Set(), 1: new Set(), 2: new Set()}, done: false};
  $('spick').value = sid; renderDrill();
  try { history.replaceState(null, '', '#iv~' + sid); } catch (e) {}
}
function renderBrief() {
  const s = SC[cur.sid];
  $('brief').innerHTML = `<div class="meta"><span>${esc(s.id)}</span><span>${esc(s.sector)}</span><span>${esc(s.region)}</span>${s.money ? '<span class="money">Moves money</span>' : ''}<span>Answer set ${cur.set + 1} of 2</span></div>
    <h2>${esc(s.co)}: ${esc(s.title)}</h2><p>${esc(s.brief)}</p>
    <details><summary>Facts the interviewer would give if asked</summary><ul>${s.facts.map(f => `<li><b>${esc(f[0])}:</b> ${esc(f[1])}</li>`).join('')}</ul></details>`;
}
function renderDrill() {
  renderBrief();
  const set = D.drills[cur.sid].sets[cur.set];
  const letters = ['A', 'B', 'C'];
  $('answers').innerHTML = cur.order.map((qi, pos) => {
    const a = set.answers[qi];
    return `<article class="ans q-${a.q}${cur.done ? ' rev' : ''}" data-pos="${pos}">
      <div class="ahead"><h3>Answer ${letters[pos]}</h3>
        <div class="rk" role="radiogroup" aria-label="Rank for answer ${letters[pos]}">${[1, 2, 3].map(r => `<button type="button" role="radio" aria-checked="${cur.rank[pos] === r}" data-r="${r}" ${cur.done ? 'disabled' : ''}>${['Strongest', '2nd', 'Weakest'][r - 1]}</button>`).join('')}</div></div>
      <p class="atext">${esc(a.text)}</p>
      <div class="tglabel">What does it miss?</div>
      <div class="tgs">${D.tags.map(t => tagBtn(t, pos, a)).join('')}</div>
      ${cur.done ? verdict(a, pos) : ''}
    </article>`;
  }).join('');
  const ready = [0, 1, 2].every(p => cur.rank[p]);
  $('check').disabled = !ready || cur.done;
  $('check').hidden = cur.done;
  $('checkhint').textContent = cur.done ? '' : ready ? 'Ready to check.' : 'Give each answer a different rank to check.';
  if (!cur.done) $('result').hidden = true;
}
function tagBtn(t, pos, a) {
  const picked = cur.miss[pos].has(t.id);
  if (!cur.done) return `<button type="button" class="tg" aria-pressed="${picked}" data-t="${t.id}" title="${esc(t.hint)}">${esc(t.name)}</button>`;
  const misses = !a.covers.includes(t.id);
  let cls = 'plain';
  if (picked && misses) cls = 'ok'; else if (!picked && misses) cls = 'miss'; else if (picked && !misses) cls = 'wrong';
  const lbl = {ok: 'correctly marked as missing', miss: 'missing, not marked', wrong: 'marked, but the answer covers it', plain: 'covered, correctly left'}[cls];
  return `<button type="button" class="tg ${cls}" disabled aria-label="${esc(t.name)}: ${lbl}">${esc(t.name)}</button>`;
}
function verdict(a, pos) {
  const s = SC[cur.sid], correct = Q.indexOf(a.q) + 1, yours = cur.rank[pos];
  return `<div class="verdict"><div class="vq"><span class="pill ${a.q}">${LABEL[a.q]}</span><span>You ranked it ${['strongest', '2nd', 'weakest'][yours - 1]}${yours === correct ? ' ✓' : `; it is ${['the strongest', '2nd', 'the weakest'][correct - 1]}`}</span></div>
    <p>${esc(a.why)}</p>${a.trap != null ? `<p class="trap"><b>Trap:</b> ${esc(s.traps[a.trap])}</p>` : ''}</div>`;
}
$('answers').addEventListener('click', e => {
  if (cur.done) return;
  const card = e.target.closest('.ans'); if (!card) return; const pos = +card.dataset.pos;
  const rb = e.target.closest('.rk button');
  if (rb) {
    const r = +rb.dataset.r, other = Object.keys(cur.rank).find(p => cur.rank[p] === r && +p !== pos);
    if (other != null) { if (cur.rank[pos]) cur.rank[other] = cur.rank[pos]; else delete cur.rank[other]; }
    cur.rank[pos] = r; renderDrill();
    const nb = document.querySelector(`.ans[data-pos="${pos}"] .rk button[data-r="${r}"]`); if (nb) nb.focus();
    return;
  }
  const tb = e.target.closest('.tg');
  if (tb) { const t = tb.dataset.t, S = cur.miss[pos]; S.has(t) ? S.delete(t) : S.add(t); tb.setAttribute('aria-pressed', S.has(t)); }
});
$('check').addEventListener('click', () => {
  const set = D.drills[cur.sid].sets[cur.set];
  const rankOf = {}; cur.order.forEach((qi, pos) => rankOf[set.answers[qi].q] = cur.rank[pos]);
  const pairs = [['strong', 'average'], ['strong', 'weak'], ['average', 'weak']].filter(([x, y]) => rankOf[x] < rankOf[y]).length;
  let right = 0; const pt = Object.fromEntries(D.tags.map(t => [t.id, [0, 0]]));
  cur.order.forEach((qi, pos) => { const a = set.answers[qi];
    for (const t of D.tags) { const ok = cur.miss[pos].has(t.id) === !a.covers.includes(t.id); if (ok) right++; pt[t.id][0] += ok ? 1 : 0; pt[t.id][1]++; } });
  const score = Math.round((pairs / 3) * 40 + (right / 24) * 60);
  cur.done = true;
  st.att.push({at: Date.now(), s: cur.sid, set: cur.set + 1, pairs, tags: right, score, pt});
  save(); renderDrill(); renderResult(pairs, right, score); renderProgress(); renderSuggest();
});
function renderResult(pairs, right, score) {
  const set = D.drills[cur.sid].sets[cur.set], s = SC[cur.sid];
  const w = weakestTag();
  const phrase = `mock interview, senior, ${s.id}`;
  $('result').innerHTML = `<div class="sec-head"><h2>Your result</h2><p>Ranking counts for 40%, spotting what each answer misses for 60%.</p></div>
    <div class="scores"><div class="sc"><b>${score}%</b><span>Overall</span></div><div class="sc"><b>${pairs} / 3</b><span>Pairs ranked correctly</span></div><div class="sc"><b>${right} / 24</b><span>Checklist calls correct</span></div></div>
    <div><h3>What interviewers listen for</h3><ul class="listen">${set.listen.map(l => `<li><span>${esc(l.text)}</span>${revLink(l.rev)}</li>`).join('')}</ul></div>
    ${w ? `<p class="hint">Across your drills, you most often misjudge <b>${esc(TAGN[w.id])}</b> (${pct(w.acc)} correct). Look for it first in the next drill.</p>` : ''}
    <div class="bar"><button class="btn primary" type="button" data-act="other">Try answer set ${cur.set === 0 ? 2 : 1}</button><button class="btn" type="button" data-act="next">Next suggested scenario</button></div>
    <div class="copyrow"><span class="hint">Practise it out loud with the interview skill:</span><code>${esc(phrase)}</code><button class="btn" type="button" data-copy="${esc(phrase)}">Copy</button></div>`;
  $('result').hidden = false;
  $('result').scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start'});
}
$('result').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.copy) return copy(b.dataset.copy, b);
  if (b.dataset.act === 'other') { startDrill(cur.sid, cur.set === 0 ? 1 : 0); $('brief').scrollIntoView({block: 'start'}); }
  if (b.dataset.act === 'next') { startDrill(suggest().id); $('brief').scrollIntoView({block: 'start'}); }
});
$('spick').addEventListener('change', e => startDrill(e.target.value));
$('snext').addEventListener('click', () => startDrill(suggest().id));
function renderSuggest() { const g = suggest(); $('sugg').innerHTML = `Suggested: <b>${esc(SC[g.id].co)}</b> (${esc(g.why)})`; }

/* ---------- spoken tab ---------- */
$('spoken').addEventListener('click', e => { const b = e.target.closest('button[data-copy]'); if (b) copy(b.dataset.copy, b); });

/* ---------- progress ---------- */
function renderProgress() {
  const A = st.att, done = new Set(A.map(a => a.s)).size;
  const avg = A.length ? Math.round(A.reduce((x, a) => x + a.score, 0) / A.length) : null;
  const rk = A.length ? A.reduce((x, a) => x + a.pairs, 0) / (A.length * 3) : null;
  const tg = A.length ? A.reduce((x, a) => x + a.tags, 0) / (A.length * 24) : null;
  $('pstats').innerHTML = [[A.length, 'Drills done'], [`${done} / ${D.scen.length}`, 'Scenarios tried'], [rk == null ? '–' : pct(rk), 'Ranking accuracy'], [tg == null ? '–' : pct(tg), 'Checklist accuracy']]
    .map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join('');
  const ts = tagStats(), w = weakestTag();
  $('tbars').innerHTML = A.length ? D.tags.map(t => { const [r, n] = ts[t.id], acc = n ? r / n : 0;
    return `<div class="tbar${w && w.id === t.id ? ' low' : ''}"><span>${esc(t.name)}</span><span class="tr"><i style="width:${n ? acc * 100 : 0}%"></i></span><em>${n ? pct(acc) : '–'}</em></div>`; }).join('')
    : '<p class="empty">Finish a drill to see how well you spot each checklist idea.</p>';
  $('tnote').textContent = w ? `Focus next on “${TAGN[w.id]}”: ${D.tags.find(t => t.id === w.id).hint}.` : A.length ? 'No weak spot yet. Keep going across different sectors.' : '';
  const R = A.slice(-12).reverse();
  $('hist').innerHTML = R.length ? `<div class="tscroll"><table class="hist"><thead><tr><th>Date</th><th>Scenario</th><th>Set</th><th>Ranking</th><th>Checklist</th><th>Score</th></tr></thead><tbody>${R.map(a => `<tr><td>${new Date(a.at).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}</td><td>${esc(SC[a.s].co)}</td><td>${a.set}</td><td>${a.pairs}/3</td><td>${a.tags}/24</td><td><b>${a.score}%</b></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No drills yet.</p>';
  renderMocks();
  $('sgrid').innerHTML = D.scen.map(s => { const b = best(s.id);
    return `<button type="button" class="${b != null ? 'done' : ''}" data-s="${s.id}"><b>${s.id} · ${esc(s.sector)}</b>${esc(s.co)}<em>${b != null ? 'Best ' + b + '%' : 'Not tried'}</em></button>`; }).join('');
}
$('sgrid').addEventListener('click', e => { const b = e.target.closest('button[data-s]'); if (!b) return; selectTab('drill'); startDrill(b.dataset.s); $('brief').scrollIntoView({block: 'start'}); });

/* ================= Mock mode ================= */
const AREAN = Object.fromEntries(D.areas.map(a => [a.id, a.name]));
const AREA_IDS = D.areas.map(a => a.id);
const STAGE = {
  clarify: {name: 'Clarify', min: [3, 4]}, req: {name: 'Requirements', min: [0, 5]}, arch: {name: 'Architecture', min: [5, 10]},
  deep: {name: 'Deep dive', min: [5, 10]}, push: {name: 'Push-back', min: [0, 6]}, cost: {name: 'Cost and latency', min: [0, 5]}, wrap: {name: 'Wrap-up', min: [2, 5]}};
const FLOW = {Quick: ['clarify', 'arch', 'deep', 'wrap'], Full: ['clarify', 'req', 'arch', 'deep', 'push', 'cost', 'wrap']};
const FOCUS = {clarify: [], req: ['clarify', 'eval'], arch: ['ground', 'perms', 'approval'], push: [], cost: ['cost'], wrap: [],
  depth: ['fail', 'perms'], eval: ['eval'], safety: ['approval', 'audit'], costdeep: ['cost']};
const AREA_TAGS = {depth: ['fail', 'perms'], safety: ['approval', 'audit', 'perms'], eval: ['eval'], cost: ['cost']};
const PROBE = {
  clarify: 'Before we go further, what did you assume about scope and volume?',
  perms: 'Which of the agent’s tools can change anything, and which are read-only?',
  approval: 'Where does a person approve before something irreversible or high-stakes happens?',
  ground: 'Where does each fact in the agent’s reply come from?',
  eval: 'How would you know this works before launch? Give me a metric and a pass bar.',
  audit: 'If a customer complains next month, what record lets you reconstruct what the agent did?',
  fail: 'What happens when one of those calls times out, or the same request arrives twice?',
  cost: 'What load are you designing for at the peak, and what keeps cost and latency in check?'};
const DETECT = {
  perms: /read[- ]?only|least[- ]privilege|permission|scoped|write tool|only (create|raise|draft)|cannot (move|change|write|approve)|can't (move|change|write|approve)|allow[- ]?list|credential|no access/i,
  approval: /approv|human[- ]in|sign[- ]?off|signs off|reviewer|human review|a person (checks|decides|reviews)|confirm(s|ation)? (by|from|the)|maker[- ]checker|escalat|hand(s)? (it )?(off|over) to (a )?(human|person|staff)/i,
  ground: /ground|system of record|\breads? (the|its|from)|order (system|management)|ledger|policy system|loan system|live (availability|data|status)|from the (ledger|order|policy|loan|core|scheduling|bill|document|warehouse|help)|records?\b|cite|citation|retriev|\brag\b|look(s)? (it )?up|fetch(es|ed)? (the|live)|semantic layer/i,
  audit: /audit|\blog(s|ged|ging)?\b|trace|traceab|record (of|every|each)|stored? (the|every|each)|immutable/i,
  fail: /time[ -]?out|retr(y|ies)|idempot|fallback|circuit|de-?dup|duplicate|resum|checkpoint|degrad|graceful|can't confirm|cannot confirm|reconcil/i,
  cost: /cach|\brout(e|es|ing)\b|small(er)? model|batch|stream|queue|schedul|token (budget|cap)|cap(s)? (tokens|each)|prioriti|templat/i};
function detectTags(text, stage) {
  const out = new Set(Object.keys(DETECT).filter(k => DETECT[k].test(text)));
  const evalWords = /(test set|golden|label+ed|eval(uation)?|offline set|replay|past (tickets|requests|cases|calls|prs|returns|invoices)|a\/b|canary|red[- ]team)/i;
  const evalNum = /(\d|%|pass bar|release gate|gate|metric|accuracy|recall|precision|rate)/i;
  if (evalWords.test(text) && evalNum.test(text)) out.add('eval');
  if (stage === 'clarify' && /\?/.test(text)) out.add('clarify');
  if (/\b(I'?d|I would|first) (ask|clarify|check|confirm)|clarif|assum(e|ing)|how many|what volume|is it (just|only)/i.test(text)) out.add('clarify');
  return [...out];
}

let M = null, SAMPLE = null, DL = null;
(async () => { try { if (window.claude && window.claude.use) { SAMPLE = await window.claude.use('sample'); DL = await window.claude.use('downloads'); } } catch (e) {} mockAvail(); })();
function mockAvail() {
  const c = $('mclaude');
  if (!SAMPLE) { c.disabled = true; if (c.checked) { c.checked = false; $('moffline').checked = true; } $('mnote').textContent = 'The Claude interviewer is not available in this view, so mocks run offline.'; }
  else { c.disabled = false; mnoteUpdate(); }
  $('pscore').hidden = !SAMPLE;
}
function mnoteUpdate() {
  if (!SAMPLE) return;
  const q = document.querySelector('input[name="mlen"]:checked').value, cl = $('mclaude').checked;
  $('mnote').textContent = cl ? `Uses your Claude usage: about ${q === 'Quick' ? 5 : '12 to 20'} short calls, then one for scoring. Your first mock asks your permission.` : 'Offline: scripted follow-up questions and checklist-based scoring. Uses no Claude usage.';
}
$('msetup').addEventListener('change', mnoteUpdate);
$('mspick').innerHTML = D.scen.map(s => `<option value="${s.id}">${s.id} · ${esc(s.co)} · ${esc(s.sector)}</option>`).join('');

const fmtT = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
let tick = null;
function startMock() {
  const sid = $('mspick').value, level = document.querySelector('input[name="mlvl"]:checked').value;
  const length = document.querySelector('input[name="mlen"]:checked').value, mode = $('mclaude').checked && SAMPLE ? 'claude' : 'offline';
  M = {id: Date.now().toString(36), sid, level, length, mode, flow: FLOW[length], si: -1, fu: 0, push: 0, T: [], hints: 0, hintStage: new Set(),
       det: {}, probed: new Set(), deep: null, t0: Date.now(), st0: Date.now(), busy: false, facts: []};
  $('msetup').hidden = true; $('msession').hidden = false; $('mresult').hidden = true;
  const s = SC[sid];
  $('mhead').innerHTML = `<div class="meta"><span>${s.id}</span><span>${esc(s.sector)}</span>${s.money ? '<span class="money">Moves money</span>' : ''}<span>${level}</span><span>${length}</span><span>${mode === 'claude' ? 'Claude interviewer' : 'Offline'}</span></div><h2>${esc(s.co)}: ${esc(s.title)}</h2>`;
  clearInterval(tick); tick = setInterval(renderClock, 1000);
  nextStage();
  $('mtext').focus();
}
function stageKey() { return M.flow[M.si]; }
function stageMins(k) { return STAGE[k].min[M.length === 'Quick' ? 0 : 1]; }
function renderClock() {
  if (!M) return; const k = stageKey(); if (!k) return;
  const el = (Date.now() - M.st0) / 1000, lim = stageMins(k) * 60;
  $('mclock').textContent = `${STAGE[k].name}: ${fmtT(el)} of ${stageMins(k)}:00 · total ${fmtT((Date.now() - M.t0) / 1000)}`;
  $('mclock').classList.toggle('over', el > lim);
}
function say(who, text, extra) { M.T.push(Object.assign({who, stage: stageKey() || 'end', text}, extra || {})); renderTranscript(); }
function renderTranscript() {
  $('mlog').innerHTML = M.T.map(t => t.who === 'sys' ? `<p class="msys">${esc(t.text)}</p>` :
    `<div class="mb ${t.who}"><span>${t.who === 'iv' ? 'Interviewer' : 'You'}${t.hint ? ' · hint' : ''}</span><p>${esc(t.text)}</p></div>`).join('');
  $('mlog').scrollTop = $('mlog').scrollHeight;
  $('mstages').innerHTML = M.flow.map((k, i) => `<li class="${i < M.si ? 'done' : i === M.si ? 'now' : ''}">${STAGE[k].name}${k === 'deep' && M.deep ? ': ' + AREAN[M.deep] : ''}</li>`).join('');
  $('mtags').innerHTML = D.tags.map(t => { const d = M.det[t.id]; return `<span class="mt${d ? (d.hinted ? ' hinted' : ' on') : ''}" title="${esc(t.hint)}">${esc(t.name)}</span>`; }).join('');
  const k = stageKey();
  $('mready').hidden = k !== 'clarify';
  $('mnextst').hidden = k === 'clarify' || k === 'wrap';
  $('msend').textContent = k === 'clarify' ? 'Ask' : 'Send';
  $('mtext').placeholder = k === 'clarify' ? 'Ask a clarifying question…' : 'Type your answer…';
}
function chooseDeep() {
  const cnt = a => AREA_TAGS[a].filter(t => M.det[t] && !M.det[t].hinted).length / AREA_TAGS[a].length;
  return ['depth', 'safety', 'eval', 'cost'].reduce((b, a) => cnt(a) < cnt(b) ? a : b, 'depth');
}
function nextStage() {
  M.si++; M.fu = 0; M.st0 = Date.now();
  const k = stageKey(), s = SC[M.sid];
  if (!k) return finishMock();
  let q;
  if (k === 'clarify') q = `${s.brief} Take a moment. What would you like to ask before you design?`;
  else if (k === 'deep') { M.deep = chooseDeep(); q = `Let's go deeper on ${AREAN[M.deep].toLowerCase()}. ${s.deep[M.deep]}`; }
  else if (k === 'push') q = s.push[0];
  else if (k === 'cost') q = M.deep === 'cost' ? 'How does your design behave at the peak, and what gives way first?' : s.deep.cost;
  else if (k === 'wrap') { q = 'Please summarise your design in a minute and tell me what you would build first.';
    if (M.length === 'Quick' && s.money && !(M.det.approval && !M.det.approval.hinted)) q += ' Also: where does a person approve before money moves?'; }
  else q = s.deep[k];
  say('sys', `Stage ${M.si + 1} of ${M.flow.length}: ${STAGE[k].name}${k === 'deep' ? ' (' + AREAN[M.deep] + ')' : ''}`);
  say('iv', q);
}
function setBusy(on, msg) { M.busy = on; $('msend').disabled = on; $('mthink').hidden = !on; if (msg) $('mthink').textContent = msg; }
function sampleErr(e) {
  if (e && (e.code === 'not_granted' || e.code === 'sampling_disabled' || e.code === 'capability_disabled' || e.code === 'capability_removed')) {
    M.mode = 'offline'; say('sys', 'Claude was not allowed for this page, so the rest of this mock runs offline.');
  } else if (e && e.code === 'rate_limited') { M.mode = 'offline'; say('sys', 'Claude is busy or your usage limit is reached, so the rest of this mock runs offline.'); }
  else say('sys', 'Claude could not answer that turn, so the offline interviewer stepped in.');
}
const briefCtx = s => `Scenario: ${s.co}: ${s.title}. Brief: ${s.brief}`;
async function onSend() {
  if (!M || M.busy) return;
  const text = $('mtext').value.trim(); if (!text) return;
  $('mtext').value = ''; const k = stageKey(), s = SC[M.sid];
  say('me', text);
  for (const t of detectTags(text, k)) if (!M.det[t]) M.det[t] = {stage: k, hinted: M.hintStage.has(M.si)};
  renderTranscript();
  if (k === 'clarify') return answerClarify(text);
  if (k === 'wrap') return finishMock();
  if (k === 'push') {
    M.push++;
    if (M.push >= 3) { say('iv', 'Fair enough, I can see your reasoning. Let’s move on.'); return nextStage(); }
    let c = M.push === 1 ? 'I hear you, but the pressure is real. What exactly would you allow, and what stops it going wrong?' : 'Suppose we go with your version. How would we know in a month that it is working?';
    if (M.mode === 'claude') { setBusy(true, 'Interviewer is thinking…');
      try { const r = await SAMPLE(`You are a fair, firm interviewer in an agentic-AI system-design mock interview. ${briefCtx(s)}\nYour push-back: ${s.push[0]}\nConversation in this stage:\n${stageText('push')}\nPush back once more in under 50 words, probing the weakest point of the candidate's last reply. Do not concede yet, do not teach, do not praise. Reply with the question only.`, {modelTier: 'quick', cache: false}); c = r.text.trim() || c; }
      catch (e) { sampleErr(e); } setBusy(false); }
    say('iv', c); return;
  }
  // other stages: maybe a follow-up
  if (M.fu >= 2) return nextStage();
  let f = null;
  if (M.mode === 'claude') { setBusy(true, 'Interviewer is thinking…');
    try { const r = await SAMPLE.json(`You are a fair interviewer in an agentic-AI system-design mock interview (${M.level} level). ${briefCtx(s)}\nStage: ${STAGE[k].name}${k === 'deep' ? ' (' + AREAN[M.deep] + ')' : ''}.\nThis stage so far:\n${stageText(k)}\nDecide whether ONE follow-up question would probe a real gap in what the candidate said in this stage, such as a missing failure case, metric, permission, approval step or number. Keep it under 40 words and about what they said. Do not teach or praise. ${M.fu ? 'You already asked one follow-up in this stage, so only ask if the gap is important.' : ''}\nReply with only JSON: {"followup": "question"} or {"followup": null}.`, {modelTier: 'quick', cache: false});
      f = r && typeof r.followup === 'string' && r.followup.trim() ? r.followup.trim() : null; }
    catch (e) { sampleErr(e); f = offlineProbe(k); }
    setBusy(false);
  } else f = offlineProbe(k);
  if (f) { M.fu++; say('iv', f); } else nextStage();
}
function offlineProbe(k) {
  const focus = k === 'deep' ? FOCUS[M.deep === 'cost' ? 'costdeep' : M.deep] : FOCUS[k] || [];
  const t = focus.find(x => !M.det[x] && !M.probed.has(x));
  if (!t) return null; M.probed.add(t); return PROBE[t];
}
function stageText(k) { return M.T.filter(t => t.stage === k && t.who !== 'sys').map(t => `${t.who === 'iv' ? 'Interviewer' : 'Candidate'}: ${t.text}`).join('\n').slice(-6000); }
async function answerClarify(q) {
  const s = SC[M.sid];
  if (M.mode === 'claude') { setBusy(true, 'Interviewer is thinking…');
    try { const r = await SAMPLE(`You are the client in an agentic-AI system-design mock interview. Answer the candidate's clarifying question in under 60 words. Use these facts; if they do not cover it, give a short reasonable answer that fits the scenario and stays consistent with earlier answers. Do not design anything for the candidate.\n${briefCtx(s)}\nFacts:\n${s.facts.map(f => '- ' + f[0] + ': ' + f[1]).join('\n')}\nEarlier answers:\n${M.facts.join('\n') || 'none'}\nQuestion: ${q}`, {modelTier: 'quick', cache: false});
      const a = r.text.trim(); M.facts.push(a); setBusy(false); return say('iv', a); }
    catch (e) { sampleErr(e); setBusy(false); } }
  say('iv', factMatch(q));
}
const ALIAS = [[/how many|volume|per day|a day|peak|load|traffic|scale|busy|queries|requests|calls a day/, 'volume|peak|a day|requests|queries|calls|chats'],
  [/rule|regulat|rbi|sebi|irdai|dpdp|law|compl|legal/, 'rules|rbi|sebi|irdai|dpdp|regulat|consent'],
  [/refund|revers|money|pay|approve|auto/, 'money|refund|revers|approv|payment|decision|sign off'],
  [/language|hindi|english|channel|whatsapp|app|voice/, 'language|hindi|english|channel|whatsapp|app'],
  [/system|api|data|ledger|source|integrat/, 'system|ledger|api|data|warehouse|portal|content'],
  [/latency|fast|time|second|minute|sla|deadline/, 'latency|second|minute|hour|within|timing']];
function factMatch(q) {
  const s = SC[M.sid], ql = q.toLowerCase(), words = ql.match(/[a-z]{4,}/g) || [];
  const extra = ALIAS.filter(([re]) => re.test(ql)).map(([, w]) => new RegExp(w, 'i'));
  if (extra.length) { const hit = s.facts.filter(f => extra.some(re => re.test(f[0] + ' ' + f[1]))); if (hit.length) return hit.slice(0, 2).map(f => f[1]).join(' '); }
  const scored = s.facts.map(f => ({f, n: words.filter(w => (f[0] + ' ' + f[1]).toLowerCase().includes(w.slice(0, 5))).length})).sort((a, b) => b.n - a.n);
  if (!scored[0] || !scored[0].n) return 'Good question. That is not fixed yet, so state a reasonable assumption and design for it.';
  return scored.filter(x => x.n === scored[0].n).slice(0, 2).map(x => x.f[1]).join(' ');
}
function onHint() {
  if (!M || M.busy) return;
  if (M.hintStage.has(M.si)) { say('sys', 'One hint per stage. Try answering with what you have.'); return; }
  const k = stageKey(); M.hintStage.add(M.si); M.hints++;
  const focus = k === 'deep' ? FOCUS[M.deep === 'cost' ? 'costdeep' : M.deep] : k === 'clarify' ? ['clarify'] : (FOCUS[k] || []);
  const t = focus.find(x => !M.det[x]) || D.tags.find(x => !M.det[x.id])?.id;
  const tag = D.tags.find(x => x.id === t);
  say('iv', tag ? `Hint: think about ${tag.name.toLowerCase()}: ${tag.hint}.` : 'Hint: you have covered the main ideas; add numbers and trade-offs.', {hint: true});
}

/* ---------- scoring ---------- */
const MONEY_CAP = (s, sc) => s.money && sc.safety === 1;
function bandOf(sc) { const v = Object.values(sc).filter(x => x); if (!v.length) return 'not yet'; const a = v.reduce((x, y) => x + y, 0) / v.length;
  return {avg: a, band: a >= 3.5 ? 'strong' : a >= 2.75 ? 'solid' : a >= 2 ? 'borderline' : 'not yet'}; }
function levelBar(level, sc, capped) {
  const v = Object.values(sc).filter(x => x); if (!v.length || capped) return false; const a = v.reduce((x, y) => x + y, 0) / v.length;
  if (level === 'SDE-2') return a >= 2.5 && (sc.req || 0) >= 3 && (sc.arch || 0) >= 3;
  if (level === 'Senior') return a >= 2.75 && v.every(x => x >= 2);
  return a >= 3.5 && v.filter(x => x === 4).length >= 2 && v.every(x => x >= 3);
}
function scoredAreas(M) {
  if (M.length === 'Full') return AREA_IDS;
  const a = ['req', 'arch', 'comm', M.deep]; if (SC[M.sid].money) a.push('safety');
  return [...new Set(a.filter(Boolean))];
}
function offlineScore() {
  const has = t => M.det[t] && !M.det[t].hinted;
  const mine = M.T.filter(t => t.who === 'me'), all = mine.map(t => t.text).join('\n');
  const inStage = k => mine.filter(t => t.stage === k).map(t => t.text).join('\n');
  const words = all.split(/\s+/).length, num = /\d/.test(all);
  const c = (x) => Math.max(1, Math.min(4, x));
  const sc = {
    req: c(1 + (has('clarify') ? 1 : 0) + (/\d+\s?(%|ms|seconds?|minutes?|hours?)|\bunder \d|target/i.test(inStage('req') + inStage('clarify')) ? 1 : 0) + (/non-?goal|out of scope|riskiest|assumption/i.test(all) ? 1 : 0)),
    arch: c(1 + (has('ground') ? 1 : 0) + ((has('perms') || has('approval')) ? 1 : 0) + (/workflow|pipeline|state machine|deterministic|plain code|rules? (handle|engine)/i.test(all) && words > 120 ? 1 : 0)),
    depth: c(1 + (has('fail') ? 1 : 0) + (has('perms') ? 1 : 0) + (/context|memory|step limit|max(imum)? steps|loop|injection|untrusted|state/i.test(all) ? 1 : 0)),
    eval: has('eval') ? (/online|drift|sampl|monitor|calibrat|weekly|shadow/i.test(all) ? 4 : 3) : (/test|eval|pilot|judge/i.test(all) ? 2 : 1),
    safety: c(1 + (has('approval') ? 1 : 0) + (has('perms') ? 1 : 0) + ((has('audit') || /mask|pii|consent|retention|dpdp|rbi|sebi|irdai|encrypt/i.test(all)) ? 1 : 0)),
    cost: has('cost') ? (num ? (/degrad|queue|fallback|cost per|holding message/i.test(all) ? 4 : 3) : 2) : (/cost|latency|cheap|fast/i.test(all) ? 2 : 1),
    comm: c(2 + (/first|then|finally|trade-?off|because/i.test(all) ? 1 : 0) + (inStage('wrap').split(/\s+/).length > 40 && /trade-?off|build first|start with/i.test(inStage('wrap')) ? 1 : 0))};
  const keep = scoredAreas(M); const scores = {};
  for (const a of AREA_IDS) scores[a] = keep.includes(a) ? {score: sc[a], evidence: 'Checklist-based estimate.'} : {score: null, evidence: 'Not tested in this mock.'};
  const s = SC[M.sid];
  const points = s.model.map(([t]) => has(t) ? 'covered' : M.det[t] ? 'partial' : 'missed');
  const missing = s.model.map(([t]) => t).filter(t => !has(t));
  const fixes = missing.slice(0, 3).map(t => ({text: FIX[t], rev: revForTag(s, t), panel: (TAG_PANEL[t] || [])[0]}));
  return {scores, tags: D.tags.map(t => t.id).filter(has), strengths: D.tags.filter(t => has(t.id)).slice(0, 2).map(t => STRENGTH[t.id]), fixes, points, traps: [], by: 'offline'};
}
const STRENGTH = {clarify: 'You clarified scope and volume before designing.', perms: 'You separated read-only tools from the few that can change anything.',
  approval: 'You kept a person in charge of irreversible or high-stakes steps.', ground: 'You grounded answers in real records rather than the model.',
  eval: 'You set a measurable bar for evaluation.', audit: 'You planned an audit trail.', fail: 'You handled timeouts and repeated requests safely.', cost: 'You tied cost and latency controls to the real load.'};
const FIX = {clarify: 'Ask about scope, volume and what the agent may do before designing.', perms: 'Say which tools are read-only and which can write.',
  approval: 'Name where a person approves irreversible or money-moving steps.', ground: 'Say which system of record each answer comes from.',
  eval: 'Give an evaluation set, a metric and a pass bar.', audit: 'Describe what is logged for each tool call and decision.',
  fail: 'Explain timeouts, retries with idempotency and the safe fallback message.', cost: 'Size the peak and name how you keep cost and latency down.'};
const TAG_PANEL = {clarify: [1, 13], perms: [8, 12], approval: [15, 2], ground: [1, 4, 5], eval: [1, 11], audit: [15, 11], fail: [8, 11], cost: [3, 6]};
function revForTag(s, t) { const ps = TAG_PANEL[t] || []; return s.rev.find(r => ps.includes(+r.split('#')[0].slice(1))) || null; }
async function claudeScore(transcript, meta) {
  const s = SC[meta.sid];
  const rub = D.areas.map(a => `${a.id} (${a.name}): 1=${a.anchors[1]} 2=${a.anchors[2]} 3=${a.anchors[3]} 4=${a.anchors[4]}`).join('\n');
  const prompt = `Score this agentic-AI system-design mock interview fairly and strictly. Level: ${meta.level}. Length: ${meta.length}.
${briefCtx(s)}
Rubric (score each area 1-4 by best fit; meeting most of a level's items counts as that level; a 4 needs level 3 mostly met plus one "also" item):
${rub}
Rules: judge only what the candidate said. Ideas the candidate gave only after a line marked [HINT] do not count. An area where the candidate fell into a listed trap cannot score 4. ${meta.length === 'Quick' ? `Quick mock: score only ${meta.areas.join(', ')}; give null for other areas unless the candidate clearly addressed them unprompted.` : ''}
Checklist tags (mark only ideas stated clearly and without a hint): ${D.tags.map(t => `${t.id} = ${t.hint}`).join('; ')}.
Strong-answer points, in order: ${s.model.map(([t, p], i) => `${i + 1}. [${t}] ${p}`).join(' ')}
Traps, in order: ${s.traps.map((t, i) => `${i}. ${t}`).join(' ')}
Revision sections you may cite: ${s.rev.join(', ')}.
Transcript:
${transcript}

Reply with only JSON:
{"scores":{"req":{"score":3,"evidence":"short quote or paraphrase"},"arch":{...},"depth":{...},"eval":{...},"safety":{...},"cost":{...},"comm":{...}},
 "tags":["clarify"], "strengths":["one specific strength","another"], "fixes":[{"text":"fix in under 15 words","rev":"one revision id or null"}, 3 items],
 "points":["covered|partial|missed|not tested" for each of the ${s.model.length} strong-answer points], "traps":[indices of traps fallen into]}`;
  const r = await SAMPLE.json(prompt, {modelTier: 'default', cache: false});
  const out = {scores: {}, tags: [], strengths: [], fixes: [], points: [], traps: [], by: 'claude'};
  for (const a of AREA_IDS) { const x = r && r.scores && r.scores[a]; const n = x && Number.isInteger(x.score) && x.score >= 1 && x.score <= 4 ? x.score : null;
    out.scores[a] = {score: meta.areas.includes(a) || n ? n : null, evidence: x && typeof x.evidence === 'string' ? x.evidence.slice(0, 240) : ''}; }
  if (!Object.values(out.scores).some(x => x.score)) throw {code: 'invalid_json'};
  out.tags = Array.isArray(r.tags) ? r.tags.filter(t => TAGN[t]) : [];
  out.strengths = Array.isArray(r.strengths) ? r.strengths.filter(x => typeof x === 'string').slice(0, 2) : [];
  out.fixes = Array.isArray(r.fixes) ? r.fixes.filter(f => f && typeof f.text === 'string').slice(0, 3).map(f => ({text: f.text.slice(0, 160), rev: s.rev.includes(f.rev) ? f.rev : null})) : [];
  out.points = s.model.map((_, i) => ['covered', 'partial', 'missed', 'not tested'].includes(r.points && r.points[i]) ? r.points[i] : 'missed');
  out.traps = Array.isArray(r.traps) ? r.traps.filter(i => Number.isInteger(i) && s.traps[i]) : [];
  return out;
}
function transcriptText(T) { let st = ''; return T.map(t => { let h = ''; if (t.stage !== st) { st = t.stage; h = `\n## ${STAGE[st] ? STAGE[st].name : st}\n`; }
  return h + (t.who === 'sys' ? `(${t.text})` : `${t.who === 'iv' ? 'Interviewer' : 'Candidate'}${t.hint ? ' [HINT]' : ''}: ${t.text}`); }).join('\n'); }
async function finishMock() {
  if (!M || M.done) return; M.done = true; clearInterval(tick);
  const meta = {sid: M.sid, level: M.level, length: M.length, areas: scoredAreas(M)};
  let R = null;
  if (M.mode === 'claude' && M.T.some(t => t.who === 'me')) {
    setBusy(true, 'Scoring your interview. This can take up to a minute…');
    try { R = await claudeScore(transcriptText(M.T), meta); } catch (e) { sampleErr(e); }
    setBusy(false);
  }
  if (!R) R = offlineScore();
  const rec = record(R, {sid: M.sid, level: M.level, length: M.length, mode: M.mode, hints: M.hints, id: M.id});
  showResult(rec, R, M.T);
  saveTranscript(rec, M.T);
}
function record(R, m) {
  const sc = Object.fromEntries(AREA_IDS.map(a => [a, R.scores[a] ? R.scores[a].score : null]));
  const b = bandOf(sc), capped = MONEY_CAP(SC[m.sid], sc);
  const rec = {id: m.id, at: Date.now(), s: m.sid, level: m.level, length: m.length, mode: m.mode, hints: m.hints || 0, sc, tags: R.tags,
    band: capped && ['strong', 'solid'].includes(b.band) ? 'borderline' : b.band, avg: Math.round((b.avg || 0) * 100) / 100, capped, bar: levelBar(m.level, sc, capped),
    fixes: R.fixes.map(f => f.text)};
  st.mk = (st.mk || []).concat(rec).slice(-150); save(); renderProgress();
  return rec;
}
async function saveTranscript(rec, T) {
  if (!ref) return;
  try { const db = await window.claude.use('db'); const user = await window.claude.use('user'); const uid = await user.id();
    await db.doc('data/users/' + uid + '/mocks/' + rec.id).set({rec, T: T.slice(0, 200).map(t => ({who: t.who, stage: t.stage, text: String(t.text).slice(0, 4000), hint: !!t.hint}))}); } catch (e) {}
}
function showResult(rec, R, T) {
  const s = SC[rec.s]; LAST = {rec, R, T};
  $('msession').hidden = true; $('mresult').hidden = false;
  const v = Object.values(rec.sc).filter(x => x);
  const rows = AREA_IDS.map(a => `<tr><td>${esc(AREAN[a])}</td><td class="num">${rec.sc[a] || 'n/a'}</td><td>${esc(R.scores[a].evidence || '')}</td></tr>`).join('');
  const strong = D.drills[rec.s].sets[0].answers[0].text;
  const mine = (T || []).filter(t => t.who === 'me' && t.stage !== 'clarify').map(t => t.text).join('\n\n');
  $('mresult').innerHTML = `<div class="sec-head"><h2>Scorecard</h2><p>${esc(s.co)} · ${rec.level} · ${rec.length} · ${rec.mode === 'claude' ? 'scored by Claude' : rec.mode === 'offline' ? 'offline estimate' : 'spoken mock'}</p></div>
    ${R.by === 'offline' ? '<p class="hint">Offline scoring checks for key ideas, not their quality, so treat these numbers as a rough guide.</p>' : ''}
    <div class="scores"><div class="sc"><b>${rec.band[0].toUpperCase() + rec.band.slice(1)}</b><span>Overall band</span></div><div class="sc"><b>${rec.bar ? 'Met' : 'Not met'}</b><span>${rec.level} bar</span></div><div class="sc"><b>${v.length ? (v.reduce((x, y) => x + y, 0) / v.length).toFixed(2) : '–'}</b><span>Average of ${v.length} scored areas${rec.capped ? ' · capped' : ''}</span></div></div>
    <div class="tscroll"><table class="hist score"><thead><tr><th>Area</th><th>Score</th><th>Evidence</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="cols"><div class="box"><h3>Three fixes</h3><ol>${R.fixes.map(f => `<li>${esc(f.text)}${f.rev ? '<br>' + revLink(f.rev) : f.panel && D.panels[f.panel] ? `<br><a href="${D.panels[f.panel].url}" target="_blank" rel="noopener">${esc(D.panels[f.panel].name)} ↗</a>` : ''}</li>`).join('') || '<li>No major gaps found.</li>'}</ol></div>
      <div class="box"><h3>Strengths</h3><ul>${R.strengths.map(x => `<li>${esc(x)}</li>`).join('') || '<li>Keep practising to build a baseline.</li>'}</ul></div></div>
    <div class="box"><h3>What a strong answer covers</h3><ul class="pts">${s.model.map(([t, p], i) => `<li class="p-${(R.points[i] || 'missed').replace(' ', '')}"><span class="pill">${esc(R.points[i] || 'missed')}</span> ${esc(p)}</li>`).join('')}</ul>
      ${R.traps.length ? `<p class="trap"><b>Trap:</b> ${R.traps.map(i => esc(s.traps[i])).join(' ')}</p>` : ''}</div>
    <div class="cols"><details class="box"><summary>Your answers</summary><p class="pre">${esc(mine || 'No answers recorded.')}</p></details>
      <details class="box"><summary>A strong answer, for comparison</summary><p class="pre">${esc(strong)}</p></details></div>
    <div class="bar"><button class="btn primary" type="button" id="mnew">Start another mock</button><button class="btn" type="button" id="mdl" ${DL ? '' : 'hidden'}>Download transcript and feedback</button></div>`;
  $('mresult').scrollIntoView({block: 'start'});
}
let LAST = null;
function markdown() {
  const {rec, R, T} = LAST, s = SC[rec.s];
  return `# Mock interview: ${s.co}\n\n${s.title}\n\nDate: ${new Date(rec.at).toISOString().slice(0, 10)} · Level: ${rec.level} · Length: ${rec.length} · Scoring: ${rec.mode === 'claude' ? 'Claude' : rec.mode}\n\n` +
    `## Scores\n\n| Area | Score | Evidence |\n|---|---|---|\n${AREA_IDS.map(a => `| ${AREAN[a]} | ${rec.sc[a] || 'n/a'} | ${(R.scores[a].evidence || '').replace(/\|/g, '/')} |`).join('\n')}\n\n` +
    `Band: ${rec.band}. ${rec.level} bar: ${rec.bar ? 'met' : 'not met'}.\n\n## Fixes\n\n${R.fixes.map((f, i) => `${i + 1}. ${f.text}${f.rev ? ' (' + D.rev[f.rev].label + ')' : ''}`).join('\n')}\n\n` +
    `## Strengths\n\n${R.strengths.map(x => '- ' + x).join('\n')}\n\n## Strong-answer points\n\n${s.model.map(([t, p], i) => `- [${R.points[i] || 'missed'}] ${p}`).join('\n')}\n\n## Transcript\n${T ? transcriptText(T) : '(not available)'}\n`;
}
$('mresult').addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.id === 'mnew') { $('mresult').hidden = true; $('msetup').hidden = false; M = null; }
  if (b.id === 'mdl' && DL && LAST) { try { const r = await DL.save({filename: `mock-${LAST.rec.s}-${new Date(LAST.rec.at).toISOString().slice(0, 10)}.md`, data: markdown()}); if (r && r.status === 'saved') toast('Saved.'); }
    catch (err) { if (err && err.code !== 'declined') toast('The download could not be saved here.'); } }
});
$('mstart').addEventListener('click', startMock);
$('msend').addEventListener('click', onSend);
$('mtext').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSend(); } });
$('mhint').addEventListener('click', onHint);
$('mready').addEventListener('click', () => { if (M && !M.busy) nextStage(); });
$('mnextst').addEventListener('click', () => { if (M && !M.busy) { say('sys', 'Skipped to the next stage.'); nextStage(); } });
$('mend').addEventListener('click', () => { if (M && !M.busy) finishMock(); });

/* ---------- spoken result import ---------- */
function parseBlock(t) {
  const m = /=== INTERVIEW ROOM RESULT v1 ===([\s\S]*?)=== END ===/.exec(t); if (!m) return null;
  const f = {}; for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) f[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  const sid = (f.scenario || '').toLowerCase(); if (!SC[sid]) return {err: 'The result block names an unknown scenario.'};
  const sc = {}; for (const a of AREA_IDS) { const x = new RegExp('\\b' + a + '=([1-4-])').exec(f.scores || ''); sc[a] = x && x[1] !== '-' ? +x[1] : null; }
  if (!Object.values(sc).some(x => x)) return {err: 'The result block has no scores.'};
  const level = ['SDE-2', 'Senior', 'Staff'].find(l => l.toLowerCase() === (f.level || '').toLowerCase()) || 'Senior';
  const tags = (f.tags || '').split(',').map(x => x.trim()).filter(x => TAGN[x]);
  const fixes = (f.fixes || '').split('|').map(x => x.trim()).filter(Boolean).slice(0, 3);
  return {sid, level, length: /quick/i.test(f.length) ? 'Quick' : 'Full', mode: /voice/i.test(f.mode) ? 'voice' : 'text', sc, tags, fixes, hints: parseInt(f.hints) || 0};
}
$('pbtn').addEventListener('click', () => {
  const t = $('ptext').value; const p = parseBlock(t);
  if (!p) { $('pmsg').textContent = SAMPLE ? 'No result block found. To score the whole chat with Claude instead, choose its scenario and level, then press Score chat with Claude.' : 'No result block found. Paste the block that starts with === INTERVIEW ROOM RESULT v1 ===.'; return; }
  if (p.err) { $('pmsg').textContent = p.err; return; }
  const R = {scores: Object.fromEntries(AREA_IDS.map(a => [a, {score: p.sc[a], evidence: 'From the spoken mock scorecard.'}])), tags: p.tags, strengths: [], fixes: p.fixes.map(x => ({text: x, rev: null})), points: SC[p.sid].model.map(([t]) => p.tags.includes(t) ? 'covered' : 'missed'), traps: [], by: 'skill'};
  const rec = record(R, {sid: p.sid, level: p.level, length: p.length, mode: p.mode, hints: p.hints, id: Date.now().toString(36)});
  $('pmsg').textContent = `Saved: ${SC[p.sid].co} · ${p.level} · ${rec.band}. It now shows in Your progress.`; $('ptext').value = '';
});
$('pscore').addEventListener('click', async () => {
  const t = $('ptext').value.trim(); if (t.length < 300) { $('pmsg').textContent = 'Paste the whole chat first; it looks too short to score.'; return; }
  const sid = $('pspick').value, level = $('plvl').value;
  $('pscore').disabled = true; $('pmsg').textContent = 'Scoring the chat. This can take up to a minute…';
  try { const R = await claudeScore(t.slice(-40000), {sid, level, length: 'Full', areas: AREA_IDS});
    const rec = record(R, {sid, level, length: 'Full', mode: 'text', hints: (t.match(/\bhint\b/gi) || []).length, id: Date.now().toString(36)});
    selectTab('mock'); $('msetup').hidden = true; showResult(rec, R, null); $('pmsg').textContent = ''; $('ptext').value = ''; }
  catch (e) { $('pmsg').textContent = e && e.code === 'not_granted' ? 'Claude was not allowed for this page, so the chat could not be scored. Paste the result block instead.' : 'The chat could not be scored this time. Paste the result block instead, or try again later.'; }
  $('pscore').disabled = false;
});
$('pspick').innerHTML = D.scen.map(s => `<option value="${s.id}">${s.id} · ${esc(s.co)}</option>`).join('');

/* ---------- mock history ---------- */
function renderMocks() {
  const K = (st.mk || []).slice(-8);
  if (!K.length) { $('mhist').innerHTML = '<p class="empty">Finish a mock or save a spoken-mock result to see your scores by area.</p>'; return; }
  $('mhist').innerHTML = `<div class="tscroll"><table class="heat"><thead><tr><th>Area</th>${K.map(k => `<th title="${esc(SC[k.s].co)}">${new Date(k.at).toLocaleDateString(undefined, {day: 'numeric', month: 'short'})}<br><small>${k.s} · ${k.length[0]}${k.mode === 'voice' ? ' · voice' : ''}</small></th>`).join('')}</tr></thead><tbody>
    ${AREA_IDS.map(a => `<tr><td>${esc(AREAN[a])}</td>${K.map(k => `<td class="h${k.sc[a] || 0}">${k.sc[a] || '–'}</td>`).join('')}</tr>`).join('')}
    <tr class="bandrow"><td>Band</td>${K.map(k => `<td>${esc(k.band)}${k.bar ? ' ✓' : ''}</td>`).join('')}</tr></tbody></table></div>`;
}

/* ---------- tabs ---------- */
const TABS = ['drill', 'mock', 'spoken', 'progress'];
function selectTab(id) {
  TABS.forEach(t => { const on = t === id; $('tab-' + t).setAttribute('aria-selected', on); $('tab-' + t).tabIndex = on ? 0 : -1; $(t).hidden = !on; });
  try { localStorage.setItem('aam-iv-tab', id); } catch (e) {}
}
$('tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) selectTab(b.dataset.t); });
$('tabs').addEventListener('keydown', e => {
  if (!['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const i = TABS.findIndex(t => $('tab-' + t).getAttribute('aria-selected') === 'true');
  const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]; selectTab(n); $('tab-' + n).focus();
});

/* ---------- boot ---------- */
$('spick').innerHTML = D.scen.map(s => `<option value="${s.id}">${s.id} · ${esc(s.co)} · ${esc(s.sector)}</option>`).join('');
function renderAll() { renderSuggest(); renderProgress(); }
status();
const h = sub;
let tab = 'drill'; try { const t = localStorage.getItem('aam-iv-tab'); if (TABS.includes(t)) tab = t; } catch (e) {}
if (SC[h]) tab = 'drill'; if (TABS.includes(h)) tab = h;
selectTab(tab);
startDrill(SC[h] ? h : suggest().id);
renderAll();

}
