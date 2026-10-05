/**
 * Tiny HTML helpers for the site views.
 * Interpolated values are escaped unless wrapped in `trusted()`. Only build-time course content
 * (extracted by scripts/extract-legacy-site.mjs) is ever marked trusted; user input never is.
 */
export class TrustedHtml {
  constructor(readonly value: string) {}
  toString(): string { return this.value; }
}

export const trusted = (value: string | undefined | null): TrustedHtml => new TrustedHtml(value ?? '');

export const esc = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

type Part = TrustedHtml | string | number | boolean | null | undefined | readonly Part[];

const render = (part: Part): string => {
  if (part === null || part === undefined || part === false) return '';
  if (part instanceof TrustedHtml) return part.value;
  if (Array.isArray(part)) return part.map(render).join('');
  return esc(part);
};

/** Tagged template: `html\`<b>${name}</b>\`` escapes `name`; nested html results stay as markup. */
export function html(strings: TemplateStringsArray, ...values: Part[]): TrustedHtml {
  let out = strings[0] ?? '';
  values.forEach((v, i) => { out += render(v) + (strings[i + 1] ?? ''); });
  return new TrustedHtml(out);
}

export const join = (items: readonly TrustedHtml[]): TrustedHtml => trusted(items.map((i) => i.value).join(''));

/** Replaces an element's content with markup built by `html`. The single place markup enters the DOM. */
export function setHtml(el: Element, markup: TrustedHtml): void {
  el.innerHTML = markup.value;
}

export const $ = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T | null => root.querySelector<T>(selector);
export const $$ = <T extends Element = HTMLElement>(root: ParentNode, selector: string): T[] => [...root.querySelectorAll<T>(selector)];

export const reducedMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const pct = (v: number): string => `${Math.round(v * 100)}%`;

/** Meter row used across the site: label, bar, percentage and an optional footnote. */
export const meterRow = (label: string | TrustedHtml, v: number, note: string | TrustedHtml = '', cls = ''): TrustedHtml =>
  html`<div class="mrow"><span>${label}</span><div class="mbar"><i class="${cls}" style="width:${Math.max(0, Math.min(1, v)) * 100}%"></i></div><b>${pct(v)}</b>${note ? html`<small class="mf">${note}</small>` : ''}</div>`;

export const tick = (ok: boolean): TrustedHtml => html`<b class="${ok ? 't-ok' : 't-no'}">${ok ? '✓ yes' : '✗ no'}</b>`;

export const storage = {
  get(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } },
  set(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  json<T>(key: string, fallback: T): T { try { const v = JSON.parse(localStorage.getItem(key) ?? 'null') as T | null; return v ?? fallback; } catch { return fallback; } },
};
