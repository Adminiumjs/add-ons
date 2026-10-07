/**
 * An order to a supplier, drawn from an app's own rows: the same order with
 * its prices, and without them for a supplier who is not to see them.
 *
 * The two are separate kinds, and the claim under test is the strong one: the
 * order sent without prices is not the other with figures blanked out. Its
 * outline has no slot a price could be mapped to, the subject reader takes no
 * price off a row for it, and the layout builds three columns and no total —
 * so every subject for it below is handed prices ANYWAY, and none may reach
 * the page, the PDF or the facts in between.
 */

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import { strings } from '../i18n/strings.ts';
import { isPurchaseOrder, kinds, describe as outlineOf } from '../kinds.ts';
import provider from '../server.ts';
import { documentFrom } from '../subject.ts';
import { formatsFor } from './format.ts';
import { layout, type Block, type Document } from './layout.ts';
import { isRtl, wordsFor, type LayoutWords } from './words.ts';

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

const NOW = { iso: '2026-09-03T09:15:00.000Z', timezone: 'Europe/London' };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;
const BOTH = ['purchase-order', 'purchase-order-unpriced'] as const;

/** The words only an order prints. */
const ORDER_WORDS = ['kindPurchaseOrder', 'supplier', 'deliverTo', 'expectedBy', 'packs', 'units', 'pricePerPack'] as const satisfies readonly (keyof LayoutWords)[];

type Fields = Record<string, unknown>;

/**
 * A kitchen's order as Adminium hands it over: money in minor units, the
 * quantity twice. The prices, the total and the currency are in it whatever
 * the kind — a caller that sends the whole row is the case worth drawing.
 */
function orderSubject(fields: Fields = {}, items?: Fields[], locale = 'en-US'): DocumentSubject {
  return {
    now: NOW,
    locale,
    currency: 'EUR',
    business: {
      name: 'Harbour Kitchen',
      lines: ['4 Quay Street', 'Cork T12 X70A'],
      paymentInstructions: 'Bank transfer to Harbour Kitchen',
      footer: 'Goods are checked on arrival.',
    } as DocumentSubject['business'],
    entity: null,
    number: 'PO-0007',
    fields: {
      issuedAt: '2026-09-01',
      expectedBy: '2026-09-15',
      supplierName: 'Northmill Supply',
      supplierEmail: 'orders@northmill.test',
      deliverTo: 'Harbour kitchen',
      deliverLines: 'Back door, 4 Quay Street\nCork T12 X70A',
      notes: 'Deliver before ten, please.',
      currency: 'EUR',
      total: 39_600,
      ...fields,
    },
    collections: {
      items: items ?? [
        { desc: 'Bread flour', code: 'NM-2210', packs: 4, pack: 'Sack 25 kg', units: 100, unit: 'kg', rate: 4_200, amount: 16_800 },
        { desc: 'Olive oil', code: 'NM-0417', packs: 6, pack: 'Case of 12', units: 72, unit: 'bottle', rate: 3_800, amount: 22_800 },
      ],
    },
  };
}

async function draw(
  kind: string,
  subject: DocumentSubject,
  formats: readonly ('html' | 'pdf')[] = ['html', 'pdf'],
  paper: 'a4' | 'letter' = 'a4',
): Promise<readonly RenderedDocument[]> {
  const outcome = await provider.render({ kind, subject, formats, paper, settings: {} });
  if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
  return outcome;
}

const page = (documents: readonly RenderedDocument[]) => UTF8.decode(documents.find((d) => d.format === 'html')!.bytes);
const pdf = (documents: readonly RenderedDocument[]) => LATIN1.decode(documents.find((d) => d.format === 'pdf')!.bytes);

/**
 * What a reader sees of the page: the sheet without its stylesheet, whose
 * class names (`total`, for one) are not words on the document.
 */
const seen = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/ class="[^"]*"/g, '');

