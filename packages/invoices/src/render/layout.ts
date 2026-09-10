/**
 * ONE LAYOUT, TWO RENDERERS — the reason this file exists at all.
 *
 * HTML and PDF are two ways of drawing the SAME document, and the failure this
 * file is built to prevent is the ordinary one: the two drift, somebody
 * downloads the PDF of an invoice they just previewed, and the two disagree
 * about what was on it. That is not a cosmetic bug on a document a customer is
 * asked to pay.
 *
 * So neither renderer decides anything. This module turns a body plus its
 * bound extras into a flat list of BLOCKS — a heading, a party, a table of
 * lines, a totals ladder, a paragraph — and `html.ts` and `pdf.ts` each know
 * only how to draw those. A block that one of them cannot draw is a block
 * neither of them draws, because it would have to be added here first.
 *
 * ── WHY THE MONEY IS FORMATTED HERE AND NOT IN EITHER RENDERER ─────────────
 *
 * `formatMoney` is in the shared law (`money.ts`), and the formatted STRING is
 * put into the block. Two renderers each calling the formatter is two chances
 * to call it with a different `cents` flag; one caller is none. The same goes
 * for the totals ladder: it is computed once, here, from `totalsOf`.
 *
 * ── WHAT IS DELIBERATELY NOT MODELLED ──────────────────────────────────────
 *
 * Images. The comp's five image slots are `data:` URIs and an HTML page can
 * carry one directly, while a PDF would need an XObject, a decoder for
 * whatever the URI holds, and a licence position on the formats. The PDF draws
 * the letterhead as TEXT and says nothing about the missing mark rather than
 * leaving a grey box where a logo should be. Recorded as a departure rather
 * than left for somebody to discover.
 */

import type { InvoiceBody, LineItem } from '../document.ts';
import { formatMoney, formatPercent, lineMinor, taxBreakdown, totalsOf } from '../money.ts';
import type { BoundExtras } from '../subject.ts';

export interface HeadingBlock {
  readonly kind: 'heading';
  readonly title: string;
  readonly number: string;
  readonly accent: string;
}

export interface PartiesBlock {
  readonly kind: 'parties';
  readonly fromLabel: string;
  readonly from: readonly string[];
  readonly toLabel: string;
  readonly toName: string;
  readonly to: readonly string[];
}

export interface FactsBlock {
  readonly kind: 'facts';
  readonly rows: readonly { readonly label: string; readonly value: string }[];
}

export interface ItemsBlock {
  readonly kind: 'items';
  readonly columns: readonly { readonly label: string; readonly align: 'left' | 'right' }[];
  readonly rows: readonly (readonly string[])[];
}

export interface LadderBlock {
  readonly kind: 'ladder';
  readonly rows: readonly {
    readonly label: string;
    readonly value: string;
    readonly emphasis: boolean;
  }[];
}

export interface PassageBlock {
  readonly kind: 'passage';
  readonly heading: string;
  readonly lines: readonly string[];
}

export type Block = HeadingBlock | PartiesBlock | FactsBlock | ItemsBlock | LadderBlock | PassageBlock;

export interface Document {
  readonly locale: string;
  /** Right-to-left is a property of the DOCUMENT's language, not the viewer's. */
  readonly rtl: boolean;
  readonly accent: string;
  readonly blocks: readonly Block[];
}

/** The words a rendered document needs, supplied by the caller per locale. */
export interface LayoutWords {
  readonly from: string;
  readonly to: string;
  readonly issued: string;
  readonly due: string;
  readonly reference: string;
  readonly corrects: string;
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  readonly amount: string;
  readonly subtotal: string;
  readonly reduction: string;
  readonly tax: string;
  readonly gratuity: string;
  readonly total: string;
  readonly settledWith: string;
  readonly terms: string;
  readonly notes: string;
  readonly payment: string;
}

function factRow(label: string, value: string): { label: string; value: string } | null {
  return value === '' ? null : { label, value };
}

function notEmpty<T>(value: T | null): value is T {
  return value !== null;
}

export interface LayoutInput {
  readonly body: InvoiceBody;
  readonly extras: BoundExtras;
  readonly words: LayoutWords;
  readonly locale: string;
  readonly rtl: boolean;
}

