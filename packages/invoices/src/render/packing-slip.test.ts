/**
 * A packing slip: what goes in a parcel, printed for whoever packs it.
 *
 * Northline's order NL-1066 — a field tee in Ember, size M, two of them, and a
 * canvas tote with no variant — going to Lena Park by UPS Ground. The claims
 * under test are the three that make it a packing slip rather than an invoice
 * with its figures hidden:
 *
 *   · NO MONEY. Its outline has no slot a price, a total or a currency could
 *     be mapped to, and every subject below is handed prices ANYWAY — a
 *     caller that sends the whole order row is the case worth drawing — so
 *     none may reach the blocks, the page or the PDF.
 *   · NO NUMBER OF ITS OWN. The number printed is the order's, exactly as
 *     mapped: never the register's `subject.number`, never in the receipt
 *     series, never with a prefix — even when it is digits alone.
 *   · THE SAME REFUSALS. A name the PDF's fonts cannot draw is refused as it
 *     is on every kind here, and the page still renders in HTML.
 */

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import { strings } from '../i18n/strings.ts';
import { kinds, describe as outlineOf, PACKING_SLIP } from '../kinds.ts';
import provider from '../server.ts';
import { documentFrom } from '../subject.ts';
import { formatsFor } from './format.ts';
import { layout, type Block, type Document } from './layout.ts';
import { isRtl, wordsFor, type LayoutWords } from './words.ts';

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

const NOW = { iso: '2026-11-20T09:15:00.000Z', timezone: 'America/New_York' };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;

/** The words only a packing slip prints. */
const SLIP_WORDS = ['kindPackingSlip', 'shipTo', 'orderNumber', 'deliveryService', 'item', 'variant', 'sku'] as const satisfies readonly (keyof LayoutWords)[];

type Fields = Record<string, unknown>;

/**
 * NL-1066 as Adminium hands it over. The register's own number (`7`), the
 * order's prices, its total and its currency are all in it: none is the
 * packing slip's to print.
 */
function slipSubject(fields: Fields = {}, items?: Fields[], locale = 'en-US', number: string | null = '7'): DocumentSubject {
  return {
    now: NOW,
    locale,
    currency: 'USD',
    business: {
      name: 'Northline',
      lines: ['220 Canal Street', 'Portland, ME 04101'],
      paymentInstructions: 'Pay by card at northline.test',
      footer: 'Thank you for your order.',
    } as DocumentSubject['business'],
    entity: null,
    number,
    fields: {
      orderNumber: 'NL-1066',
      issuedAt: '2026-11-20',
      shipToName: 'Lena Park',
      shipToLines: ['41 Elm Row', 'Burlington, VT 05401'],
      deliveryService: 'UPS Ground',
      notes: 'A gift: please leave out anything with a figure on it.',
      // Handed over anyway; the outline lists none of them.
      currency: 'USD',
      subtotal: 21_000,
      delivery: 700,
      total: 21_700,
      ...fields,
    },
    collections: {
      items: items ?? [
        { desc: 'Field tee', variant: 'Ember, M', sku: 'NL-TEE-EMB-M', qty: 2, rate: 7_000, amount: 14_000 },
        { desc: 'Canvas tote', variant: '', sku: 'NL-TOTE', qty: 1, rate: 7_000, amount: 7_000 },
      ],
      payments: [{ number: 'P-1', paidOn: '2026-11-19', method: 'card', amount: 21_700, voided: false }],
    },
  };
}

async function draw(
  subject: DocumentSubject,
  formats: readonly ('html' | 'pdf')[] = ['html', 'pdf'],
  paper: 'a4' | 'letter' = 'letter',
  settings: Fields = {},
): Promise<readonly RenderedDocument[]> {
  const outcome = await provider.render({ kind: PACKING_SLIP, subject, formats, paper, settings });
  if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
  return outcome;
}