/** The blocks the two renderers are handed, straight from the layout. */
function laidOut(kind: string, subject: DocumentSubject): Document {
  const { body, extras, facts } = documentFrom(kind, subject, undefined, {});
  const words = wordsFor(subject.locale);
  return layout({
    kind,
    body,
    extras,
    facts,
    words,
    formats: formatsFor(subject.locale, facts.currency, { latin: true, cents: body.cents }),
    locale: subject.locale,
    rtl: isRtl(subject.locale),
    authored: false,
  });
}

function block<K extends Block['kind']>(document: Document, kind: K): Extract<Block, { kind: K }> {
  const found = document.blocks.find((entry) => entry.kind === kind);
  if (found === undefined) throw new Error(`no ${kind} block`);
  return found as Extract<Block, { kind: K }>;
}

/** Every string the layout hands the renderers, whatever block it sits in. */
function everyString(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(everyString);
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(everyString);
  return [];
}

describe('the two kinds of order and what each can be mapped to', () => {
  it('lists both, on a sheet, in both formats', () => {
    for (const id of BOTH) {
      const kind = kinds().find((entry) => entry.id === id)!;
      expect(kind.formats, id).toEqual(['html', 'pdf']);
      expect(kind.paper, id).toEqual(['a4', 'letter']);
      expect(kind.coverage, id).toBe('winansi');
      expect(isPurchaseOrder(id), id).toBe(true);
    }
    expect(isPurchaseOrder('invoice')).toBe(false);
    expect(kinds().find((entry) => entry.id === 'purchase-order')!.label['en-US']).toBe('Purchase order');
    expect(kinds().find((entry) => entry.id === 'purchase-order-unpriced')!.label['en-US']).toBe('Purchase order, no prices');
  });

  it('gives the order with prices the slots a mapping names, and no customer', () => {
    const outline = outlineOf('purchase-order');
    expect(outline.slots.map((slot) => slot.id)).toEqual([
      'number',
      'issuedAt',
      'expectedBy',
      'supplierName',
      'supplierEmail',
      'deliverTo',
      'deliverLines',
      'notes',
      'currency',
      'items',
      'total',
    ]);
    const items = outline.slots.find((slot) => slot.id === 'items')!;
    expect(items.type).toBe('collection');
    expect(items.columns!.map((column) => column.id)).toEqual(['desc', 'code', 'packs', 'pack', 'units', 'unit', 'rate', 'amount']);
    expect(items.columns!.filter((column) => column.type === 'money').map((column) => column.id)).toEqual(['rate', 'amount']);
  });

  it('gives the order without prices no slot and no column a price could arrive through', () => {
    const outline = outlineOf('purchase-order-unpriced');
    expect(outline.slots.map((slot) => slot.id)).toEqual([
      'number',
      'issuedAt',
      'expectedBy',
      'supplierName',
      'supplierEmail',
      'deliverTo',
      'deliverLines',
      'notes',
      'items',
    ]);
    const items = outline.slots.find((slot) => slot.id === 'items')!;
    expect(items.columns!.map((column) => column.id)).toEqual(['desc', 'code', 'packs', 'pack', 'units', 'unit']);
    // Not one slot or column of a type that holds money, by whatever name.
    const types = [...outline.slots.map((slot) => slot.type), ...items.columns!.map((column) => column.type)];
    expect(types).not.toContain('money');
    expect(types).not.toContain('currency');
    expect(types).not.toContain('percent');
  });

  it('types each slot as a mapping fills it, and requires only the supplier’s name', () => {
    for (const id of BOTH) {
      const slots = Object.fromEntries(outlineOf(id).slots.map((slot) => [slot.id, slot]));
      expect(slots.expectedBy!.type, id).toBe('date');
      expect(slots.supplierName!.type, id).toBe('text');
      expect(slots.supplierEmail!.type, id).toBe('email');
      expect(slots.deliverTo!.type, id).toBe('text');
      expect(slots.deliverLines!.type, id).toBe('text');
      expect(slots.notes!.type, id).toBe('text');
      // The number and the day are the engine's to fill; the supplier is the operator's.
      expect(outlineOf(id).slots.filter((slot) => slot.required && slot.default === undefined).map((slot) => slot.id), id).toEqual(['supplierName']);
    }
  });

  it('keeps an order’s lines apart from an invoice’s, which require a quantity an order line has none of', () => {
    const invoiceLines = outlineOf('invoice').slots.find((slot) => slot.id === 'items')!;
    expect(invoiceLines.columns!.filter((column) => column.required).map((column) => column.id)).toContain('qty');
    for (const id of BOTH) {
      const columns = outlineOf(id).slots.find((slot) => slot.id === 'items')!.columns!;
      expect(columns.map((column) => column.id), id).not.toContain('qty');
      expect(columns.filter((column) => column.required).map((column) => column.id), id).toEqual(['desc']);
    }
    // And the invoice's own lines are as they were.
    expect(invoiceLines.columns!.map((column) => column.id)).not.toContain('packs');
  });

  it('labels and explains every slot and column in all eight languages', () => {
    for (const id of BOTH) {
      const kind = kinds().find((entry) => entry.id === id)!;
      const outline = outlineOf(id);
      const texts = [
        kind.label,
        ...outline.slots.flatMap((slot) => [slot.label, slot.help, ...(slot.columns ?? []).flatMap((column) => [column.label, column.help])]),
      ].filter((text) => text !== undefined);
      for (const text of texts) {
        expect(Object.keys(text).sort(), id).toEqual([...LOCALES].sort());
        for (const locale of LOCALES) expect(text[locale], `${id} ${locale}`).toMatch(/\S/);
      }
    }
  });
});

