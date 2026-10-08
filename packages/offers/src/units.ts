/**
 * MONEY AS WHOLE NUMBERS.
 *
 * An amount crosses in as text (`"18.60"`) and leaves as text with exactly
 * the decimals its order keeps. In between it is a whole number of the
 * smallest unit (`1860n`), so nothing here is ever a float: a percent is one
 * multiplication and one division, rounded once, half up.
 */

const pow10 = (places: number): bigint => 10n ** BigInt(places);

/**
 * An amount as a whole number of `scale` decimals. Text is read digit by
 * digit; a number through its own shortest text. More decimals than `scale`
 * are rounded half away from zero. Nothing, or something that is no figure,
 * reads as null.
 */
export function toUnits(value: unknown, scale: number): bigint | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const match = /^([+-])?(\d+)(?:\.(\d+))?$/.exec(typeof value === 'number' ? String(value) : value.trim());
  if (match === null) return null;
  const fraction = match[3] ?? '';
  let scaled = BigInt(match[2] ?? '0') * pow10(scale) + BigInt((fraction + '0'.repeat(scale)).slice(0, scale) || '0');
  if (fraction.length > scale && fraction.charCodeAt(scale) >= 53) scaled += 1n;
  return match[1] === '-' ? -scaled : scaled;
}

/**
 * An amount of the order itself, which arrives at the order's own decimals:
 * anything finer is cut off, as Adminium cuts it when it checks the answer —
 * so a reduction is never a unit more than the line Adminium sees.
 */
export function cutUnits(value: unknown, scale: number): bigint {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text);
  if (match === null) return 0n;
  return BigInt(match[1]!) * pow10(scale) + BigInt(((match[2] ?? '') + '0'.repeat(scale)).slice(0, scale) || '0');
}

/** The text an amount is written as: `1860n` at two decimals is `"18.60"`. */
export function fromUnits(units: bigint, scale: number): string {
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const body = scale === 0 ? digits : `${digits.slice(0, digits.length - scale)}.${digits.slice(digits.length - scale)}`;
  return negative ? `-${body}` : body;
}

/** The decimals a percent is read to: `12.5` is `12500n`. */
const PERCENT = 3;

/** `percent` of `base`, rounded half up to the unit: 10 % of 49.50 is 4.95, 12.5 % of 49.80 is 6.23. */
export function percentOf(base: bigint, percent: unknown): bigint {
  const share = toUnits(percent, PERCENT);
  if (share === null || share <= 0n || base <= 0n) return 0n;
  const bottom = 100n * pow10(PERCENT);
  return (base * share * 2n + bottom) / (bottom * 2n);
}

/** The smaller, and the larger, of two amounts. */
export const least = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const most = (a: bigint, b: bigint): bigint => (a > b ? a : b);
/** Everything in a list, added up. */
export const sum = (amounts: readonly bigint[]): bigint => amounts.reduce((total, one) => total + one, 0n);
