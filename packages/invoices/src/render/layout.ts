/**
 * ONE LAYOUT, TWO RENDERERS — the reason this file exists at all.
 *
 * HTML and PDF are two ways of drawing the SAME document, and the failure this
 * file is built to prevent is the ordinary one: the two drift, somebody
 * downloads the PDF of an invoice they just previewed, and the two disagree
 * about what was on it. That is not a cosmetic bug on a document a customer is
 * asked to pay.
 *
 * So neither renderer decides anything. This module turns a body, its bound
 * extras and the subject's facts into a flat list of BLOCKS, and `html.ts` and
 * `pdf.ts` each know only how to draw those. A block that one of them cannot
 * draw is a block neither of them draws, because it would have to be added
 * here first.
 *
 * ── THE ANATOMY IS THE PRINTED COPY'S ──────────────────────────────────────
 *
 * One sheet for every kind, top to bottom: the letterhead (mark, name, the
 * business's own lines and tax number) → who it is for, beside the facts (the
 * kind and its number, the days, the terms) → the title → a quote's scope →
 * the lines → the totals → the payments so far and the amount due → a quote's
 * acceptance → the pay box beside the footer → the signature line. An order
 * to a supplier keeps the same sheet with its own middle: where the goods are
 * to arrive, the lines counted in packs and in units, and one total. A void
 * document carries the word across the sheet and the day it was voided —
 * NEVER the reason, which is the business's alone.
 *
 * ── STORED FIGURES, OR ADDED UP HERE ───────────────────────────────────────
 *
 * A document built on a shape carries its stored figures (`SubjectFacts`) and
 * they are printed as they are. A hand-mapped or authored document carries
 * none, and is added up by `money.ts`'s law, as it always was. The two paths
 * meet in one formatter, so the sign and the decimals are the currency's in
 * both.
 */

import type { InvoiceBody, LineItem } from '../document.ts';
import { isPurchaseOrder, PURCHASE_ORDER, PURCHASE_ORDER_UNPRICED } from '../kinds.ts';
import { lineMinor, taxBreakdown, totalsOf } from '../money.ts';
import { differenceText, isPositive, isZero, productText, sumText } from '../shape-money.ts';
import type { BoundExtras, LineFacts, OrderLine, StoredLine, SubjectFacts } from '../subject.ts';
import { minorToDecimal, type Formats } from './format.ts';
import { fill, type LayoutWords } from './words.ts';

export type { LayoutWords } from './words.ts';

/** The business's mark and name, and the lines beside them. */
export interface LetterheadBlock {
  readonly kind: 'letterhead';
  readonly name: string;
  /** The first letter of the name, drawn on the accent where there is no image. */
  readonly letter: string;
  /** A `data:` URI; drawn in HTML only. */
  readonly image: string;
  readonly lines: readonly string[];
}

export interface PartiesBlock {
  readonly kind: 'parties';
  readonly toLabel: string;
  readonly toName: string;
  readonly toLines: readonly string[];
  /**
   * `words` marks a value that is somebody's words — a name, a reference —
   * rather than a figure or a day: it may wrap on a till roll, and it keeps
   * its own direction on a right-to-left page.
   */
  readonly meta: readonly { readonly label: string; readonly value: string; readonly words?: boolean }[];
}

export interface TitleBlock {
  readonly kind: 'title';
  readonly text: string;
}

export interface ItemsBlock {
  readonly kind: 'items';
  readonly columns: readonly { readonly label: string; readonly align: 'left' | 'right' }[];
  /**
   * `note` is small print under the line's description: the names chosen on
   * it, a reduction, what a payment was against — one per `\n`-separated line.
   */
  readonly rows: readonly { readonly cells: readonly string[]; readonly note: string }[];
  /**
   * Set when the first column is the day each line is for, drawn before the
   * description. Only lines that carry a day make one, and never on a till
   * roll, where the day goes under the line instead — so a document whose
   * lines carry none is laid out exactly as it always was.
   */
  readonly lead?: true;
}

export interface LadderBlock {
  readonly kind: 'ladder';
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
    readonly emphasis: boolean;
  }[];
}

/** "Payments so far": each unvoided payment, and the amount still due, in bold. */
export interface LedgerBlock {
  readonly kind: 'ledger';
  readonly heading: string;
  readonly rows: readonly { readonly date: string; readonly method: string; readonly amount: string }[];
  readonly dueLabel: string;
  readonly due: string;
}

/** A quote's acceptance: the name typed, and the line under it. */
export interface SignedBlock {
  readonly kind: 'signed';
  readonly heading: string;
  readonly name: string;
  readonly line: string;
}