describe('what the subject of an order becomes', () => {
  it('reads the supplier, the place, the day and the lines, each quantity twice', () => {
    const { body, facts } = documentFrom('purchase-order', orderSubject(), undefined, {});
    expect(body.number).toBe('PO-0007');
    expect(body.issued).toBe('2026-09-01');
    expect(body.notes).toBe('Deliver before ten, please.');
    expect(facts.total).toBe('396.00');
    expect(facts.purchaseOrder).toEqual({
      supplierName: 'Northmill Supply',
      supplierEmail: 'orders@northmill.test',
      deliverTo: 'Harbour kitchen',
      deliverLines: ['Back door, 4 Quay Street', 'Cork T12 X70A'],
      expectedBy: '2026-09-15',
      lines: [
        { desc: 'Bread flour', code: 'NM-2210', packs: '4', pack: 'Sack 25 kg', units: '100', unit: 'kg', rate: '42.00', amount: '168.00' },
        { desc: 'Olive oil', code: 'NM-0417', packs: '6', pack: 'Case of 12', units: '72', unit: 'bottle', rate: '38.00', amount: '228.00' },
      ],
    });
  });

  it('takes no price off a row for the order sent without them, though the row carries one', () => {
    const { facts } = documentFrom('purchase-order-unpriced', orderSubject(), undefined, {});
    expect(facts.purchaseOrder.lines.map((line) => [line.rate, line.amount])).toEqual([
      [null, null],
      [null, null],
    ]);
    // Everything that is not a price is still read.
    expect(facts.purchaseOrder.lines.map((line) => [line.desc, line.code, line.packs, line.pack, line.units, line.unit])).toEqual([
      ['Bread flour', 'NM-2210', '4', 'Sack 25 kg', '100', 'kg'],
      ['Olive oil', 'NM-0417', '6', 'Case of 12', '72', 'bottle'],
    ]);
  });

  it('never reads an order’s lines as an invoice’s — no made-up quantity, no stored lines', () => {
    for (const kind of BOTH) {
      const bound = documentFrom(kind, orderSubject(), undefined, {});
      expect(bound.facts.storedLines, kind).toBeNull();
      expect(bound.extras.lines, kind).toEqual([]);
      expect(bound.body.items.map((item) => item.desc), kind).not.toContain('Bread flour');
    }
  });

  it('leaves the order’s block empty on every other kind', () => {
    const subject: DocumentSubject = { ...orderSubject({ customerName: 'Somebody' }), collections: { items: [{ desc: 'One', qty: 1, rate: 1000 }] } };
    const { body, facts } = documentFrom('invoice', subject, undefined, {});
    expect(facts.purchaseOrder.lines).toEqual([]);
    // A note is an order's slot: an invoice maps none, so none is folded in.
    expect(body.notes).toBe('');
  });

  it('reads a quantity with a fraction, an address given as a list, and a row with almost nothing', () => {
    const subject = orderSubject({ deliverLines: ['Back door', '', 'Cork'], supplierEmail: null, expectedBy: '2026-09-15T00:00:00.000Z' }, [
      { desc: 'Butter', packs: 2.5, units: '12.5', unit: 'kg' },
      { desc: 'Salt' },
    ]);
    const { facts } = documentFrom('purchase-order', subject, undefined, {});
    expect(facts.purchaseOrder.deliverLines).toEqual(['Back door', 'Cork']);
    expect(facts.purchaseOrder.supplierEmail).toBe('');
    expect(facts.purchaseOrder.expectedBy).toBe('2026-09-15');
    expect(facts.purchaseOrder.lines).toEqual([
      { desc: 'Butter', code: '', packs: '2.5', pack: '', units: '12.5', unit: 'kg', rate: null, amount: null },
      { desc: 'Salt', code: '', packs: null, pack: '', units: null, unit: '', rate: null, amount: null },
    ]);
  });

  it('refuses an order with no supplier, naming the slot', async () => {
    for (const kind of BOTH) {
      const outcome = await provider.render({ kind, subject: orderSubject({ supplierName: '' }), formats: ['html'], paper: 'a4', settings: {} });
      if (!isDocumentError(outcome)) throw new Error('expected a refusal');
      expect(outcome.code, kind).toBe('MISSING_SLOT');
      expect(outcome.detail, kind).toBe("'supplierName' has no value");
    }
  });
});

