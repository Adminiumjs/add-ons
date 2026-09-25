/**
 * How a figure, a day and a rate are written on a document — in the
 * DOCUMENT's language, never the viewer's.
 *
 * ── THE SIGN COMES FROM THE CURRENCY, NOT FROM A FIELD SOMEBODY TYPED ──────
 *
 * A document's currency is an ISO 4217 code (`EUR`), and what is printed is
 * what `Intl.NumberFormat` writes for that code in the document's language:
 * `€12,105.00` in English, `12.105,00 €` in German, `١٢٬١٠٥٫٠٠ €` in Arabic.
 * The decimals are the currency's own — none for yen, three for the Kuwaiti
 * dinar — so a document never prints a fraction its currency does not have
 * (the same list Adminium's formulas round to).
 *
 * Two exceptions, both stated:
 *
 *  - A template authored before this rule carries a SYMBOL (`$`, `€`) rather
 *    than a code. It is drawn the way it was saved (`money.ts`'s own
 *    formatter), because re-reading `$` as one particular currency would be a
 *    guess about somebody else's money.
 *  - Where the PDF writer cannot draw the sign (the rupee, the rouble) but can
 *    draw the rest of the document, the ISO code is printed instead, in both
 *    formats alike, so the page and the PDF still say the same thing.
 *
 * ── A DAY IS A DAY, WHEREVER THE READER IS ─────────────────────────────────
 *
 * Dates arrive as `YYYY-MM-DD` — a calendar day, with no time and no zone —
 * and are written in the document's language from UTC midnight, so no
 * reader's zone can move one to the day before. A value that is not a plain
 * day is printed as it came.
 */

import { formatMoney, parseMinor } from '../money.ts';
import { undrawnCharacters } from '../pdf/helvetica.ts';

const ZERO_DECIMAL: ReadonlySet<string> = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'ISK', 'JPY', 'KMF', 'KRW', 'PYG', 'RWF', 'UGX', 'UYI', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);
const THREE_DECIMAL: ReadonlySet<string> = new Set(['BHD', 'IQD', 'JOD', 'KWD', 'LYD', 'OMR', 'TND']);

/** Whether a currency value is an ISO 4217 code rather than a typed symbol. */
export function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

/**
 * The decimals a currency is written with (ISO 4217): JPY 0, most 2, KWD 3.
 * The same table Adminium's formulas round to, so a stored figure and a
 * printed one never disagree about how many places there are. Unknown → 2.
 */
export function currencyDigits(code: string | null | undefined): number {
  if (typeof code !== 'string' || !/^[A-Za-z]{3}$/.test(code)) return 2;
  const upper = code.toUpperCase();
  if (ZERO_DECIMAL.has(upper)) return 0;
  if (THREE_DECIMAL.has(upper)) return 3;
  return 2;
}

/**
 * Integer minor units at `scale` → exact decimal text (`1250`, 3 → `1.250`).
 * The contract carries money this way; this is the one way back.
 */
export function minorToDecimal(minor: number, scale: number): string {
  if (!Number.isFinite(minor)) return '0';
  const units = BigInt(Math.trunc(minor));
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString().padStart(scale + 1, '0');
  const whole = scale === 0 ? digits : digits.slice(0, -scale);
  const fraction = scale === 0 ? '' : `.${digits.slice(-scale)}`;
  return `${negative ? '-' : ''}${whole}${fraction}`;
}

/** The writers a layout uses, bound to one document's language and currency. */
export interface Formats {
  /** Decimal text in major units → the printed amount. */
  money(decimal: string): string;
  /** `YYYY-MM-DD` → the printed day; anything else as it came. */
  day(value: string): string;
  /** A quantity (decimal text) → the printed figure. */
  quantity(decimal: string): string;
  /** A percentage (`20`, `8.875`) → the printed rate. */
  percent(value: number): string;
}

/** `Intl`'s formatters take exact decimal text; the ES2022 types only say so for numbers. */
type Formatter = { format(value: number | string): string };

function intl(locale: string, options: Intl.NumberFormatOptions): Formatter {
  try {
    return new Intl.NumberFormat(locale, options) as unknown as Formatter;
  } catch {
    return new Intl.NumberFormat('en-US', options) as unknown as Formatter;
  }
}

/**
 * The formatters for one document.
 *
 * `latin` says whether the document's own words can be drawn in the PDF
 * writer's fonts; only then is an undrawable currency sign swapped for its
 * code (a document that goes to the print copy anyway keeps its sign).
 * `cents` is the authored template's own "show the cents" switch, honoured
 * only where the currency is a typed symbol.
 */
export function formatsFor(locale: string, currency: string, options: { latin: boolean; cents: boolean }): Formats {
  const digits = currencyDigits(currency);
  let money: (decimal: string) => string;
  if (isCurrencyCode(currency)) {
    const base: Intl.NumberFormatOptions = {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    };
    let formatter = intl(locale, base);
    if (options.latin && undrawnCharacters(formatter.format('0')).length > 0) {
      formatter = intl(locale, { ...base, currencyDisplay: 'code' });
    }
    money = (decimal) => formatter.format(decimal === '' ? '0' : decimal);
  } else {
    // An authored template's symbol, drawn by the law it was authored under.
    money = (decimal) => formatMoney(parseMinor(decimal), currency, options.cents);
  }

  const quantity = intl(locale, { maximumFractionDigits: 3 });
  const percent = intl(locale, { style: 'percent', maximumFractionDigits: 3 });
  let days: Intl.DateTimeFormat;
  try {
    days = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  } catch {
    days = new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  return {
    money,
    day: (value) => (/^\d{4}-\d{2}-\d{2}$/.test(value) ? days.format(new Date(`${value}T00:00:00.000Z`)) : value),
    quantity: (decimal) => (/^-?\d+(\.\d+)?$/.test(decimal) ? quantity.format(decimal) : decimal),
    percent: (value) => percent.format(value / 100),
  };
}

/**
 * The calendar day an instant falls on in a zone, as `YYYY-MM-DD`. The only
 * clock a renderer reads is the subject's `now`, and "today" on a document is
 * that instant's day where the business is.
 */
export function dayIn(iso: string, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date(iso));
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '';
    const day = `${part('year')}-${part('month')}-${part('day')}`;
    return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : iso.slice(0, 10);
  } catch {
    return iso.slice(0, 10);
  }
}
