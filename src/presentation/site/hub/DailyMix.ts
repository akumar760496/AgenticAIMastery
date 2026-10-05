/**
 * The Daily Mix: a short, varied set of items for today, drawn from the modules named in `hub.mix`.
 *
 * Due reviews and a new technique come from the spaced-review engine; a cross-module connection and a
 * real-world case surface content that otherwise only appears if the learner goes looking for it. The
 * variety is the point — five items of the same kind is a chore by the fourth day.
 *
 * Which items make up a day is decided once and stored, so answered rows stay on screen with a tick
 * instead of vanishing from the list as the due queue shrinks underneath them.
 */
import { storage } from '../html';
import type { HubCase, HubConnection, HubData, HubTechnique } from '../content';
import { HubProgress, addDays, today } from './HubProgress';

export type MixItem =
  | { readonly kind: 'review' | 'new'; readonly key: string; readonly tech: HubTechnique }
  | { readonly kind: 'connect'; readonly key: string; readonly conn: HubConnection }
  | { readonly kind: 'case'; readonly key: string; readonly c: HubCase; readonly options: readonly string[]; readonly correct: number };

/**
 * `done` is what the learner got right; `miss` is what they attempted and did not. Keeping them apart
 * is the whole point: an item answered "Still learning" has been dealt with for today, but ticking it
 * would claim the learner knows it, and the spaced engine has just scheduled it to come back tomorrow.
 */
interface MixState { d: string; keys: string[]; done: string[]; miss: string[] }

const KEY = 'aam-mix-v1';
/**
 * Day number since the epoch, which rotates the connection and case picks once a day. It is UTC-based
 * while `today()` is local, so the two can disagree for a few hours near midnight; all that does is
 * choose a different case, so it is not worth a timezone library.
 */
export const dayIndex = (now: number = Date.now()): number => Math.floor(now / 86400000);

/** Stable identity for a connection and a case, so a stored day survives content being reordered. */
const connKey = (c: HubConnection): string => `conn:${c.a}.${c.ai}|${c.b}.${c.bi}`;
const caseKey = (c: HubCase): string => `case:${c.p}.${c.id}`;

export class DailyMix {
  private state: MixState | null = null;

  constructor(private readonly p: HubProgress) {}

  private get d(): HubData { return this.p.data; }
  private get mods(): readonly number[] { return this.d.mix?.mods ?? []; }
  /** False unless the content names at least one module, which is how the card stays off by default. */
  get on(): boolean { return Boolean(this.d.mix) && this.mods.length > 0; }
  get goal(): number { return this.d.mix?.goal ?? 5; }

  /**
   * Loads today's set, or picks it now. Deferred rather than done in the constructor so the pick sees
   * progress restored from the learner's account, which `HubProgress.connect()` fetches after boot.
   */
  private get st(): MixState {
    const t = today();
    if (this.state && this.state.d === t) return this.state;
    const saved = storage.json<MixState | null>(KEY, null);
    if (saved && saved.d === t && Array.isArray(saved.keys)) { this.state = { d: t, keys: saved.keys, done: saved.done ?? [], miss: saved.miss ?? [] }; return this.state; }
    this.state = { d: t, keys: this.pick(), done: [], miss: [] };
    this.persist();
    return this.state;
  }

  private persist(): void { if (this.state) storage.set(KEY, JSON.stringify(this.state)); }

  private scoped<T extends { p: number }>(xs: readonly T[]): readonly T[] { return xs.filter((x) => this.mods.includes(x.p)); }

  /**
   * Cases usable as a question. Two are rejected: one whose own text names its technique, because the
   * question would answer itself, and one whose technique is not a technique of its module, because
   * then there is no real answer to offer and no siblings to draw distractors from. The second rules
   * out the capstone cases, whose `tn` names the case rather than a technique.
   */
  private cases(): readonly HubCase[] {
    return this.scoped(this.d.cases).filter((c) => !c.text.toLowerCase().includes(c.tn.toLowerCase())
      && this.d.techs.some((x) => x.p === c.p && x.name === c.tn) && this.d.techs.filter((x) => x.p === c.p).length >= 4);
  }