describe('the sheet of an order sent with its prices', () => {
  it('lays the blocks out in the order a supplier reads them', () => {
    const document = laidOut('purchase-order', orderSubject());
    expect(document.blocks.map((entry) => entry.kind)).toEqual(['letterhead', 'parties', 'title', 'passage', 'items', 'ladder', 'passage', 'foot', 'signature']);
    expect(document.name).toBe('Purchase order PO-0007');
    expect(document.voidMark).toBeNull();
    expect(block(document, 'title').text).toBe('Purchase order');
  });

  it('keeps the business’s own letterhead and makes the sheet out to the supplier', () => {
    const document = laidOut('purchase-order', orderSubject());
    expect(block(document, 'letterhead')).toMatchObject({ name: 'Harbour Kitchen', lines: ['4 Quay Street', 'Cork T12 X70A'] });
    expect(block(document, 'parties')).toEqual({
      kind: 'parties',
      toLabel: 'Supplier',
      toName: 'Northmill Supply',
      toLines: ['orders@northmill.test'],
      meta: [
        { label: 'Purchase order', value: 'PO-0007' },
        { label: 'Date', value: 'Sep 1, 2026' },
        { label: 'Expected by', value: 'Sep 15, 2026' },
      ],
    });
  });

  it('says where the goods go, then counts every line in packs and in units, with five columns', () => {
    const document = laidOut('purchase-order', orderSubject());
    expect(document.blocks.filter((entry) => entry.kind === 'passage')[0]).toEqual({
      kind: 'passage',
      heading: 'Deliver to',
      lines: ['Harbour kitchen', 'Back door, 4 Quay Street', 'Cork T12 X70A'],
    });
    expect(block(document, 'items')).toEqual({
      kind: 'items',
      columns: [
        { label: 'Description', align: 'left' },
        { label: 'Packs', align: 'right' },
        { label: 'Units', align: 'right' },
        { label: 'Price per pack', align: 'right' },
        { label: 'Amount', align: 'right' },
      ],
      rows: [
        { cells: ['Bread flour', '4 × Sack 25 kg', '100 kg', '€42.00', '€168.00'], note: 'NM-2210' },
        { cells: ['Olive oil', '6 × Case of 12', '72 bottle', '€38.00', '€228.00'], note: 'NM-0417' },
      ],
    });
  });

  it('prints one total, the stored one, then the note, and asks nobody to pay', () => {
    const document = laidOut('purchase-order', orderSubject());
    expect(block(document, 'ladder').rows).toEqual([{ label: 'Total', value: '€396.00', emphasis: true }]);
    expect(document.blocks.filter((entry) => entry.kind === 'passage')[1]).toEqual({ kind: 'passage', heading: 'Notes', lines: ['Deliver before ten, please.'] });
    // The business's own way to be paid is no part of an order it sends.
    expect(block(document, 'foot')).toEqual({ kind: 'foot', payLabel: '', payLines: [], footLabel: 'Terms', footText: 'Goods are checked on arrival.' });
  });

  it('adds the lines up when no total is mapped, and works a line out when its amount is not', () => {
    const subject = orderSubject({ total: null }, [
      { desc: 'Bread flour', packs: 4, pack: 'Sack 25 kg', rate: 4_200 },
      { desc: 'Olive oil', packs: 6, rate: 3_800, amount: 22_000 },
      { desc: 'Samples' },
    ]);
    const document = laidOut('purchase-order', subject);
    expect(block(document, 'items').rows).toEqual([
      // 4 × 42.00, worked out here; the second line's stored 220.00 is printed as stored.
      { cells: ['Bread flour', '4 × Sack 25 kg', '', '€42.00', '€168.00'], note: '' },
      { cells: ['Olive oil', '6', '', '€38.00', '€220.00'], note: '' },
      { cells: ['Samples', '', '', '', ''], note: '' },
    ]);
    expect(block(document, 'ladder').rows).toEqual([{ label: 'Total', value: '€388.00', emphasis: true }]);
  });

  it('leaves out what an order does not carry: the place, the note, the total', () => {
    const subject = orderSubject({ deliverTo: '', deliverLines: null, notes: undefined, total: null, expectedBy: null, supplierEmail: '' }, [{ desc: 'Samples', units: 3 }]);
    const document = laidOut('purchase-order', { ...subject, business: { name: 'Harbour Kitchen', lines: [] } });
    expect(document.blocks.map((entry) => entry.kind)).toEqual(['letterhead', 'parties', 'title', 'items', 'signature']);
    expect(block(document, 'parties').toLines).toEqual([]);
    expect(block(document, 'parties').meta.map((row) => row.label)).toEqual(['Purchase order', 'Date']);
    expect(block(document, 'items').rows).toEqual([{ cells: ['Samples', '', '3', '', ''], note: '' }]);
  });

  it('draws the same words on the page and in the PDF, on A4 and on Letter', async () => {
    for (const paper of ['a4', 'letter'] as const) {
      const drawn = await draw('purchase-order', orderSubject(), ['html', 'pdf'], paper);
      const html = page(drawn);
      for (const text of ['Supplier', 'Northmill Supply', 'orders@northmill.test', 'PO-0007', 'Sep 15, 2026', 'Deliver to', 'Harbour kitchen', 'Bread flour', 'NM-2210', '4 × Sack 25 kg', '100 kg', 'Price per pack', '€42.00', '€168.00', '€396.00', 'Deliver before ten, please.']) {
        expect(html, `${paper} ${text}`).toContain(text);
      }
      expect(html).not.toContain('How to pay');
      const file = pdf(drawn);
      for (const text of ['(SUPPLIER)', '(Northmill Supply)', '(PO-0007)', '(DELIVER TO)', '(Bread flour)', '(NM-2210)', '(4 × Sack 25 kg)', '(100 kg)', '(PRICE PER PACK)', '(AMOUNT)', '(€42.00)', '(€396.00)']) {
        // The euro and the multiplication sign are one WinAnsi byte each, and
        // the decoder above reads both back as themselves.
        expect(file, `${paper} ${text}`).toContain(text);
      }
      expect(file).not.toContain('HOW TO PAY');
    }
  });

  it('is named by its kind and number, and draws to the same bytes twice', async () => {
    const first = await draw('purchase-order', orderSubject());
    const second = await draw('purchase-order', orderSubject());
    expect(first.map((d) => d.filename)).toEqual(['purchase-order-PO-0007.html', 'purchase-order-PO-0007.pdf']);
    expect(second.map((d) => Array.from(d.bytes))).toEqual(first.map((d) => Array.from(d.bytes)));
  });
});