export interface PassageBlock {
  readonly kind: 'passage';
  readonly heading: string;
  readonly lines: readonly string[];
}

/** The pay box and the footer beside it, at the foot of the sheet. */
export interface FootBlock {
  readonly kind: 'foot';
  readonly payLabel: string;
  readonly payLines: readonly { readonly text: string; readonly strong: boolean }[];
  readonly footLabel: string;
  readonly footText: string;
}

export interface SignatureBlock {
  readonly kind: 'signature';
  readonly text: string;
}

export type Block =
  | LetterheadBlock
  | PartiesBlock
  | TitleBlock
  | ItemsBlock
  | LadderBlock
  | LedgerBlock
  | SignedBlock
  | PassageBlock
  | FootBlock
  | SignatureBlock;

export interface Document {
  readonly locale: string;
  /** Right-to-left is a property of the DOCUMENT's language, not the viewer's. */
  readonly rtl: boolean;
  readonly accent: string;
  /** The word drawn across a void document, or `null`. */
  readonly voidMark: string | null;
  /** The title the page is known by: the kind and its number. */
  readonly name: string;
  readonly blocks: readonly Block[];
}

export interface LayoutInput {
  readonly kind: string;
  readonly body: InvoiceBody;
  readonly extras: BoundExtras;
  readonly facts: SubjectFacts;
  readonly words: LayoutWords;
  readonly formats: Formats;
  readonly locale: string;
  readonly rtl: boolean;
  /** Whether the body was authored (a template) rather than drawn from a mapping alone. */
  readonly authored: boolean;
  /** Whether the sheet is a till roll: too narrow for a column of days, so a line's day goes under it. */
  readonly narrow?: boolean;
}

const TERM_WORDS: Readonly<Record<string, keyof LayoutWords>> = {
  net7: 'termNet7',
  net14: 'termNet14',
  net30: 'termNet30',
  'on-receipt': 'termOnReceipt',
};

/*
 * The ways to pay the page has a word for, and the spellings apps store them
 * in. An app's enum is its own — a practice writes `transfer`, a till
 * `gift_card`, a bank export `CREDIT_CARD` — so the value is read without its
 * case and with `_` and spaces as `-`, and every spelling here is one a real
 * app stores. A value that is not here is printed exactly as the app wrote it:
 * a method guessed wrong on a receipt is worse than one left in the app's own
 * words.
 */
const METHOD_WORDS: Readonly<Record<string, keyof LayoutWords>> = {
  'bank-transfer': 'methodBankTransfer',
  banktransfer: 'methodBankTransfer',
  bank: 'methodBankTransfer',
  transfer: 'methodBankTransfer',
  wire: 'methodBankTransfer',
  'wire-transfer': 'methodBankTransfer',
  card: 'methodCard',
  'credit-card': 'methodCard',
  creditcard: 'methodCard',
  'debit-card': 'methodCard',
  debitcard: 'methodCard',
  'bank-card': 'methodCard',
  cheque: 'methodCheque',
  check: 'methodCheque',
  cash: 'methodCash',
  'gift-card': 'methodGiftCard',
  giftcard: 'methodGiftCard',
  qr: 'methodQr',
  'qr-code': 'methodQr',
  other: 'methodOther',
};

/** A stored payment method in the document's language, or the value as the app wrote it. */
export function methodWord(value: string, words: LayoutWords): string {
  const key: unknown = METHOD_WORDS[value.trim().toLowerCase().replace(/[\s_]+/g, '-')];
  // Read through `typeof`: a stored `constructor` or `toString` finds the
  // object's own members, not a word, and is printed as written like any other.
  const word: unknown = typeof key === 'string' ? words[key as keyof LayoutWords] : undefined;
  return typeof word === 'string' ? word : value;
}

const KIND_WORDS: Readonly<Record<string, keyof LayoutWords>> = {
  invoice: 'kindInvoice',
  receipt: 'kindReceipt',
  'credit-note': 'kindCreditNote',
  quote: 'kindQuote',
  statement: 'kindStatement',
  // One word for both: the sheet a supplier holds says what it is, not what was left off it.
  [PURCHASE_ORDER]: 'kindPurchaseOrder',
  [PURCHASE_ORDER_UNPRICED]: 'kindPurchaseOrder',
};

/** A stored enum value in the document's language, or the value as typed. */
function named(value: string, map: Readonly<Record<string, keyof LayoutWords>>, words: LayoutWords): string {
  const key = map[value];
  return key === undefined ? value : words[key];
}