export function layout(input: LayoutInput): Document {
  const { body, extras, words } = input;
  const money = (minor: number): string => formatMoney(minor, body.currency, body.cents);
  const totals = totalsOf(body);

  const blocks: Block[] = [
    {
      kind: 'heading',
      title: body.title,
      number: body.number,
      accent: body.accent,
    },
    {
      kind: 'parties',
      fromLabel: words.from,
      // `logoText` is the letterhead's name where there is no drawn mark, and
      // it is the first `from` line when the body has none — otherwise a
      // document authored with only a logo would print no seller at all.
      from: body.from.length > 0 ? body.from : [body.logoText].filter((line) => line !== ''),
      toLabel: words.to,
      toName: body.customerName,
      to: body.customer,
    },
  ];

  const facts = [
    factRow(words.issued, body.issued),
    factRow(words.due, body.due),
    factRow(words.reference, body.poNumber),
    factRow(words.corrects, extras.references),
  ].filter(notEmpty);
  if (facts.length > 0) blocks.push({ kind: 'facts', rows: facts });

  blocks.push(itemsBlock(body, words, money));
  blocks.push(ladderBlock(body, extras, totals, words, money));

  for (const [heading, lines] of [
    [words.terms, body.terms === '' ? [] : [body.terms]],
    [words.payment, body.payment],
    [words.notes, body.notes === '' ? [] : [body.notes]],
    [words.settledWith, extras.paidWith === '' ? [] : [extras.paidWith]],
  ] as const) {
    if (lines.length === 0) continue;
    blocks.push({ kind: 'passage', heading, lines });
  }

  return { locale: input.locale, rtl: input.rtl, accent: body.accent, blocks };
}

function itemsBlock(
  body: InvoiceBody,
  words: LayoutWords,
  money: (minor: number) => string,
): ItemsBlock {
  return {
    kind: 'items',
    columns: [
      { label: words.description, align: 'left' },
      { label: words.quantity, align: 'right' },
      { label: words.unit, align: 'right' },
      { label: words.amount, align: 'right' },
    ],
    rows: body.items.map((item: LineItem) => [
      item.desc,
      item.qty,
      money(unitMinor(item)),
      money(lineMinor(item)),
    ]),
  };
}

/**
 * One line's UNIT amount in minor units.
 *
 * Through `lineMinor` with a quantity of one rather than through `parseMinor`
 * directly, so the printed unit amount and the printed line amount come out of
 * the same function. Two different parses of the same typed text is how a
 * document ends up showing `$0.33 × 3 = $1.00`.
 */
function unitMinor(item: LineItem): number {
  return lineMinor({ qty: '1', rate: item.rate });
}

function ladderBlock(
  body: InvoiceBody,
  extras: BoundExtras,
  totals: ReturnType<typeof totalsOf>,
  words: LayoutWords,
  money: (minor: number) => string,
): LadderBlock {
  const rows: { label: string; value: string; emphasis: boolean }[] = [
    { label: words.subtotal, value: money(totals.subtotal), emphasis: false },
  ];

  if (totals.discount !== 0) {
    rows.push({
      label: `${words.reduction} ${formatPercent(body.discountRate)}`,
      value: money(-totals.discount),
      emphasis: false,
    });
  }

  /*
   * The breakdown when the document has one, the single line when it does not
   * — and never both. `taxBreakdown` puts every component on the ladder's own
   * base (O25), which is the correction the comp needed: it computed them on
   * the UNDISCOUNTED subtotal, so a discounted document's components added up
   * to more tax than the ladder charged.
   */
  if (body.taxLines.length > 0) {
    for (const line of taxBreakdown(totals.taxBase, body.taxLines)) {
      rows.push({
        label: `${line.label} ${formatPercent(line.rate)}`,
        value: money(line.amount),
        emphasis: false,
      });
    }
  } else if (totals.tax !== 0) {
    rows.push({
      label: `${words.tax} ${formatPercent(body.taxRate)}`,
      value: money(totals.tax),
      emphasis: false,
    });
  }

  const tip = extras.tip ?? 0;
  if (tip !== 0) rows.push({ label: words.gratuity, value: money(tip), emphasis: false });

  // "Total", not "Total due": recorded payments never reduce it, so "due"
  // would be a claim this document cannot support (O25).
  rows.push({ label: words.total, value: money(totals.total + tip), emphasis: true });
  return { kind: 'ladder', rows };
}
