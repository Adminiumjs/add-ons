/**
 * The subject, checked and turned into a document this package can draw.
 *
 * ── TWO LAWS MEET HERE, AND THE JOIN HAS TO BE EXACT ───────────────────────
 *
 * The CONTRACT's wire law is integers: money in minor units, a percentage in
 * basis points (`document-render@1`, asserted by its conformance suite). This
 * package's ARITHMETIC law is decimal text — `qty: "1.5"`, `rate: "180"` —
 * because that is what a person types into the editor and what the surface
 * stores, and all three trees that compute a total share it through one
 * fixture (`money.ts`, 34 D20/O25).
 *
 * Both are right for their side, so something has to convert, and the
 * conversion has to be LOSSLESS or the printed total stops matching the stored
 * one. It is, and the reason is that it only ever goes one way: an integer
 * number of minor units has an exact two-decimal spelling (`1234` → `"12.34"`),
 * and `parseMinor` reads that spelling back to the same integer. `subject.test.ts`
 * asserts the round trip over the whole fixture rather than over an example.
 *
 * ── MISSING_SLOT IS DECIDED HERE, ONCE ─────────────────────────────────────
 *
 * A required slot with a `default` is the ENGINE's to fill — `sequence`, `now`,
 * `connection` — so an empty value for one of those is not a refusal, it is a
 * value that has not been minted yet. Only a required slot with no default can
 * be missing. Getting that backwards would refuse every document that had not
 * been given a number yet, which is all of them at render time.
 */

import type { DocumentError, DocumentSubject, OutlineSlot } from '@adminium/add-on-host/contracts';

import { describe } from './kinds.ts';
import type { InvoiceBody, LineItem } from './document.ts';
import { emptyBody, normalizeInvoiceBody } from './document.ts';

/** An integer number of minor units → the exact decimal text the money law reads. */
export function minorToText(minor: number): string {
  if (!Number.isFinite(minor)) return '0';
  const rounded = Math.trunc(minor);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  return `${negative ? '-' : ''}${String(whole)}.${String(cents).padStart(2, '0')}`;
}

/** Basis points → percent as decimal text. 2000 → `"20"`, 750 → `"7.5"`. */
export function basisPointsToText(bp: number): string {
  if (!Number.isFinite(bp)) return '0';
  const rounded = Math.trunc(bp);
  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const whole = Math.floor(abs / 100);
  const rest = abs % 100;
  const fraction = rest === 0 ? '' : `.${String(rest).padStart(2, '0').replace(/0$/, '')}`;
  return `${negative ? '-' : ''}${String(whole)}${fraction}`;
}

/**
 * A quantity as the money law wants it.
 *
 * `String(number)` and not `toFixed`: the law parses a decimal, a quantity of
 * three is `"3"` and not `"3.000"`, and JavaScript's own shortest round-trip
 * spelling is exactly the right one — `1.5` prints `"1.5"`. The one thing to
 * keep out is exponent notation, which `parseDecimal` reads as zero; a
 * quantity large enough to reach it is not a quantity.
 */
export function quantityToText(value: unknown): string {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return '0';
  const text = String(number);
  return text.includes('e') || text.includes('E') ? number.toFixed(6) : text;
}

function textOf(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
}

function linesOf(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(textOf).filter((line) => line !== '');
  const text = textOf(value);
  return text === '' ? [] : text.split('\n');
}