function row(label: string, value: string): { label: string; value: string; words?: boolean } | null {
  return value === '' ? null : { label, value };
}

/** A row whose value is somebody's words, not a figure. */
function wordsRow(label: string, value: string): { label: string; value: string; words: boolean } | null {
  return value === '' ? null : { label, value, words: true };
}

function notEmpty<T>(value: T | null): value is T {
  return value !== null;
}

/** Hundredths (the hand-mapped law's unit) as exact decimal text. */
const hundredths = (minor: number): string => minorToDecimal(minor, 2);

/** First and last four characters of a fingerprint, as the sheet prints it. */
function shortPrint(print: string): string {
  return print.length <= 10 ? print : `${print.slice(0, 4)}…${print.slice(-4)}`;
}

export function layout(input: LayoutInput): Document {
  const { kind, body, facts, words, formats } = input;
  const isVoid = facts.status === 'void' || (kind === 'receipt' && facts.receipt.voided);
  const voidDay = facts.voidedOn === '' ? '' : formats.day(facts.voidedOn);
  const kindWord = words[KIND_WORDS[kind] ?? 'kindInvoice'];

  const blocks: Block[] = [letterheadBlock(input)];
  blocks.push(partiesBlock(input, kindWord, isVoid, voidDay));

  const title = titleOf(input, kindWord);
  if (title !== '') blocks.push({ kind: 'title', text: title });

  if (kind === 'quote' && facts.quote.scope.length > 0) {
    blocks.push({ kind: 'passage', heading: '', lines: facts.quote.scope });
  }

  if (kind === 'statement') {
    blocks.push(...statementBlocks(input));
  } else if (isPurchaseOrder(kind)) {
    blocks.push(...purchaseOrderBlocks(input));
  } else if (kind === 'receipt' && facts.receipt.amount !== null && !hasLines(input)) {
    blocks.push(...paymentReceiptBlocks(input));
  } else {
    blocks.push(...documentBlocks(input, isVoid));
  }

  if (kind === 'quote' && facts.quote.signedName !== '') {
    const parts = [
      facts.quote.signedOn === '' ? '' : formats.day(facts.quote.signedOn),
      facts.quote.termsVersion === '' ? '' : fill(words.termsVersion, { version: facts.quote.termsVersion }),
      facts.quote.fingerprint === '' ? '' : fill(words.fingerprint, { print: shortPrint(facts.quote.fingerprint) }),
    ].filter((part) => part !== '');
    blocks.push({ kind: 'signed', heading: words.acceptedAndSigned, name: facts.quote.signedName, line: parts.join(' · ') });
  }

  if (body.notes !== '') blocks.push({ kind: 'passage', heading: words.notes, lines: [body.notes] });

  const foot = footBlock(input, isVoid, voidDay);
  if (foot !== null) blocks.push(foot);

  const signature = [
    facts.letterhead.name !== '' ? facts.letterhead.name : body.logoText,
    facts.preparedBy === '' ? formats.day(facts.today) : fill(words.preparedBy, { name: facts.preparedBy, date: formats.day(facts.today) }),
  ].filter((part) => part !== '');
  blocks.push({ kind: 'signature', text: signature.join(' · ') });

  return {
    locale: input.locale,
    rtl: input.rtl,
    accent: body.accent,
    voidMark: isVoid ? words.voidMark : null,
    name: [kindWord, kind === 'statement' ? '' : body.number].filter((part) => part !== '').join(' '),
    blocks,
  };
}

/**
 * The letterhead. An authored template's own name and lines win — a document
 * keeps the letterhead its template had — and the business's settings (which
 * Adminium puts in every subject) fill in where it has none.
 */
function letterheadBlock(input: LayoutInput): LetterheadBlock {
  const { body, facts, words } = input;
  const letterhead = facts.letterhead;
  const name = body.logoText !== '' ? body.logoText : letterhead.name;
  const lines = [...(body.from.length > 0 ? body.from : letterhead.lines)];
  if (letterhead.taxNumber !== '') {
    lines.push(letterhead.taxName === '' ? fill(words.taxNumber, { number: letterhead.taxNumber }) : `${letterhead.taxName} ${letterhead.taxNumber}`);
  }
  return {
    kind: 'letterhead',
    name,
    letter: [...name.trim()][0]?.toUpperCase() ?? '',
    image: drawableImage(body.logoImage !== '' ? body.logoImage : letterhead.logo),
    lines,
  };
}

/**
 * A letterhead image the page may carry: a raster `data:` URI and nothing
 * else — never an address to fetch, never a document of its own.
 */