const page = (documents: readonly RenderedDocument[]) => UTF8.decode(documents.find((d) => d.format === 'html')!.bytes);
const pdf = (documents: readonly RenderedDocument[]) => LATIN1.decode(documents.find((d) => d.format === 'pdf')!.bytes);

/** What a reader sees of the page: the sheet without its stylesheet, whose class names are not words on it. */
const seen = (html: string) => html.replace(/<style>[\s\S]*?<\/style>/g, '').replace(/ class="[^"]*"/g, '');

/** The facts beside the addressee, label and value, in the order they are drawn. */
function facts(html: string): [string, string][] {
  const meta = /<div class="meta">(.*?)<\/div>/s.exec(html)?.[1] ?? '';
  return [...meta.matchAll(/<span class="k">(.*?)<\/span><span class="v">(?:<span class="fig">|<bdi>)(.*?)(?:<\/span>|<\/bdi>)<\/span><\/span>/g)].map(
    (match) => [match[1]!, match[2]!],
  );
}

/** The blocks the two renderers are handed, straight from the layout. */
function laidOut(subject: DocumentSubject, settings: Fields = {}): Document {
  const { body, extras, facts } = documentFrom(PACKING_SLIP, subject, undefined, settings);
  return layout({
    kind: PACKING_SLIP,
    body,
    extras,
    facts,
    words: wordsFor(subject.locale),
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

describe('the packing slip kind and what it can be mapped to', () => {
  const outline = outlineOf(PACKING_SLIP);

  it('is listed, on a sheet, in both formats, in the fonts every kind here uses', () => {
    const kind = kinds().find((entry) => entry.id === PACKING_SLIP)!;
    expect(kind.formats).toEqual(['html', 'pdf']);
    expect(kind.paper).toEqual(['a4', 'letter']);
    expect(kind.coverage).toBe('winansi');
    for (const locale of LOCALES) expect(kind.label[locale], locale).toMatch(/\S/);
    expect(kind.label['en-US']).toBe('Packing slip');
  });

  it('maps the order’s number, the day, whom it goes to and how, its lines and a note', () => {
    expect(outline.slots.map((slot) => slot.id)).toEqual(['orderNumber', 'issuedAt', 'shipToName', 'shipToLines', 'deliveryService', 'items', 'notes']);
    expect(outline.slots.find((slot) => slot.id === 'items')!.columns!.map((column) => column.id)).toEqual(['desc', 'variant', 'sku', 'qty']);
  });

  it('has no slot and no column a price, a total or a currency could be mapped to', () => {
    const types = outline.slots.flatMap((slot) => [slot.type, ...(slot.columns ?? []).map((column) => column.type)]);
    for (const money of ['money', 'percent', 'currency'] as const) expect(types, money).not.toContain(money);
    for (const id of ['total', 'subtotal', 'tax', 'currency', 'delivery', 'payments', 'amount']) {
      expect(outline.slots.map((slot) => slot.id), id).not.toContain(id);
    }
  });

  it('takes no number of its own: no `number` slot, nothing the engine counts in a series', () => {
    expect(outline.slots.map((slot) => slot.id)).not.toContain('number');
    expect(outline.slots.filter((slot) => slot.default === 'sequence')).toEqual([]);
    // The order's number is the one value it cannot do without.
    expect(outline.slots.filter((slot) => slot.required && slot.default === undefined).map((slot) => slot.id)).toEqual(['orderNumber']);
  });

  it('labels every slot and column in all eight languages, and explains each it explains in all eight', () => {
    for (const slot of outline.slots.flatMap((entry) => [entry, ...(entry.columns ?? [])])) {
      for (const locale of LOCALES) {
        expect(slot.label[locale], `${slot.id} ${locale}`).toMatch(/\S/);
        if (slot.help !== undefined) expect(slot.help[locale], `${slot.id} help ${locale}`).toMatch(/\S/);
      }
    }
  });
});

describe('the sheet of a packing slip', () => {
  it('lays out the letterhead, whom it is for beside the order, the title, the lines and the note — and nothing else', () => {
    const document = laidOut(slipSubject());
    expect(document.blocks.map((entry) => entry.kind)).toEqual(['letterhead', 'parties', 'title', 'items', 'passage']);
    expect(document.name).toBe('Packing slip NL-1066');
    expect(document.voidMark).toBeNull();
    expect(block(document, 'title').text).toBe('Packing slip');
    expect(block(document, 'parties')).toEqual({
      kind: 'parties',
      toLabel: 'Ship to',
      toName: 'Lena Park',
      toLines: ['41 Elm Row', 'Burlington, VT 05401'],
      meta: [
        { label: 'Order', value: 'NL-1066' },
        { label: 'Date', value: 'Nov 20, 2026' },
        { label: 'Delivery service', value: 'UPS Ground', words: true },
      ],
    });
    expect(block(document, 'items')).toEqual({
      kind: 'items',
      columns: [
        { label: 'Item', align: 'left' },
        { label: 'Variant', align: 'left' },
        { label: 'SKU', align: 'left' },
        { label: 'Qty', align: 'right' },
      ],
      rows: [
        { cells: ['Field tee', 'Ember, M', 'NL-TEE-EMB-M', '2'], note: '' },
        { cells: ['Canvas tote', '', 'NL-TOTE', '1'], note: '' },
      ],
    });
    expect(block(document, 'passage')).toEqual({ kind: 'passage', heading: 'Note', lines: ['A gift: please leave out anything with a figure on it.'] });
  });

  it('renders HTML and PDF, named by the order', async () => {
    const documents = await draw(slipSubject());
    expect(documents.map((d) => [d.format, d.mediaType, d.filename])).toEqual([
      ['html', 'text/html; charset=utf-8', 'packing-slip-NL-1066.html'],
      ['pdf', 'application/pdf', 'packing-slip-NL-1066.pdf'],
    ]);
    for (const drawn of documents) expect(drawn.warnings, drawn.format).toEqual([]);

    const html = page(documents);
    expect(facts(html)).toEqual([
      ['Order', 'NL-1066'],
      ['Date', 'Nov 20, 2026'],
      ['Delivery service', 'UPS Ground'],
    ]);
    expect(html).toContain('<thead><tr><th>Item</th><th>Variant</th><th>SKU</th><th class="right">Qty</th></tr></thead>');
    expect(html).toContain('<td><bdi>Field tee</bdi></td><td><bdi>Ember, M</bdi></td><td><bdi>NL-TEE-EMB-M</bdi></td><td class="right"><span class="fig">2</span></td>');

    const file = pdf(documents);
    expect(file.startsWith('%PDF-')).toBe(true);
    for (const shown of ['(NL-1066)', '(Lena Park)', '(UPS Ground)', '(Field tee)', '(Ember, M)', '(NL-TEE-EMB-M)', '(Canvas tote)', '(NL-TOTE)', '(SKU)', '(VARIANT)']) {
      expect(file, shown).toContain(shown);
    }
  });

  it('draws on A4 as well as letter, to the same bytes twice', async () => {
    const first = await draw(slipSubject(), ['html', 'pdf'], 'a4');
    const second = await draw(slipSubject(), ['html', 'pdf'], 'a4');
    expect(second.map((d) => Array.from(d.bytes))).toEqual(first.map((d) => Array.from(d.bytes)));
    expect(pdf(first)).toContain('(Field tee)');
  });

  it('prints an empty variant as an empty cell, with the columns still in step', async () => {
    const lines = [
      { desc: 'Canvas tote', variant: '', sku: 'NL-TOTE', qty: 1 },
      { desc: 'Gift card', sku: 'NL-GIFT', qty: 1 },
      { desc: 'Sticker', variant: '   ', qty: 3 },
    ];
    const document = laidOut(slipSubject({}, lines));
    expect(block(document, 'items').rows.map((row) => row.cells)).toEqual([
      ['Canvas tote', '', 'NL-TOTE', '1'],
      ['Gift card', '', 'NL-GIFT', '1'],
      ['Sticker', '', '', '3'],
    ]);
    const documents = await draw(slipSubject({}, lines));
    expect(page(documents)).toContain('<td><bdi>Canvas tote</bdi></td><td><bdi></bdi></td><td><bdi>NL-TOTE</bdi></td>');
    expect(pdf(documents)).toContain('(Sticker)');
  });

  it('says nothing about whom it is for when the order names nobody, and nothing about a service it does not map', () => {
    const document = laidOut(slipSubject({ shipToName: '', shipToLines: [], deliveryService: '', notes: '' }));
    expect(block(document, 'parties').toLabel).toBe('');
    expect(block(document, 'parties').meta.map((row) => row.label)).toEqual(['Order', 'Date']);
    expect(document.blocks.map((entry) => entry.kind)).toEqual(['letterhead', 'parties', 'title', 'items']);
  });

  it('reads the address from text with one line a line, as well as from a list', () => {
    const document = laidOut(slipSubject({ shipToLines: '41 Elm Row\nBurlington, VT 05401' }));
    expect(block(document, 'parties').toLines).toEqual(['41 Elm Row', 'Burlington, VT 05401']);
  });
});

describe('a packing slip holds no money', () => {
  /** Every figure the subject carries, as the languages write it, and the signs. */
  const FIGURES = ['70.00', '140.00', '210.00', '217.00', '7.00', '70,00', '210,00', '217,00', '$', 'USD'];

  it('hands the renderers no price, total, currency or payment, in any of the eight languages', () => {
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      const handed = everyString(laidOut(slipSubject({}, undefined, locale)).blocks);
      // A heading word is looked for whole — the slip's own "Delivery service" holds the receipt's "Delivery" — and a figure anywhere.
      for (const word of [words.amount, words.total, words.subtotal, words.delivery, words.unit, words.howToPay]) {
        expect(handed.filter((text) => text === word), `${locale} ${word}`).toEqual([]);
      }
      for (const figure of FIGURES) expect(handed.filter((text) => text.includes(figure)), `${locale} ${figure}`).toEqual([]);
    }
  });

  it('draws none of them on the page or in the PDF', async () => {
    const documents = await draw(slipSubject());
    const html = seen(page(documents));
    for (const word of ['Amount', 'Total', 'Subtotal', 'Rate', 'How to pay', 'Pay by card', 'Thank you for your order', ...FIGURES]) {
      expect(html.includes(word), word).toBe(false);
    }
    const file = pdf(documents);
    for (const word of ['(Total)', '(TOTAL)', '(AMOUNT)', '(RATE)', '(How to pay)', '(HOW TO PAY)', ...FIGURES.map((figure) => `${figure})`)]) {
      expect(file.includes(word), word).toBe(false);
    }
  });
});

describe('the number on a packing slip is the order’s own', () => {
  it('prints the order’s number as mapped, never the register’s', async () => {
    const documents = await draw(slipSubject({}, undefined, 'en-US', '7'));
    expect(facts(page(documents))[0]).toEqual(['Order', 'NL-1066']);
    expect(page(documents)).not.toMatch(/>7</);
  });

  it('adds no series prefix, even to a number of digits alone', async () => {
    for (const settings of [{}, { prefix_receipt: 'REC-' }, { prefix_receipt: 'R/' }]) {
      const documents = await draw(slipSubject({ orderNumber: '1066' }), ['html', 'pdf'], 'letter', settings);
      expect(facts(page(documents))[0], JSON.stringify(settings)).toEqual(['Order', '1066']);
      expect(documents.map((d) => d.filename)).toEqual(['packing-slip-1066.html', 'packing-slip-1066.pdf']);
      expect(page(documents)).not.toContain('REC-');
      expect(page(documents)).not.toContain('R/1066');
    }
  });

  it('prints a number with leading zeros and spaces exactly as stored', () => {
    expect(block(laidOut(slipSubject({ orderNumber: '00042' })), 'parties').meta[0]).toEqual({ label: 'Order', value: '00042' });
    expect(laidOut(slipSubject({ orderNumber: '#2109 B' })).name).toBe('Packing slip #2109 B');
  });

  it('refuses an order with no number, naming the slot, rather than borrowing the register’s', async () => {
    const outcome = await provider.render({ kind: PACKING_SLIP, subject: slipSubject({ orderNumber: '' }), formats: ['html'], paper: 'letter', settings: {} });
    expect(isDocumentError(outcome)).toBe(true);
    if (!isDocumentError(outcome)) return;
    expect(outcome.code).toBe('MISSING_SLOT');
    expect(outcome.detail).toContain('orderNumber');
  });
});

describe('a name the PDF cannot draw', () => {
  it('is refused as every kind refuses it, and the page still renders in HTML', async () => {
    const subject = slipSubject({ shipToName: '李娜' });
    const alone = await provider.render({ kind: PACKING_SLIP, subject, formats: ['pdf'], paper: 'letter', settings: {} });
    expect(isDocumentError(alone)).toBe(true);
    if (!isDocumentError(alone)) return;
    expect(alone.code).toBe('LATIN_ONLY');
    expect(alone.dropped).toEqual(expect.arrayContaining(['李', '娜']));

    // The same refusal an invoice gives the same name.
    const invoice = await provider.render({
      kind: 'invoice',
      subject: { ...subject, fields: { customerName: '李娜', issuedAt: '2026-11-20' }, collections: {} },
      formats: ['pdf'],
      paper: 'letter',
      settings: {},
    });
    expect(isDocumentError(invoice) ? invoice.code : 'drawn').toBe('LATIN_ONLY');

    // Asked for both, the print copy comes back and the warning says why there is no PDF.
    const both = await draw(subject);
    expect(both.map((d) => d.format)).toEqual(['html']);
    expect(both[0]!.warnings).toEqual([wordsFor('en-US').noPdf]);
    expect(page(both)).toContain('<bdi>李娜</bdi>');
  });

  it('draws an accented Latin name in the PDF', async () => {
    expect(pdf(await draw(slipSubject({ shipToName: 'Zoë Brontë-Ångström' })))).toContain('(Zo');
  });
});

describe('a packing slip in the document’s own language', () => {
  it('has every word a packing slip prints in all eight languages', () => {
    const english = wordsFor('en-US');
    expect(SLIP_WORDS.map((key) => english[key])).toEqual(['Packing slip', 'Ship to', 'Order', 'Delivery service', 'Item', 'Variant', 'SKU']);
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      for (const key of SLIP_WORDS) expect(words[key], `${locale} ${key}`).toMatch(/\S/);
      // The sheet's name is the kind's own label, in every language.
      expect(words.kindPackingSlip, locale).toBe(kinds().find((kind) => kind.id === PACKING_SLIP)!.label[locale]);
    }
  });

  it('prints a German slip under German words', async () => {
    const html = page(await draw(slipSubject({}, undefined, 'de-DE')));
    for (const text of ['Lieferschein', 'Lieferung an', 'Bestellung', 'Versandart', 'Artikel', 'Variante', 'Art.-Nr.']) expect(html, text).toContain(text);
  });

  it('draws an Arabic slip right to left on the page, and says to print it as a PDF', async () => {
    const drawn = await draw(slipSubject({}, undefined, 'ar-EG'));
    expect(drawn.map((d) => d.format)).toEqual(['html']);
    const html = page(drawn);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('قائمة التعبئة');
  });

  it('names the kind on the record button in all eight languages', () => {
    for (const locale of LOCALES) {
      expect(strings[locale]['addon.invoices.record.kind.packingSlip'], locale).toBe(kinds().find((kind) => kind.id === PACKING_SLIP)!.label[locale]);
    }
  });
});
