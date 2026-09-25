/**
 * The subject, checked and turned into a document this package can draw.
 *
 * ── TWO LAWS MEET HERE, AND THE JOIN HAS TO BE EXACT ───────────────────────
 *
 * The CONTRACT's wire law is integers: money in minor units of the DOCUMENT's
 * currency — cents for euros, yen for yen, fils for Kuwaiti dinars — and a
 * percentage in basis points (`document-render@1`, asserted by its conformance
 * suite). This package works in decimal TEXT — `qty: "1.5"`, `rate: "180"` —
 * because that is what a person types into the editor and what the surface
 * stores.
 *
 * Both are right for their side, so something has to convert, and the
 * conversion has to be LOSSLESS or the printed total stops matching the stored
 * one. It is, because it only ever goes one way: an integer number of minor
 * units has one exact decimal spelling at the currency's own decimals
 * (`1250` → `"12.50"` in euros, `"1.250"` in dinars, `"1250"` in yen).
 *
 * WHICH currency the units are in is the document's: the `currency` slot when
 * it holds a code, else the subject's own. Adminium converts with the same
 * rule, and a test here renders a yen and a dinar document to prove the two
 * ends agree.
 *
 * ── MISSING_SLOT IS DECIDED HERE, ONCE ─────────────────────────────────────
 *
 * A required slot with a `default` is the ENGINE's to fill — `sequence`, `now`,
 * `connection` — so an empty value for one of those is not a refusal, it is a
 * value that has not been minted yet. Only a required slot with no default can
 * be missing. Getting that backwards would refuse every document that had not
 * been given a number yet, which is all of them at render time.
 *
 * ── STORED FIGURES ARE PRINTED AS STORED ───────────────────────────────────
 *
 * A document built on one of this add-on's shapes arrives with the figures
 * Adminium worked out and stored — each line's amount, the subtotal, the tax,
 * the total, what has been paid and what is still due. Those are what the
 * page prints (`SubjectFacts`), never a second computation of them: a printed
 * total that differed from the stored one by a rounding would be a document
 * the business cannot stand behind. Only a hand-mapped profile, which maps no
 * stored totals, is added up here, by `money.ts`'s own law.
 */

import type { DocumentError, DocumentSubject, OutlineSlot } from '@adminium/add-on-host/contracts';

import { describe } from './kinds.ts';
import type { InvoiceBody, LineItem } from './document.ts';
import { emptyBody, normalizeInvoiceBody } from './document.ts';
import { currencyDigits, dayIn, isCurrencyCode, minorToDecimal } from './render/format.ts';
import { settingsFrom, type InvoiceSettings } from './settings.ts';

/**
 * An integer number of minor units → the exact decimal text the money law
 * reads, at the currency's decimals (two when none is said).
 */
export function minorToText(minor: number, scale = 2): string {
  return minorToDecimal(minor, scale);
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
  return text === '' ? [] : text.split('\n').filter((line) => line !== '');
}

/** A date value as `YYYY-MM-DD`, however the connection handed it over. */
function dateOf(value: unknown): string {
  const text = textOf(value);
  // An ISO datetime, an ISO date, or something the database spelled its own
  // way. The first ten characters of an ISO string are the date; anything
  // else is passed through so a locale-formatted column still prints as typed.
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : text;
}

/** A flag the drivers spell four ways: `true`, `1`, `"1"`, `"true"`. */
function flagOf(value: unknown): boolean {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') return ['1', 'true', 't', 'yes'].includes(value.trim().toLowerCase());
  return false;
}

/** Integer minor units → decimal text, or `null` when the slot holds none. */
function moneyOf(value: unknown, scale: number): string | null {
  return typeof value === 'number' && Number.isFinite(value) ? minorToDecimal(value, scale) : null;
}