function drawableImage(value: string): string {
  return /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(value) ? value : '';
}

function partiesBlock(input: LayoutInput, kindWord: string, isVoid: boolean, voidDay: string): PartiesBlock {
  const { kind, body, extras, facts, words, formats } = input;
  // An order is made out to the supplier it is sent to, never to a customer:
  // the name and the address under it come from the order's own slots.
  const order = isPurchaseOrder(kind);
  const toLabel = order
    ? words.supplier
    : kind === 'invoice'
      ? words.invoiceTo
      : kind === 'quote'
        ? words.quoteFor
        : kind === 'receipt'
          ? words.receivedFrom
          : kind === 'statement'
            ? words.statementFor
            : words.to;
  const toName = order ? facts.purchaseOrder.supplierName : body.customerName;
  const toLines = (
    order
      ? [facts.purchaseOrder.supplierEmail]
      : [
          facts.customerContact,
          ...body.customer,
          facts.customerTaxNumber === '' ? '' : fill(words.taxNumber, { number: facts.customerTaxNumber }),
          extras.customerEmail,
        ]
  ).filter((line) => line !== '');

  const day = (value: string) => (value === '' ? '' : formats.day(value));
  let meta: ({ label: string; value: string; words?: boolean } | null)[];
  switch (kind) {
    case 'quote':
      meta = [
        row(kindWord, body.number),
        row(words.sent, day(facts.quote.sentOn)),
        row(words.validUntil, day(facts.quote.validUntil)),
      ];
      break;
    case 'receipt':
      // What the receipt is and the number it is quoted by, then what the
      // money was for — the invoice, or the visit and who gave it — then when
      // it was received and how. Each row only when the app mapped a value.
      meta = [
        row(kindWord, body.number),
        row(words.receiptReference, facts.receipt.reference),
        row(words.forInvoice, facts.receipt.invoiceNumber),
        row(words.serviceDate, day(facts.receipt.serviceDate)),
        wordsRow(words.attendedBy, facts.receipt.attendedBy),
        row(words.received, day(body.issued)),
        row(words.method, methodWord(extras.paidWith, words)),
      ];
      break;
    case 'statement': {
      const period =
        facts.statement.periodFrom === '' ? day(facts.statement.periodTo) : `${day(facts.statement.periodFrom)} – ${day(facts.statement.periodTo)}`;
      const documents = facts.statement.entries.filter((entry) => entry.kind !== 'payment').length;
      meta = [
        row(words.period, facts.statement.periodTo === '' ? '' : period),
        row(words.issued, day(body.issued)),
        row(words.documents, facts.statement.entries.length === 0 ? '' : formats.quantity(String(documents))),
      ];
      break;
    }
    case PURCHASE_ORDER:
    case PURCHASE_ORDER_UNPRICED:
      // What it is and its number, the day it was sent, the day the goods are wanted.
      meta = [
        row(kindWord, body.number),
        row(words.date, day(body.issued)),
        row(words.expectedBy, day(facts.purchaseOrder.expectedBy)),
      ];
      break;
    default: {
      const { from, to } = facts.servicePeriod;
      /*
       * Both days as one span; one alone, or both the same, is that day. Two
       * days in the wrong order are printed as stored, first as first: the
       * figures on the page are the app's, and a period quietly turned round
       * would be a document that says something the records do not.
       */
      const period = from !== '' && to !== '' && from !== to ? `${day(from)} – ${day(to)}` : day(from !== '' ? from : to);
      meta = [
        row(kindWord, body.number),
        row(words.receiptReference, facts.reference),
        row(words.issued, day(body.issued)),
        row(words.due, day(body.due)),
        row(words.servicePeriod, period),
        row(words.terms, facts.terms === '' ? '' : named(facts.terms, TERM_WORDS, words)),
        row(words.reference, body.poNumber),
        row(words.corrects, extras.references),
      ];
    }
  }
  if (isVoid && voidDay !== '') meta.push(row(words.voided, voidDay));

  // A till receipt made out to nobody says nothing about whom it is for.
  const nobody = toName === '' && toLines.length === 0;
  return {
    kind: 'parties',
    toLabel: nobody ? '' : toLabel,
    toName,
    toLines,
    meta: meta.filter(notEmpty),
  };
}