describe('the sheet of an order sent without prices', () => {
  /** Every figure the subject carries a price in, as any of the eight languages writes it, and the sign. */
  const FIGURES = ['42.00', '38.00', '168.00', '228.00', '396.00', '42,00', '38,00', '168,00', '228,00', '396,00', '€'];

  it('has three columns, no total, and the same sheet around them', () => {
    const document = laidOut('purchase-order-unpriced', orderSubject());
    expect(document.blocks.map((entry) => entry.kind)).toEqual(['letterhead', 'parties', 'title', 'passage', 'items', 'passage', 'foot', 'signature']);
    // One word for both kinds: the sheet says what it is, not what was left off it.
    expect(document.name).toBe('Purchase order PO-0007');
    expect(block(document, 'title').text).toBe('Purchase order');
    expect(block(document, 'parties')).toEqual(block(laidOut('purchase-order', orderSubject()), 'parties'));
    expect(block(document, 'items')).toEqual({
      kind: 'items',
      columns: [
        { label: 'Description', align: 'left' },
        { label: 'Packs', align: 'right' },
        { label: 'Units', align: 'right' },
      ],
      rows: [
        { cells: ['Bread flour', '4 × Sack 25 kg', '100 kg'], note: 'NM-2210' },
        { cells: ['Olive oil', '6 × Case of 12', '72 bottle'], note: 'NM-0417' },
      ],
    });
  });

  it('hands the renderers no price, no amount and no total, in any of the eight languages', () => {
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      const handed = everyString(laidOut('purchase-order-unpriced', orderSubject({}, undefined, locale)).blocks);
      for (const word of [words.pricePerPack, words.amount, words.total, words.subtotal, 'EUR', ...FIGURES]) {
        expect(handed.filter((text) => text.includes(word)), `${locale} ${word}`).toEqual([]);
      }
      // The same subject as the other kind is where every one of them is.
      const priced = everyString(laidOut('purchase-order', orderSubject({}, undefined, locale)).blocks);
      for (const word of [words.pricePerPack, words.amount, words.total]) expect(priced, `${locale} ${word}`).toContain(word);
    }
  });

  it('draws none of them on the page, in any of the eight languages', async () => {
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      const html = seen(page(await draw('purchase-order-unpriced', orderSubject({}, undefined, locale), ['html'])));
      for (const word of [words.pricePerPack, words.amount, words.total, words.subtotal, 'EUR', ...FIGURES]) {
        expect(html.includes(word), `${locale} ${word}`).toBe(false);
      }
      // What it does draw: whom it is for, where it goes, and how much of what.
      for (const text of [words.supplier, words.deliverTo, words.expectedBy, words.packs, words.units, 'Northmill Supply', 'Bread flour', 'NM-2210', 'Sack 25 kg']) {
        expect(html, `${locale} ${text}`).toContain(text);
      }
    }
  });

  it('draws none of them in the PDF either, in the languages its fonts cover', async () => {
    for (const locale of ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK'] as const) {
      const words = wordsFor(locale);
      const file = pdf(await draw('purchase-order-unpriced', orderSubject({}, undefined, locale)));
      // Headings are drawn in capitals, so the words are looked for in both.
      for (const word of [words.pricePerPack, words.amount, words.total].flatMap((text) => [text, text.toUpperCase()])) {
        expect(file.includes(`(${word})`), `${locale} ${word}`).toBe(false);
      }
      // Not the code: a heading in capitals may spell it (the French for a supplier does).
      for (const figure of FIGURES) expect(file.includes(figure), `${locale} ${figure}`).toBe(false);
      expect(file).toContain('(Northmill Supply)');
      expect(file).toContain('(4 × Sack 25 kg)');
    }
  });

  it('draws the order with prices to a different sheet from the same subject', async () => {
    const html = seen(page(await draw('purchase-order', orderSubject(), ['html'])));
    for (const text of ['Price per pack', 'Amount', 'Total', '€42.00', '€396.00']) expect(html).toContain(text);
  });

  it('is named by its own kind, and draws to the same bytes twice', async () => {
    const first = await draw('purchase-order-unpriced', orderSubject());
    const second = await draw('purchase-order-unpriced', orderSubject());
    expect(first.map((d) => d.filename)).toEqual(['purchase-order-unpriced-PO-0007.html', 'purchase-order-unpriced-PO-0007.pdf']);
    expect(second.map((d) => Array.from(d.bytes))).toEqual(first.map((d) => Array.from(d.bytes)));
  });
});