/** A date value as `YYYY-MM-DD`, however the connection handed it over. */
function dateOf(value: unknown): string {
  const text = textOf(value);
  // An ISO datetime, an ISO date, or something the database spelled its own
  // way. The first ten characters of an ISO string are the date; anything
  // else is passed through so a locale-formatted column still prints as typed.
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

/** Every required slot with no engine-supplied default that has no value. */
export function missingSlots(kind: string, subject: DocumentSubject): readonly string[] {
  const missing: string[] = [];
  for (const slot of describe(kind).slots) {
    if (!slot.required || slot.default !== undefined) continue;
    const value = subject.fields[slot.id];
    if (value === undefined || value === null || value === '') missing.push(slot.id);
  }
  return missing;
}

function itemsFrom(slot: OutlineSlot | undefined, subject: DocumentSubject): LineItem[] {
  if (slot === undefined) return [];
  const rows = subject.collections[slot.id] ?? [];
  return rows.map((row, at) => ({
    // The stored id, or the row's ordinal. NEVER a minted one: a random source
    // anywhere in a render path makes 25 D12's byte-identical claim false.
    id: textOf(row.id) === '' ? `row_${String(at)}` : textOf(row.id),
    desc: textOf(row.desc),
    qty: quantityToText(row.qty ?? 1),
    rate: minorToText(typeof row.rate === 'number' ? row.rate : 0),
  }));
}

/**
 * The bound values that have NO field in the authored body.
 *
 * §5.2's second amendment, made concrete. Three of this contract's slots —
 * `customerEmail`, `paidWith`, `tip` — are drawn nowhere in
 * `Invoice Builder.dc.html`, and `references` is a credit note's, which that
 * comp does not draw either. That is not a mistake in the comp: it is the
 * invoice AUTHORING surface, and none of these four is something a person
 * types into a template. They arrive from a record or from a till.
 *
 * So they are not smuggled into `InvoiceBody`. That type is the shape the
 * dashboard's envelope and the server's row already share, and widening it
 * here to hold a value neither of them stores would put this package's copy
 * quietly out of step with two trees that have no reason to change. They ride
 * alongside instead, and the layout draws them from here.
 */
export interface BoundExtras {
  /** A credit note's "this corrects document X". */
  readonly references: string;
  /** A receipt's payment method. */
  readonly paidWith: string;
  /** A receipt's gratuity, in minor units. `null` when none was mapped. */
  readonly tip: number | null;
  /** Stored with the document; nothing is sent until somebody presses send. */
  readonly customerEmail: string;
}

export interface BoundDocument {
  readonly body: InvoiceBody;
  readonly extras: BoundExtras;
}

/**
 * Fold the subject's bound values into the authored body.
 *
 * PRECEDENCE, STATED: a MAPPED value wins over an authored one, and an absent
 * mapped value leaves the authored one alone. That is the only order that
 * makes a template useful — the template carries the wording, the terms and
 * the layout, and the record carries this customer's name and this month's
 * lines. The reverse would make every document from a template identical.
 */
export function documentFrom(
  kind: string,
  subject: DocumentSubject,
  body: Readonly<Record<string, unknown>> | undefined,
): BoundDocument {
  const base: InvoiceBody = body === undefined ? emptyBody() : normalizeInvoiceBody(body);
  const outline = describe(kind);
  const has = (id: string): boolean => {
    const value = subject.fields[id];
    return value !== undefined && value !== null && value !== '';
  };

  const items = itemsFrom(
    outline.slots.find((slot) => slot.type === 'collection'),
    subject,
  );

  const next: InvoiceBody = { ...base };

  if (subject.number !== null && subject.number !== '') next.number = subject.number;
  else if (has('number')) next.number = textOf(subject.fields.number);

  if (has('issuedAt')) next.issued = dateOf(subject.fields.issuedAt);
  else if (next.issued === '') next.issued = subject.now.iso.slice(0, 10);

  if (has('dueAt')) next.due = dateOf(subject.fields.dueAt);
  if (has('customerName')) next.customerName = textOf(subject.fields.customerName);
  if (has('customerLines')) next.customer = linesOf(subject.fields.customerLines);
  if (has('poNumber')) next.poNumber = textOf(subject.fields.poNumber);

  // The connection's currency is a SYMBOL on the page; the subject's is an
  // ISO-4217 code. A three-letter code drawn where a symbol belongs is not
  // wrong, just plainer, and inventing a symbol table for 180 currencies is
  // how a renderer starts being opinionated about money it does not own.
  if (has('currency')) next.currency = textOf(subject.fields.currency);
  else if (next.currency === '') next.currency = subject.currency;

  if (has('taxRate')) next.taxRate = basisPointsToText(Number(subject.fields.taxRate));
  if (has('discountRate')) {
    next.discountRate = basisPointsToText(Number(subject.fields.discountRate));
  }
  if (items.length > 0) next.items = items;

  return {
    body: next,
    extras: {
      references: textOf(subject.fields.references),
      paidWith: textOf(subject.fields.paidWith),
      tip: typeof subject.fields.tip === 'number' ? subject.fields.tip : null,
      customerEmail: textOf(subject.fields.customerEmail),
    },
  };
}

/** The refusal, or `null` when the subject can be drawn. */
export function refuseSubject(
  kind: string,
  subject: DocumentSubject,
): DocumentError | null {
  const missing = missingSlots(kind, subject);
  if (missing.length > 0) {
    return {
      code: 'MISSING_SLOT',
      // Every one of them, not the first: an operator fixing a mapping wants
      // the whole list, and coming back three times for three columns is the
      // experience a first-only refusal gives.
      detail: missing.map((id) => `'${id}' has no value`).join('; '),
    };
  }
  return null;
}