function titleOf(input: LayoutInput, kindWord: string): string {
  const { kind, body, facts, words } = input;
  if (facts.title !== '') return facts.title;
  if (kind === 'statement') return words.statementTitle;
  if (kind === 'receipt' && facts.receipt.amount !== null) {
    return facts.receipt.invoiceNumber === ''
      ? `${kindWord} ${body.number}`.trim()
      : fill(words.receiptTitle, { number: body.number, invoice: facts.receipt.invoiceNumber });
  }
  // An authored template's own heading ("PROFORMA"); a mapping alone gets the kind's name.
  return input.authored ? body.title : kindWord;
}

function itemColumns(words: LayoutWords): ItemsBlock['columns'] {
  return [
    { label: words.description, align: 'left' },
    { label: words.quantity, align: 'right' },
    { label: words.unit, align: 'right' },
    { label: words.amount, align: 'right' },
  ];
}

/**
 * Whether the document maps lines of its own. A receipt that does is a SALE —
 * a till's ticket, a visit with its items — and is drawn with its lines and
 * totals even when the amount received is mapped too; without lines it is the
 * receipt of one payment against an invoice.
 */
function hasLines(input: LayoutInput): boolean {
  return input.facts.storedLines !== null || input.body.items.length > 0;
}

/** An invoice, a quote, a credit note or a till receipt: lines, totals, what is still due. */
function documentBlocks(input: LayoutInput, isVoid: boolean): Block[] {
  const { body, extras, facts, words, formats } = input;
  const money = formats.money;
  const blocks: Block[] = [];
  const stored = facts.total !== null;

  if (facts.storedLines !== null) {
    blocks.push(linesBlock(input, facts.storedLines.map((line) => ({ ...storedLineRow(line, input), line }))));
  } else {
    blocks.push(
      linesBlock(
        input,
        body.items.map((item: LineItem, at) => ({
          cells: [item.desc, formats.quantity(item.qty), money(item.rate), money(hundredths(lineMinor(item)))],
          note: '',
          line: extras.lines[at] ?? NO_LINE_FACTS,
        })),
      ),
    );
  }

  const rows: { label: string; value: string; emphasis: boolean }[] = [];
  const taxWord = facts.taxName !== '' ? facts.taxName : facts.letterhead.taxName !== '' ? facts.letterhead.taxName : words.tax;
  let totalText: string;

  if (stored) {
    const scale = facts.scale;
    const subtotal = facts.subtotal ?? facts.total!;
    const tax = facts.tax ?? differenceText(facts.total!, subtotal, scale);
    rows.push({ label: words.subtotal, value: money(subtotal), emphasis: false });
    /*
     * A sale stored with a reduction taken off the whole ticket keeps its
     * subtotal before the reduction and its total after it, and no column for
     * the reduction itself. The difference of the three stored figures IS
     * that reduction, so it is printed as one — on a receipt, only when all
     * three are stored and the total falls short of them. An invoice or a
     * quote on a shape stores its total as its subtotal and tax, and draws as
     * it always has.
     */
    if (input.kind === 'receipt' && facts.subtotal !== null && facts.tax !== null) {
      const off = differenceText(facts.total!, sumText([facts.subtotal, facts.tax], scale), scale);
      if (!isZero(off) && !isPositive(off)) rows.push({ label: words.reduction, value: money(off), emphasis: false });
    }
    if (!isZero(tax) || (facts.taxRate !== null && facts.taxRate !== 0)) {
      const rate = facts.taxRate === null ? '' : ` ${formats.percent(facts.taxRate / 100)}`;
      rows.push({ label: `${taxWord}${rate}`, value: money(tax), emphasis: false });
    }
    totalText = facts.total!;
  } else {
    const totals = totalsOf(body);
    rows.push({ label: words.subtotal, value: money(hundredths(totals.subtotal)), emphasis: false });
    if (totals.discount !== 0) {
      rows.push({
        label: `${words.reduction} ${formats.percent(Number(body.discountRate) || 0)}`,
        value: money(hundredths(-totals.discount)),
        emphasis: false,
      });
    }
    /*
     * The breakdown when the document has one, the single line when it does
     * not — and never both. Each component sits on the ladder's own base,
     * which is the correction the comp needed.
     */
    if (body.taxLines.length > 0) {
      for (const line of taxBreakdown(totals.taxBase, body.taxLines)) {
        rows.push({ label: `${line.label} ${formats.percent(Number(line.rate) || 0)}`, value: money(hundredths(line.amount)), emphasis: false });
      }
    } else if (totals.tax !== 0) {
      rows.push({ label: `${taxWord} ${formats.percent(Number(body.taxRate) || 0)}`, value: money(hundredths(totals.tax)), emphasis: false });
    }
    totalText = hundredths(totals.total);
  }

  if (extras.tip !== null && !isZero(extras.tip)) {
    rows.push({ label: words.gratuity, value: money(extras.tip), emphasis: false });
    totalText = sumText([totalText, extras.tip], Math.max(facts.scale, 2));
  }
  // "Total", not "Total due": what is still due is its own line, below, once
  // something has been paid.
  rows.push({ label: words.total, value: money(totalText), emphasis: true });

  // A sale's receipt that maps what was received: how it was paid, and what
  // is still open when the app says so.
  if (input.kind === 'receipt' && facts.receipt.amount !== null) {
    const how = extras.paidWith === '' ? words.received : methodWord(extras.paidWith, words);
    rows.push({ label: how, value: money(facts.receipt.amount), emphasis: false });
    if (facts.receipt.balanceAfter !== null) rows.push({ label: words.balanceLeft, value: money(facts.receipt.balanceAfter), emphasis: false });
  }

  // Only an invoice is paid against; a quote or a credit note owes nothing.
  const live = input.kind === 'invoice' ? facts.payments.filter((payment) => !payment.voided) : [];
  const paid = input.kind !== 'invoice' ? null : (facts.paid ?? (live.length > 0 ? sumText(live.map((payment) => payment.amount), facts.scale) : null));
  const due = facts.balance ?? (paid === null ? null : differenceText(totalText, paid, facts.scale));
  const somethingPaid = isPositive(paid);

  if (somethingPaid && !isVoid && !facts.showPaymentLedger) {
    rows.push({ label: words.paid, value: money(paid!), emphasis: false });
    rows.push({ label: words.amountDue, value: money(due ?? totalText), emphasis: true });
  }
  blocks.push({ kind: 'ladder', rows });

  if (somethingPaid && !isVoid && facts.showPaymentLedger) {
    blocks.push({
      kind: 'ledger',
      heading: words.paymentsSoFar,
      rows: live.map((payment) => ({
        date: payment.paidOn === '' ? '' : formats.day(payment.paidOn),
        method: methodWord(payment.method, words),
        amount: money(payment.amount),
      })),
      dueLabel: words.amountDue,
      due: money(due ?? totalText),
    });
  }
  return blocks;
}