/** A plain number the engine passed through (`number` slots), or `null`. */
function numberOf(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A receipt number in the add-on's receipt series.
 *
 * A number that is only digits is the bare count Adminium's register hands a
 * profile that maps no number of its own — a till's sales or a practice's
 * payments, numbered by the document register rather than by a shape. It is
 * printed after the receipt series' prefix, so the page says `REC-2` and not
 * `2`. Anything else is the app's own number and is printed as the app wrote
 * it: a prefix is never added twice, and never added to a number with letters.
 */
export function inSeries(number: string, prefix: string): string {
  return /^\d+$/.test(number) ? `${prefix}${number}` : number;
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

function itemsFrom(slot: OutlineSlot | undefined, subject: DocumentSubject, scale: number): LineItem[] {
  if (slot === undefined) return [];
  const rows = subject.collections[slot.id] ?? [];
  return rows.map((row, at) => ({
    // The stored id, or the row's ordinal. NEVER a minted one: a random source
    // anywhere in a render path makes 25 D12's byte-identical claim false.
    id: textOf(row.id) === '' ? `row_${String(at)}` : textOf(row.id),
    desc: textOf(row.desc),
    qty: quantityToText(row.qty ?? 1),
    rate: minorToText(typeof row.rate === 'number' ? row.rate : 0, scale),
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
  /** A receipt's gratuity, as decimal text in the document's currency. `null` when none was mapped. */
  readonly tip: string | null;
  /** Stored with the document; nothing is sent until somebody presses send. */
  readonly customerEmail: string;
}

/** One line as a shape stores it: the figures Adminium worked out ride with it. */
export interface StoredLine {
  readonly desc: string;
  readonly qty: string;
  readonly rate: string;
  /** The stored amount, or `null` for a line that has none (it is then drawn as qty × rate). */
  readonly amount: string | null;
  readonly discount: number | null;
  readonly discountKind: string;
  /** A stage of a quote: the share it bills, printed where the quantity goes. */
  readonly share: number | null;
}

export interface StoredPayment {
  readonly number: string;
  readonly paidOn: string;
  readonly method: string;
  readonly amount: string;
  readonly voided: boolean;
}

export interface StatementEntry {
  readonly date: string;
  readonly kind: string;
  readonly number: string;
  readonly amount: string;
  readonly balance: string | null;
}

/** The letterhead as the document prints it, from the subject and, behind it, the settings. */
export interface Letterhead {
  readonly name: string;
  readonly lines: readonly string[];
  readonly logo: string;
  readonly taxName: string;
  readonly taxNumber: string;
  readonly paymentInstructions: string;
  readonly footer: string;
}

/**
 * Everything a document built on a shape (or any richer mapping) carries
 * beyond the authored body — each `null` or empty when its slot is unmapped,
 * which is what keeps a hand-mapped profile drawing exactly as it did.
 */
export interface SubjectFacts {
  /** The ISO code the figures are in, or the authored symbol. */
  readonly currency: string;
  /** The decimals every figure below is written at. */
  readonly scale: number;
  readonly today: string;
  readonly letterhead: Letterhead;
  readonly showPaymentLedger: boolean;
  readonly title: string;
  readonly customerContact: string;
  readonly customerTaxNumber: string;
  readonly taxName: string;
  /** Basis points, or `null`. */
  readonly taxRate: number | null;
  readonly terms: string;
  readonly subtotal: string | null;
  readonly tax: string | null;
  readonly total: string | null;
  readonly paid: string | null;
  readonly balance: string | null;
  readonly status: string;
  readonly voidedOn: string;
  readonly preparedBy: string;
  /** The lines with their stored figures, or `null` when no line carries one. */
  readonly storedLines: readonly StoredLine[] | null;
  readonly payments: readonly StoredPayment[];
  readonly receipt: {
    readonly amount: string | null;
    readonly invoiceNumber: string;
    readonly invoiceTotal: string | null;
    readonly balanceAfter: string | null;
    readonly voided: boolean;
    /** What the payment was for, when it was not an invoice: the day of the visit, who gave it, the payer's reference. */
    readonly serviceDate: string;
    readonly attendedBy: string;
    readonly reference: string;
  };
  readonly quote: {
    readonly sentOn: string;
    readonly validUntil: string;
    readonly scope: readonly string[];
    readonly split: readonly string[];
    readonly signedName: string;
    readonly signedOn: string;
    readonly termsVersion: string;
    readonly fingerprint: string;
  };
  readonly statement: {
    readonly periodFrom: string;
    readonly periodTo: string;
    readonly opening: string | null;
    readonly documentsTotal: string | null;
    readonly paymentsTotal: string | null;
    readonly closing: string | null;
    readonly entries: readonly StatementEntry[];
  };
}

export interface BoundDocument {
  readonly body: InvoiceBody;
  readonly extras: BoundExtras;
  readonly facts: SubjectFacts;
}

/**
 * The letterhead fields a newer Adminium puts in the subject. The copy of the
 * contract this repository vendors predates them, so they are read as
 * optional strings — an older server sends none, and the settings fill in.
 */
type BusinessWithDetails = DocumentSubject['business'] & {
  readonly taxNumber?: unknown;
  readonly paymentInstructions?: unknown;
  readonly footer?: unknown;
};

function letterheadFrom(subject: DocumentSubject, settings: InvoiceSettings): Letterhead {
  const business = subject.business as BusinessWithDetails;
  const given = (value: unknown, fallback: string): string =>
    typeof value === 'string' && value.trim() !== '' ? value : fallback;
  return {
    name: given(business.name, settings.businessName),
    lines: business.lines.length > 0 ? business.lines : settings.businessLines,
    logo: given(business.logoDataUrl, settings.logoDataUrl),
    taxName: settings.taxName,
    taxNumber: given(business.taxNumber, settings.taxNumber),
    paymentInstructions: given(business.paymentInstructions, settings.paymentInstructions),
    footer: given(business.footer, settings.footer),
  };
}

/** Whether the subject maps a value for a slot. */
function present(subject: DocumentSubject, id: string): boolean {
  const value = subject.fields[id];
  return value !== undefined && value !== null && value !== '';
}

/**
 * Fold the subject's bound values into the authored body.
 *
 * PRECEDENCE, STATED: a MAPPED value wins over an authored one, and an absent
 * mapped value leaves the authored one alone. That is the only order that
 * makes a template useful — the template carries the wording, the terms and
 * the layout, and the record carries this customer's name and this month's
 * lines. The reverse would make every document from a template identical.
 *
 * The CURRENCY is the one exception to "authored wins when unmapped": a
 * document with no authored body is in the subject's currency, never in the
 * empty template's placeholder symbol.
 */
export function documentFrom(
  kind: string,
  subject: DocumentSubject,
  body: Readonly<Record<string, unknown>> | undefined,
  rawSettings?: Readonly<Record<string, unknown>>,
): BoundDocument {
  const authored = body !== undefined;
  const base: InvoiceBody = authored ? normalizeInvoiceBody(body) : emptyBody();
  const outline = describe(kind);
  const has = (id: string): boolean => present(subject, id);
  const settings = settingsFrom(rawSettings);

  const next: InvoiceBody = { ...base };

  if (has('currency')) next.currency = textOf(subject.fields.currency);
  else if (!authored || next.currency === '') next.currency = subject.currency;
  // Minor units are in the DOCUMENT's currency; an authored symbol falls back to the subject's code.
  const scale = currencyDigits(isCurrencyCode(next.currency) ? next.currency : subject.currency);

  const items = itemsFrom(
    outline.slots.find((slot) => slot.id === 'items'),
    subject,
    scale,
  );

  const given = subject.number !== null && subject.number !== '' ? subject.number : has('number') ? textOf(subject.fields.number) : '';
  if (given !== '') next.number = kind === 'receipt' ? inSeries(given, settings.prefixes.receipt) : given;

  if (has('issuedAt')) next.issued = dateOf(subject.fields.issuedAt);
  else if (next.issued === '') next.issued = subject.now.iso.slice(0, 10);

  if (has('dueAt')) next.due = dateOf(subject.fields.dueAt);
  if (has('customerName')) next.customerName = textOf(subject.fields.customerName);
  if (has('customerLines')) next.customer = linesOf(subject.fields.customerLines);
  if (has('poNumber')) next.poNumber = textOf(subject.fields.poNumber);

  if (has('taxRate')) next.taxRate = basisPointsToText(Number(subject.fields.taxRate));
  if (has('discountRate')) {
    next.discountRate = basisPointsToText(Number(subject.fields.discountRate));
  }
  if (items.length > 0) next.items = items;

  const rows = subject.collections.items ?? [];
  const storedLines: StoredLine[] | null = rows.some((row) => typeof row.amount === 'number' || typeof row.share === 'number')
    ? rows.map((row) => ({
        desc: textOf(row.desc),
        qty: quantityToText(row.qty ?? 1),
        rate: minorToText(typeof row.rate === 'number' ? row.rate : 0, scale),
        amount: moneyOf(row.amount, scale),
        discount: numberOf(row.discount),
        discountKind: textOf(row.discountKind),
        share: numberOf(row.share),
      }))
    : null;

  const payments: StoredPayment[] = (subject.collections.payments ?? []).map((row) => ({
    number: textOf(row.number),
    paidOn: dateOf(row.paidOn),
    method: textOf(row.method),
    amount: moneyOf(row.amount, scale) ?? minorToText(0, scale),
    voided: flagOf(row.voided),
  }));

  const entries: StatementEntry[] = (subject.collections.entries ?? []).map((row) => ({
    date: dateOf(row.date),
    kind: textOf(row.kind),
    number: textOf(row.number),
    amount: moneyOf(row.amount, scale) ?? minorToText(0, scale),
    balance: moneyOf(row.balance, scale),
  }));

  const field = (id: string): unknown => subject.fields[id];
  const facts: SubjectFacts = {
    currency: next.currency,
    scale,
    today: dayIn(subject.now.iso, subject.now.timezone),
    letterhead: letterheadFrom(subject, settings),
    showPaymentLedger: settings.showPaymentLedger,
    title: textOf(field('title')),
    customerContact: textOf(field('customerContact')),
    customerTaxNumber: textOf(field('customerTaxNumber')),
    taxName: textOf(field('taxName')),
    taxRate: has('taxRate') ? numberOf(field('taxRate')) : null,
    terms: textOf(field('terms')),
    subtotal: moneyOf(field('subtotal'), scale),
    tax: moneyOf(field('tax'), scale),
    total: moneyOf(field('total'), scale),
    paid: moneyOf(field('paid'), scale),
    balance: moneyOf(field('balance'), scale),
    status: textOf(field('status')).toLowerCase(),
    voidedOn: dateOf(field('voidedOn')),
    preparedBy: textOf(field('preparedBy')),
    storedLines,
    payments,
    receipt: {
      amount: moneyOf(field('amount'), scale),
      invoiceNumber: textOf(field('invoiceNumber')),
      invoiceTotal: moneyOf(field('invoiceTotal'), scale),
      balanceAfter: moneyOf(field('balanceAfter'), scale),
      voided: flagOf(field('voided')),
      serviceDate: dateOf(field('serviceDate')),
      attendedBy: textOf(field('attendedBy')).trim(),
      reference: textOf(field('reference')).trim(),
    },
    quote: {
      sentOn: dateOf(field('sentOn')),
      validUntil: dateOf(field('validUntil')),
      scope: linesOf(field('scope')),
      split: linesOf(field('paymentSplit')),
      signedName: textOf(field('signedName')),
      signedOn: dateOf(field('signedOn')),
      termsVersion: textOf(field('termsVersion')),
      fingerprint: textOf(field('fingerprint')),
    },
    statement: {
      periodFrom: dateOf(field('periodFrom')),
      periodTo: dateOf(field('periodTo')),
      opening: moneyOf(field('openingBalance'), scale),
      documentsTotal: moneyOf(field('documentsTotal'), scale),
      paymentsTotal: moneyOf(field('paymentsTotal'), scale),
      closing: moneyOf(field('closingBalance'), scale),
      entries,
    },
  };

  return {
    body: next,
    extras: {
      references: textOf(subject.fields.references),
      paidWith: textOf(subject.fields.paidWith),
      tip: moneyOf(subject.fields.tip, scale),
      customerEmail: textOf(subject.fields.customerEmail),
    },
    facts,
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
