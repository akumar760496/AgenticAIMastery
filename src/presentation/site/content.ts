/**
 * Shapes of the site content extracted from the legacy site (src/content/site).
 * Strings may contain build-time inline markup (<b>, <code>) and are rendered as trusted HTML.
 */
export interface HubModule { readonly n: number; readonly name: string; readonly track: string; readonly url: string; readonly lede: string; readonly count: number; readonly pre: readonly number[]; readonly ver: string }
export interface HubTrack { readonly id: string; readonly name: string; readonly blurb: string; readonly mods: readonly number[] }
export interface HubTechnique { readonly p: number; readonly id: string; readonly name: string; readonly short: string; readonly q: string; readonly remember: string; readonly what: string }
export interface HubPath { readonly id: string; readonly role: string; readonly goal: string; readonly steps: readonly (readonly [number, string])[] }
export interface HubCase { readonly p: number; readonly id: string; readonly tn: string; readonly kind: string; readonly sec: string; readonly india: boolean; readonly text: string }
export interface HubTeaser { readonly q: string; readonly o: readonly string[]; readonly c: number; readonly e: string; readonly m: number; readonly t: string }
/**
 * Turns on the Daily Mix card and scopes it. `mods` lists the modules its items may come from, so the
 * feature rolls out by naming more modules here rather than by changing code; `goal` is how many items
 * make up a day. Omitting the whole key leaves the home page exactly as it was.
 */
export interface HubMix { readonly mods: readonly number[]; readonly goal: number }
export interface HubConnection { readonly a: number; readonly ai: string; readonly an: string; readonly b: number; readonly bi: string; readonly bn: string; readonly note: string }
export interface HubData {
  readonly mods: readonly HubModule[]; readonly techs: readonly HubTechnique[]; readonly tracks: readonly HubTrack[];
  readonly conn: readonly HubConnection[]; readonly gloss: readonly (readonly [string, string, number])[]; readonly paths: readonly HubPath[];
  readonly cases: readonly HubCase[]; readonly sectors: readonly string[]; readonly teasers: readonly HubTeaser[]; readonly iv: string;
  readonly mix?: HubMix;
}

