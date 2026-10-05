/**
 * Pure formatting helpers. Indian digit grouping (en-IN) is the default for rupees and counts.
 */
const IN_LOCALE = 'en-IN';

export const formatPercent = (fraction: number, digits = 0): string =>
  `${(fraction * 100).toFixed(digits).replace(/\.0+$/, '')}%`;

/** Matches the legacy rounding (Math.round of fraction × 100). */
export const formatWholePercent = (fraction: number): string => `${Math.round(fraction * 100)}%`;

export const formatCount = (value: number): string => value.toLocaleString(IN_LOCALE);

export const formatRupees = (value: number, fractionDigits = 0): string =>
  `₹${value.toLocaleString(IN_LOCALE, { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;

export const formatDollars = (value: number, fractionDigits = 2): string =>
  `$${value.toLocaleString('en-US', { minimumFractionDigits: fractionDigits, maximumFractionDigits: fractionDigits })}`;

export const formatFixed = (value: number, digits = 1): string => value.toFixed(digits);

export const pluralise = (count: number, singular: string, plural = `${singular}s`): string =>
  count === 1 ? singular : plural;

/** Joins ["a","b","c"] as "a, b and c". */
export const joinWithAnd = (items: readonly string[]): string =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

/** Dollar amounts with three decimals below $1 (so per-item costs such as $0.068 stay visible), two above. */
export const formatMoney = (value: number): string => `$${(Math.round(value * 1000) / 1000).toFixed(value < 1 ? 3 : 2)}`;