  private pick(): string[] {
    const t = today(); const tech = this.p.state.tech; const pool = this.scoped(this.d.techs);
    const due = pool.filter((x) => { const s = tech[x.id]; return s && s.box > 0 && (s.due ?? '') <= t; })
      .sort((a, b) => (tech[a.id]?.due ?? '').localeCompare(tech[b.id]?.due ?? ''));
    const unseen = pool.filter((x) => !tech[x.id]?.box);
    const i = dayIndex();
    const conns = this.d.conn.filter((c) => this.mods.includes(c.a) || this.mods.includes(c.b));
    const cases = this.cases();
    const rev = due.slice(0, 2);
    const conn = conns.length ? (conns[i % conns.length] as HubConnection) : null;
    // Whatever the reviews leave over goes to new techniques, so the card still fills on a first visit.
    const room = Math.max(0, this.goal - rev.length - (conn ? 1 : 0) - (cases.length ? 1 : 0));
    const fresh = unseen.slice(0, room);
    // Every technique this day already names on screen. The case asks which technique its story is
    // about, so a case whose answer is sitting in another row would be answered by reading the card.
    const named = new Set([...rev, ...fresh].map((x) => x.name));
    if (conn) { named.add(conn.an); named.add(conn.bn); }
    const from = i % (cases.length || 1);
    const cas = cases.length
      ? [...cases.slice(from), ...cases.slice(0, from)].find((c) => !named.has(c.tn)) ?? (cases[from] as HubCase)
      : null;
    return [...rev.map((x) => `rev:${x.id}`), ...fresh.map((x) => `new:${x.id}`),
      ...(conn ? [connKey(conn)] : []), ...(cas ? [caseKey(cas)] : [])];
  }

  /** Today's items. A key that no longer resolves is dropped, so a content edit cannot break the card. */
  items(): readonly MixItem[] {
    const out: MixItem[] = [];
    for (const k of this.st.keys) {
      const at = k.indexOf(':'); const kind = k.slice(0, at); const rest = k.slice(at + 1);
      if (kind === 'rev' || kind === 'new') {
        const tech = this.d.techs.find((x) => x.id === rest);
        if (tech) out.push({ kind: kind === 'rev' ? 'review' : 'new', key: k, tech });
      } else if (kind === 'conn') {
        const c = this.d.conn.find((x) => connKey(x) === k);
        if (c) out.push({ kind: 'connect', key: k, conn: c });
      } else if (kind === 'case') {
        const c = this.d.cases.find((x) => caseKey(x) === k);
        if (c) out.push(this.caseItem(k, c));
      }
    }
    return out;
  }

  /**
   * Builds the multiple choice from the data rather than from authored options: the answer is the case's
   * own technique and the distractors are other techniques of the same module. Nothing is generated.
   */
  private caseItem(key: string, c: HubCase): MixItem {
    const sib = this.d.techs.filter((x) => x.p === c.p && x.name !== c.tn); const i = dayIndex();
    const picks: string[] = [];
    for (let k = 0; k < sib.length && picks.length < 3; k++) picks.push((sib[(i + k) % sib.length] as HubTechnique).name);
    const options = [...picks];
    options.splice(Math.min(i % 4, options.length), 0, c.tn);
    return { kind: 'case', key, c, options, correct: options.indexOf(c.tn) };
  }

  /** Got it right. Only this earns a tick. */
  isDone(key: string): boolean { return this.st.done.includes(key); }
  /** Attempted and not got: shown as still-to-learn, never as complete. */
  isMissed(key: string): boolean { return this.st.miss.includes(key); }
  isSeen(key: string): boolean { return this.isDone(key) || this.isMissed(key); }
  get doneCount(): number { return this.st.keys.filter((k) => this.st.done.includes(k)).length; }
  get seenCount(): number { return this.st.keys.filter((k) => this.isSeen(k)).length; }
  get missCount(): number { return this.st.keys.filter((k) => this.st.miss.includes(k)).length; }

  /**
   * Records an answer. `ok` false marks the item attempted rather than complete, so the counter and the
   * tick keep meaning "you got this" instead of "you clicked something".
   */
  mark(key: string, ok: boolean): void {
    const s = this.st;
    const from = ok ? s.miss : s.done; const to = ok ? s.done : s.miss;
    const at = from.indexOf(key); if (at >= 0) from.splice(at, 1);
    if (!to.includes(key)) to.push(key);
    this.persist();
    // Answering anything in the mix is showing up, so it counts towards the streak either way.
    this.p.touch(); this.p.save();
  }

  /** Reviews falling due tomorrow inside the mix's modules, for the card's footer. */
  tomorrow(): number {
    const t = addDays(today(), 1); const tech = this.p.state.tech;
    return this.scoped(this.d.techs).filter((x) => { const s = tech[x.id]; return s && s.box > 0 && (s.due ?? '') === t; }).length;
  }

  /** The modules the mix draws from, for the card's subtitle. */
  moduleNames(): string { return this.mods.map((n) => this.p.M(n)?.name).filter(Boolean).join(', '); }
}