describe('an order in the document’s own language', () => {
  it('has every word an order prints in all eight languages, none left in English', () => {
    const english = wordsFor('en-US');
    expect(ORDER_WORDS.map((key) => english[key])).toEqual(['Purchase order', 'Supplier', 'Deliver to', 'Expected by', 'Packs', 'Units', 'Price per pack']);
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      for (const key of ORDER_WORDS) {
        expect(words[key], `${locale} ${key}`).toMatch(/\S/);
        if (locale !== 'en-US') expect(words[key], `${locale} ${key}`).not.toBe(english[key]);
      }
    }
  });

  it('prints a German order under German words, in the PDF too', async () => {
    const drawn = await draw('purchase-order', orderSubject({}, undefined, 'de-DE'));
    const html = page(drawn);
    for (const text of ['Bestellung', 'Lieferant', 'Lieferung an', 'Erwartet bis', 'Packungen', 'Einheiten', 'Preis je Packung', '42,00\u00a0€', '396,00\u00a0€']) expect(html).toContain(text);
    expect(pdf(drawn)).toContain('(PREIS JE PACKUNG)');
  });

  it('draws an Arabic order right to left on the page, and says to print it as a PDF', async () => {
    const drawn = await draw('purchase-order', orderSubject({}, undefined, 'ar-EG'));
    expect(drawn.map((d) => d.format)).toEqual(['html']);
    expect(drawn[0]!.warnings).toEqual([wordsFor('ar-EG').noPdf]);
    const html = page(drawn);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('أمر شراء');
    expect(html).toContain('المورّد');
  });

  it('names both kinds on the record button in all eight languages', () => {
    for (const locale of LOCALES) {
      const order = strings[locale]['addon.invoices.record.kind.purchaseOrder'];
      const unpriced = strings[locale]['addon.invoices.record.kind.purchaseOrderUnpriced'];
      expect(order, locale).toBe(kinds().find((kind) => kind.id === 'purchase-order')!.label[locale]);
      expect(unpriced, locale).toBe(kinds().find((kind) => kind.id === 'purchase-order-unpriced')!.label[locale]);
      expect(unpriced, locale).not.toBe(order);
    }
  });
});