const NO_LINE_FACTS: LineFacts = { date: '', options: [] };

/**
 * The most names printed under one line; the rest are counted. A line is
 * never split across pages, so a list with no end would run off a till roll
 * (and a long enough one past what the writer can draw at all).
 */
export const OPTIONS_SHOWN = 40;

/** A line's names as printed: every one, or the first `OPTIONS_SHOWN` and how many more. */
function namesLine(options: readonly string[], input: LayoutInput): string {
  if (options.length <= OPTIONS_SHOWN) return options.join(' · ');
  const more = fill(input.words.moreOptions, { count: input.formats.quantity(String(options.length - OPTIONS_SHOWN)) });
  return [...options.slice(0, OPTIONS_SHOWN), more].join(' · ');
}

/**
 * The lines of an invoice, a quote, a credit note or a sale, with what each
 * carries besides its figures.
 *
 * A line's names print under it, one after another, above any reduction. Its
 * day leads the row, in a column of its own, when any line has one; on a till
 * roll the day is the first line under the description instead. A document
 * whose lines carry neither gets exactly the block it always got.
 */
function linesBlock(
  input: LayoutInput,
  rows: readonly { readonly cells: readonly string[]; readonly note: string; readonly line: LineFacts }[],
): ItemsBlock {
  const { words, formats } = input;
  const narrow = input.narrow === true;
  const lead = !narrow && rows.some((row) => row.line.date !== '');
  const drawn = rows.map(({ cells, note, line }) => {
    const day = line.date === '' ? '' : formats.day(line.date);
    const notes = [narrow ? day : '', namesLine(line.options, input), note].filter((part) => part !== '');
    return { cells: lead ? [day, ...cells] : cells, note: notes.join('\n') };
  });
  const columns = itemColumns(words);
  return lead
    ? { kind: 'items', columns: [{ label: words.date, align: 'left' }, ...columns], rows: drawn, lead: true }
    : { kind: 'items', columns, rows: drawn };
}

function storedLineRow(line: StoredLine, input: LayoutInput): { cells: string[]; note: string } {
  const { facts, words, formats } = input;
  const amount = line.amount ?? productText(line.qty, line.rate, facts.scale);
  let note = '';
  if (line.discount !== null && line.discount !== 0) {
    const off = line.discountKind === 'percent' ? formats.percent(line.discount) : formats.money(String(line.discount));
    note = fill(words.lessDiscount, { amount: off });
  }
  return {
    cells: [line.desc, line.share === null ? formats.quantity(line.qty) : formats.percent(line.share), formats.money(line.rate), formats.money(amount)],
    note,
  };
}

