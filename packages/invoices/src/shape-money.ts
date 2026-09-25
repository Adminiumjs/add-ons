/**
 * The money law of the tables an app builds on this add-on's shapes — the
 * reference the stored formulas are checked against.
 *
 * ── WHY A SECOND LAW, BESIDE `money.ts` ────────────────────────────────────
 *
 * `money.ts` is the arithmetic of a document an operator mapped by hand: two
 * decimals, one whole-document reduction, and a fixture Adminium keeps
 * byte-identical to a server copy. It stays exactly as it is.
 *
 * A document built on a shape is worked out by ADMINIUM, in the formulas the
 * shape declares (`manifest.json`, `addOn.shapes`): each line's amount, the
 * tax, the total, in the decimals of the document's own currency — none for
 * yen, two for most, three for the Kuwaiti dinar. This file says the same law
 * a second way, exactly, so the two can be held against each other:
 * `shape-money-fixture.json` beside it is the table both must reproduce, and
 * Adminium's engine tests read the same file.
 *
 *   a line        amount = max(0, qty × rate − reduction)            (an amount off)
 *                        = max(0, qty × rate × (1 − reduction / 100)) (a rate off)
 *                 rounded ONCE, half away from zero, to the currency's decimals
 *   a stage line  amount = rate × share / 100, rounded the same way
 *   the document  subtotal = the sum of the stored line amounts
 *                 tax      = subtotal × tax rate / 100, rounded once
 *                 total    = subtotal + tax
 *
 * EXACT: every value is decimal text turned into a fraction of big integers,
 * never a float, and the only rounding is the one per stored value.
 */

/** A value as an exact fraction. */
interface Ratio {
  readonly n: bigint;
  readonly d: bigint;
}

const DECIMAL = /^([+-]?)(\d*)(?:\.(\d*))?$/;

/** Decimal text (or a finite number) → an exact fraction; `null` when it is not a number. */
export function ratioOf(value: string | number | null | undefined): Ratio | null {
  if (value === null || value === undefined) return null;
  const text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '') : value.trim();
  const match = DECIMAL.exec(text);
  if (match === null) return null;
  const [, sign = '', whole = '', fraction = ''] = match;
  if (whole === '' && fraction === '') return null;
  const n = BigInt(`${whole}${fraction}` === '' ? '0' : `${whole}${fraction}`);
  return { n: sign === '-' ? -n : n, d: 10n ** BigInt(fraction.length) };
}

const add = (a: Ratio, b: Ratio): Ratio => ({ n: a.n * b.d + b.n * a.d, d: a.d * b.d });
const sub = (a: Ratio, b: Ratio): Ratio => ({ n: a.n * b.d - b.n * a.d, d: a.d * b.d });
const mul = (a: Ratio, b: Ratio): Ratio => ({ n: a.n * b.n, d: a.d * b.d });
const div = (a: Ratio, b: Ratio): Ratio => ({ n: a.n * b.d, d: a.d * b.n });
const ZERO: Ratio = { n: 0n, d: 1n };
const HUNDRED: Ratio = { n: 100n, d: 1n };
const ONE: Ratio = { n: 1n, d: 1n };

/** Round half away from zero to `scale` places; the result as decimal text with exactly `scale` places. */
export function roundedText(value: Ratio, scale: number): string {
  const factor = 10n ** BigInt(scale);
  // Normalise the sign onto the numerator so the division below is on magnitudes.
  const n = value.d < 0n ? -value.n : value.n;
  const d = value.d < 0n ? -value.d : value.d;
  const negative = n < 0n;
  const magnitude = (negative ? -n : n) * factor;
  let units = magnitude / d;
  if ((magnitude % d) * 2n >= d) units += 1n;
  const digits = units.toString().padStart(scale + 1, '0');
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? '' : `.${digits.slice(-scale)}`;
  return `${negative && units !== 0n ? '-' : ''}${whole}${fraction}`;
}

export interface ShapeLine {
  /** Decimal text; up to three places. */
  readonly qty: string;
  /** Decimal text in the currency's decimals. */
  readonly rate: string;
  readonly discountKind?: 'amount' | 'percent' | null;
  /** An amount off, or a rate off when `discountKind` is `percent`. Empty is none. */
  readonly discount?: string | null;
  /** A stage of a quote: the share of `rate` this line bills. Set, it decides the amount. */
  readonly share?: string | null;
}

/** One line's stored amount, as the shape's formula works it out. */
export function lineAmount(line: ShapeLine, scale: number): string {
  const qty = ratioOf(line.qty) ?? ZERO;
  const rate = ratioOf(line.rate) ?? ZERO;
  const share = ratioOf(line.share ?? null);
  if (share !== null) return roundedText(div(mul(rate, share), HUNDRED), scale);
  const discount = ratioOf(line.discount ?? null) ?? ZERO;
  const gross = mul(qty, rate);
  const net = line.discountKind === 'percent' ? mul(gross, sub(ONE, div(discount, HUNDRED))) : sub(gross, discount);
  // Every denominator here is a positive power of ten, so the sign is the numerator's.
  return roundedText(net.n < 0n ? ZERO : net, scale);
}

export interface ShapeTotals {
  readonly subtotal: string;
  readonly tax: string;
  readonly total: string;
}

/** The document's stored figures from its stored line amounts and its one tax rate (a percentage). */
export function documentTotals(amounts: readonly string[], taxRate: string | null, scale: number): ShapeTotals {
  const subtotal = amounts.reduce<Ratio>((sum, amount) => add(sum, ratioOf(amount) ?? ZERO), ZERO);
  const rate = ratioOf(taxRate) ?? ZERO;
  const tax = roundedText(div(mul(subtotal, rate), HUNDRED), scale);
  const subtotalText = roundedText(subtotal, scale);
  return {
    subtotal: subtotalText,
    tax,
    total: roundedText(add(ratioOf(subtotalText)!, ratioOf(tax)!), scale),
  };
}

/** Decimal text times decimal text, rounded to `scale` — a line with no stored amount, drawn. */
export function productText(a: string, b: string, scale: number): string {
  return roundedText(mul(ratioOf(a) ?? ZERO, ratioOf(b) ?? ZERO), scale);
}

/** Decimal text minus decimal text, exactly, at `scale`. */
export function differenceText(a: string, b: string, scale: number): string {
  return roundedText(sub(ratioOf(a) ?? ZERO, ratioOf(b) ?? ZERO), scale);
}

/** The sum of decimal texts, exactly, at `scale`. */
export function sumText(values: readonly string[], scale: number): string {
  return roundedText(values.reduce<Ratio>((sum, value) => add(sum, ratioOf(value) ?? ZERO), ZERO), scale);
}

/** Whether decimal text is above zero. */
export function isPositive(value: string | null): boolean {
  const ratio = ratioOf(value);
  return ratio !== null && ratio.n > 0n;
}

/** Whether decimal text is zero (or empty). */
export function isZero(value: string | null): boolean {
  const ratio = ratioOf(value);
  return ratio === null || ratio.n === 0n;
}