export interface Technique {
  readonly id: string; readonly name: string; readonly short: string; readonly q: string; readonly what: string;
  readonly use: readonly string[]; readonly mLabel: string; readonly metrics: readonly (readonly [string, string])[];
  readonly steps: readonly string[]; readonly pitfalls: readonly string[]; readonly tools: readonly string[];
  readonly remember: string; readonly cap: string; readonly cmp: { readonly scope: string; readonly cost: number; readonly needs: string; readonly best: string };
}
export interface Lesson { readonly file: string; readonly lang: string; readonly h: number; readonly code: string; readonly steps: readonly (readonly [string, string])[]; readonly frames: readonly string[] }
export interface Decide { readonly pros: readonly string[]; readonly cons: readonly string[]; readonly avoid: readonly string[]; readonly tools: readonly (readonly [string, string, string, string])[]; readonly play?: string }
export interface Practice { readonly sc: string; readonly an: string; readonly ind: readonly (readonly [string, string])[]; readonly lib: readonly [string, string, string]; readonly code: readonly (readonly [string, string, string])[]; readonly note?: string | null }
export interface ToolCard { readonly n: string; readonly type: string; readonly start: number; readonly prod: number; readonly best: string; readonly ex: string; readonly pros: readonly string[]; readonly cons: readonly string[]; readonly url: string; readonly tag?: string }
export interface PlayGuide {
  readonly scenario: string; readonly controls: readonly string[]; readonly outputs: readonly (readonly [string, string])[];
  readonly presets: readonly { readonly k: string; readonly name: string; readonly expect: string }[];
  readonly missions: readonly { readonly k: string; readonly text: string; readonly hint: string }[];
  readonly tools: readonly ToolCard[]; readonly quick: readonly (readonly [string, string])[]; readonly goals: readonly string[];
}
export interface StudyTech { readonly t: string; readonly a: string; readonly num: readonly [number, number, string] | null; readonly iv: readonly (readonly [string, string])[]; readonly mis: readonly (readonly [string, string])[] }
export interface StudyLink { readonly p: number; readonly pn: string; readonly id: string; readonly name: string; readonly note: string; readonly url: string }
export interface Study { readonly panel: number; readonly hub: string; readonly track: string; readonly quiz: readonly unknown[]; readonly tech: Readonly<Record<string, StudyTech>>; readonly gloss: readonly (readonly [string, string])[]; readonly conn: Readonly<Record<string, readonly StudyLink[]>> }
export interface Bug { readonly title: string; readonly code: string; readonly line: number; readonly explain: string; readonly fix: string; readonly also?: Readonly<Record<string, string>> }
export interface MentorQuestion { readonly q: string; readonly pts: readonly (readonly [string, string])[]; readonly model: string; readonly src: readonly string[]; readonly refs: readonly string[] }
export type Verdict = 'essential' | 'useful' | 'not-needed';
export interface Capstone {
  readonly title: string; readonly brief: string; readonly evidence: readonly string[]; readonly task: string;
  readonly verdict: Readonly<Record<string, Verdict>>; readonly order: readonly string[];
  readonly why: Readonly<Record<string, string>>; readonly model: string; readonly note?: string;
  /** Stable id, used for per-case saved answers. Absent on single-case modules. */
  readonly id?: string;
  /** Short family label for the case chip, e.g. "Shape and values". */
  readonly tag?: string;
  readonly sector?: string;
  /** Per evidence item, the technique ids that address it. An empty list marks evidence that rules a technique out. */
  readonly covers?: readonly (readonly string[])[];
  /** Shown when the learner starts with this technique instead of `order[0]`. */
  readonly firstWhy?: Readonly<Record<string, string>>;
  /**
   * Three escalating hints per essential technique, shown instead of the answer while the plan is wrong:
   * level 1 asks about the symptom, level 2 narrows the family, level 3 names the technique.
   * Its presence turns the case into a check-and-hint exercise rather than an instant reveal.
   */
  readonly hints?: Readonly<Record<string, readonly [string, string, string]>>;
  /** One question per `not-needed` technique, asked when the plan includes it. */
  readonly drop?: Readonly<Record<string, string>>;
  /** Asked when the plan has the right techniques in the wrong order; must not name the answer. */
  readonly firstHint?: string;
  /** A one-tap claim about why anything goes first here, in place of a free-text justification. */
  readonly whyFirst?: { readonly q: string; readonly options: readonly string[]; readonly correct: number; readonly why: string };
}
/** Quiz bank row: [id, 's'|'m', industry, question, options, correct indexes, explanation]. */
export type QuizRow = readonly [string, string, string, string, readonly string[], readonly number[], string];
export interface CaseExtras {
  readonly sources: Readonly<Record<string, readonly [string, string]>>; readonly capstone: Capstone | null; readonly bugs: Readonly<Record<string, Bug>>;
  /** Several capstone cases for one module. Preferred over `capstone`, which stays for modules with a single case. */
  readonly cases?: readonly Capstone[];
  /** Display name and question for capstone choices that are not techniques of this module, such as model tiering. */
  readonly capLabels?: Readonly<Record<string, readonly [string, string]>>;
  readonly pred: Readonly<Record<string, Readonly<Record<string, readonly [string, readonly [string, string], number, string]>>>>;
  readonly teach: Readonly<Record<string, readonly (readonly [string, string, string])[]>>; readonly qb: Readonly<Record<string, readonly QuizRow[]>>;
  readonly mentor: Readonly<Record<string, readonly MentorQuestion[]>>;
}
export interface ModuleHeader {
  readonly h1: string; readonly lede: string; readonly crumbs: string;
  /**
   * `bands` groups everything that is about all the techniques at once into one "Put it together" band
   * of progress cards, collapses the comparison table and sends the glossary to the hub Library.
   * Omitted means the original layout: every section stacked at the same level.
   */
  readonly layout?: 'bands';
  readonly sections: Readonly<Record<string, { readonly title: string; readonly blurb: string }>>; readonly footer: readonly string[]; readonly markers: string;
}
export interface ModuleData {
  readonly n: number; readonly slug: string; readonly title: string; readonly track: string;
  readonly techniques: readonly Technique[]; readonly extra: Technique | null; readonly compareHead: string; readonly chooser: readonly (readonly [string, string, string])[];
  readonly loop: string; readonly diagrams: Readonly<Record<string, string>>; readonly lessons: Readonly<Record<string, Lesson>>;
  readonly decide: Readonly<Record<string, Decide>>; readonly practice: Readonly<Record<string, Practice>>; readonly play: Readonly<Record<string, PlayGuide>>;
  readonly cx: CaseExtras | null; readonly study: Study; readonly gifs: Readonly<Record<string, string>> | null; readonly header: ModuleHeader;
}