/** The receipt of one payment: one line, what the invoice came to, what was received, what is left. */
function paymentReceiptBlocks(input: LayoutInput): Block[] {
  const { body, facts, words, formats } = input;
  const amount = facts.receipt.amount!;
  const received = body.issued === '' ? '' : formats.day(body.issued);
  const description =
    facts.receipt.invoiceNumber === '' ? words.kindReceipt : fill(words.paymentAgainst, { number: facts.receipt.invoiceNumber });
  const rows: { label: string; value: string; emphasis: boolean }[] = [];
  if (facts.receipt.invoiceTotal !== null) rows.push({ label: words.invoiceTotal, value: formats.money(facts.receipt.invoiceTotal), emphasis: false });
  rows.push({ label: received === '' ? words.received : fill(words.receivedOn, { date: received }), value: formats.money(amount), emphasis: true });
  if (facts.receipt.balanceAfter !== null) rows.push({ label: words.balanceLeft, value: formats.money(facts.receipt.balanceAfter), emphasis: false });
  return [
    {
      kind: 'items',
      columns: itemColumns(words),
      rows: [{ cells: [description, formats.quantity('1'), formats.money(amount), formats.money(amount)], note: '' }],
    },
    { kind: 'ladder', rows },
  ];
}

/** A statement: every entry of the period with the balance after it, then the totals. */
function statementBlocks(input: LayoutInput): Block[] {
  const { facts, words, formats } = input;
  const s = facts.statement;
  const minus = (text: string) => (text.startsWith('-') ? text.slice(1) : `-${text}`);
  const entryRows = s.entries.map((entry) => {
    const payment = entry.kind === 'payment';
    const label = fill(payment ? words.paymentEntry : words.invoiceEntry, { number: entry.number }).trim();
    return {
      cells: [
        label,
        entry.date === '' ? '' : formats.day(entry.date),
        formats.money(payment ? minus(entry.amount) : entry.amount),
        entry.balance === null ? '' : formats.money(entry.balance),
      ],
      note: '',
    };
  });
  const rows: { label: string; value: string; emphasis: boolean }[] = [];
  if (s.opening !== null && (s.periodFrom !== '' || !isZero(s.opening))) rows.push({ label: words.openingBalance, value: formats.money(s.opening), emphasis: false });
  if (s.documentsTotal !== null) rows.push({ label: words.invoiced, value: formats.money(s.documentsTotal), emphasis: false });
  if (s.paymentsTotal !== null) rows.push({ label: words.paid, value: formats.money(s.paymentsTotal), emphasis: false });
  const closing = s.closing ?? (s.entries.length > 0 ? s.entries[s.entries.length - 1]!.balance : null);
  if (closing !== null) rows.push({ label: words.balance, value: formats.money(closing), emphasis: true });
  return [
    {
      kind: 'items',
      columns: [
        { label: words.entry, align: 'left' },
        { label: words.date, align: 'right' },
        { label: words.amount, align: 'right' },
        { label: words.balance, align: 'right' },
      ],
      rows: entryRows,
    },
    { kind: 'ladder', rows },
  ];
}

/** A quantity and the name of what is counted, joined as the sheet prints them; `''` with no quantity. */
function counted(quantity: string | null, name: string, joiner: string, formats: Formats): string {
  if (quantity === null) return '';
  return name === '' ? formats.quantity(quantity) : `${formats.quantity(quantity)}${joiner}${name}`;
}

/** What a line of an order comes to: the stored amount, or packs times the price of one, or `null`. */
function orderLineAmount(line: OrderLine, scale: number): string | null {
  if (line.amount !== null) return line.amount;
  return line.packs === null || line.rate === null ? null : productText(line.packs, line.rate, scale);
}

/**
 * An order to a supplier: where the goods are to arrive, every line counted
 * in the supplier's packs and in the item's own unit, and — on the order sent
 * with its prices — what a pack costs, what each line comes to and the total.
 *
 * WITH PRICES OR WITHOUT IS THE KIND, read once, here. Everything that
 * touches a price below sits behind that one flag: the two columns, their
 * cells and the ladder. The order sent without prices is therefore not the
 * other one with figures blanked out — it has three columns and no ladder,
 * and a price a caller sent anyway is never looked at.
 */
function purchaseOrderBlocks(input: LayoutInput): Block[] {
  const { facts, words, formats } = input;
  const order = facts.purchaseOrder;
  const priced = input.kind === PURCHASE_ORDER;
  const blocks: Block[] = [];

  const place = [order.deliverTo, ...order.deliverLines].filter((line) => line !== '');
  if (place.length > 0) blocks.push({ kind: 'passage', heading: words.deliverTo, lines: place });

  const amounts = priced ? order.lines.map((line) => orderLineAmount(line, facts.scale)) : [];
  blocks.push({
    kind: 'items',
    columns: [
      { label: words.description, align: 'left' },
      { label: words.packs, align: 'right' },
      { label: words.units, align: 'right' },
      ...(priced
        ? [
            { label: words.pricePerPack, align: 'right' as const },
            { label: words.amount, align: 'right' as const },
          ]
        : []),
    ],
    rows: order.lines.map((line, at) => {
      const amount = amounts[at] ?? null;
      return {
        cells: [
          line.desc,
          counted(line.packs, line.pack, ' × ', formats),
          counted(line.units, line.unit, ' ', formats),
          ...(priced ? [line.rate === null ? '' : formats.money(line.rate), amount === null ? '' : formats.money(amount)] : []),
        ],
        // The number the supplier knows the item by, under the business's own name for it.
        note: line.code,
      };
    }),
  });

  if (priced) {
    // The stored total as stored; with none mapped, the lines' amounts added up.
    const known = amounts.filter(notEmpty);
    const total = facts.total ?? (known.length > 0 ? sumText(known, facts.scale) : null);
    if (total !== null) blocks.push({ kind: 'ladder', rows: [{ label: words.total, value: formats.money(total), emphasis: true }] });
  }
  return blocks;
}

/**
 * The pay box and the footer. How to pay (the business's instructions, then
 * the reference to quote) on an invoice or a statement; the thanks on a
 * receipt; a quote's split. Nothing to pay on a void document, and its footer
 * says why the number is still there. Nothing to pay on an order to a supplier
 * either — the business is the one who will be asked — so it keeps the footer
 * and has no pay box.
 */
function footBlock(input: LayoutInput, isVoid: boolean, voidDay: string): FootBlock | null {
  const { kind, body, facts, words, formats } = input;
  const instructions = facts.letterhead.paymentInstructions === '' ? body.payment : facts.letterhead.paymentInstructions.split('\n').filter((line) => line.trim() !== '');
  let payLabel = '';
  let payLines: { text: string; strong: boolean }[] = [];
  let footLabel = words.terms;
  let footText = body.terms !== '' ? body.terms : facts.letterhead.footer;

  if (kind === 'receipt' && facts.receipt.amount !== null) {
    const received = body.issued === '' ? '' : formats.day(body.issued);
    payLabel = words.thankYou;
    payLines = [{ text: fill(words.receivedLine, { amount: formats.money(facts.receipt.amount), date: received }).trim(), strong: false }];
    if (facts.receipt.balanceAfter !== null) payLines.push({ text: fill(words.balanceLeftLine, { amount: formats.money(facts.receipt.balanceAfter) }), strong: false });
    footLabel = words.note;
    footText = words.receiptNote;
  } else if (kind === 'quote') {
    if (facts.quote.split.length > 0) {
      payLabel = words.howItGetsPaid;
      payLines = facts.quote.split.map((line) => ({ text: line, strong: false }));
    }
  } else if (kind === 'statement') {
    payLabel = words.howToPay;
    payLines = [...instructions.map((line) => ({ text: line, strong: false })), { text: words.referenceInvoiceNumber, strong: true }];
  } else if (!isVoid && !isPurchaseOrder(kind) && (kind === 'invoice' || instructions.length > 0)) {
    payLabel = words.howToPay;
    payLines = instructions.map((line) => ({ text: line, strong: false }));
    if (kind === 'invoice' && body.number !== '') payLines.push({ text: fill(words.referenceLine, { number: body.number }), strong: true });
  }

  if (isVoid) {
    // The day, and why the number is kept. The REASON is the business's own
    // note and never reaches the page.
    footText = voidDay === '' ? '' : fill(words.voidedFooter, { date: voidDay });
    footLabel = words.voided;
  }
  if (kind === 'receipt' && facts.receipt.amount === null && input.extras.paidWith !== '' && payLines.length === 0) {
    payLabel = words.settledWith;
    payLines = [{ text: methodWord(input.extras.paidWith, words), strong: false }];
  }

  if (payLines.length === 0 && footText === '') return null;
  return { kind: 'foot', payLabel, payLines, footLabel: footText === '' ? '' : footLabel, footText };
}
