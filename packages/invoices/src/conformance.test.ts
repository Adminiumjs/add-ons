/**
 * `document-render@1` conformance for the invoices provider — the FIRST
 * implementation of the contract, and the one it was designed around.
 *
 * `barcode-labels` runs the same suite in its own package, and the pairing is
 * what 25 D4 asks for: a contract that only ever fitted the add-on it was
 * drawn for has not been shown to be a contract. The two disagree about
 * `formats`, `paper` and `coverage`, which is exactly why those three fields
 * sit on the KIND.
 */

import { isDocumentError } from '@adminium/add-on-host/contracts';
import { describeDocumentRenderer } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { emptyBody } from './document.ts';
import provider from './server.ts';

/**
 * TWO DECODERS, AND USING THE WRONG ONE IS AN EASY AFTERNOON.
 *
 * A rendered document's bytes are not one encoding. HTML is UTF-8 — its own
 * media type says so — while a PDF's content is WinAnsi, a single-byte
 * encoding where `latin1` is the exact decoder. Reading the HTML with `latin1`
 * costs nothing on ASCII and mangles everything else: U+2212, the minus sign
 * `formatMoney` writes, is three UTF-8 bytes and comes back as `â` plus two
 * more, so an assertion about `−EUR1,210.50` fails against a document that is
 * completely correct. That happened here on 2026-09-10 and the ten minutes it
 * cost are the reason this comment is longer than the two lines under it.
 */
const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

/** HTML bytes as text. Always this one for `format: 'html'`. */
const html = (bytes: Uint8Array): string => UTF8.decode(bytes);

/**
 * A pinned clock, in the subject where the contract puts it.
 *
 * The suite renders twice and requires identical bytes. With the provider
 * reading its own `Date.now()` that assertion would still pass — the two calls
 * are microseconds apart — and would fail nowhere until an invoice printed the
 * wrong day. Putting the clock in the fixture is what makes it mean what it
 * says.
 */
const NOW = { iso: '2026-09-10T09:15:00.000Z', timezone: 'Europe/Lisbon' };

const BUSINESS = { name: 'Northwind Studio', lines: ['18 Harbour Road', 'Lisbon, 1200-109', 'PT'] };

function subjectFor(kind: string) {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'EUR',
    business: BUSINESS,
    entity: {
      connectionId: 'conn_1',
      table: 'public.invoices',
      pk: { id: 4118 },
      label: 'Invoice 4118',
    },
    number: 'INV-1042',
    fields: {
      customerName: 'Acme Corporation',
      customerLines: ['400 Market Street', 'San Francisco, CA 94105', 'US'],
      customerEmail: 'accounts@example.test',
      currency: 'EUR',
      // Integer minor units and basis points — the contract's wire law, which
      // the suite asserts on this very object.
      taxRate: 2000,
      discountRate: 1000,
      issuedAt: '2026-09-01',
      ...(kind === 'invoice' ? { dueAt: '2026-10-01', poNumber: 'PO-88213' } : {}),
      ...(kind === 'receipt' ? { paidWith: 'Card ending 6411', tip: 500 } : {}),
      ...(kind === 'credit-note' ? { references: 'INV-1039' } : {}),
    },
    collections: {
      items: [
        { id: 'li-1', desc: 'Design system audit', qty: 12, rate: 18_000 },
        { id: 'li-2', desc: 'Dashboard implementation', qty: 45, rate: 16_500 },
        { id: 'li-3', desc: 'Schema migration', qty: 12, rate: 21_000 },
      ],
    },
  };
}

describeDocumentRenderer(provider, {
  settings: {},
  subject: (kind) => subjectFor(kind.id),
  /*
   * `customerName`, not the outline's first `text` slot — which is `number`,
   * and `number` is filled by the ENGINE from a sequence. Pushing `é` into it
   * would test a value an operator never maps and the engine always supplies.
   */
  textSlot: () => 'customerName',
});

describe('the invoices provider draws what it was asked for', () => {
  it('renders a document with no authored body at all — a till receipt', async () => {
    // The purely mapped case: no template, no editor, just a row and an
    // outline. `body` is absent, and the document is drawn from the outline's
    // own defaults.
    const outcome = await provider.render({
      kind: 'receipt',
      subject: subjectFor('receipt'),
      formats: ['html', 'pdf'],
      paper: 'receipt-80mm',
      settings: {},
    });
    expect(isDocumentError(outcome), JSON.stringify(outcome)).toBe(false);
    if (isDocumentError(outcome)) return;
    expect(outcome).toHaveLength(2);

    const page = html(outcome.find((d) => d.format === 'html')!.bytes);
    expect(page).toContain('Acme Corporation');
    expect(page).toContain('80mm auto');
    // The gratuity is a slot with no field in the authored body (§5.2's second
    // amendment); it must still reach the ladder.
    expect(page).toContain('Gratuity');
    expect(page).toContain('Card ending 6411');
  });

  it('lets an authored body decide the wording, and the record decide the values', async () => {
    // The precedence rule, both directions in one assertion: the template's
    // title and terms survive, and the record's customer overrides whatever
    // the template was saved with.
    const outcome = await provider.render({
      kind: 'invoice',
      subject: subjectFor('invoice'),
      formats: ['html'],
      paper: 'a4',
      settings: {},
      body: {
        ...emptyBody(),
        title: 'PROFORMA',
        terms: 'Net 30. Late settlement carries 2% per month.',
        customerName: 'Somebody Else Ltd',
      },
    });
    expect(isDocumentError(outcome)).toBe(false);
    if (isDocumentError(outcome)) return;
    const page = html(outcome[0]!.bytes);
    expect(page).toContain('PROFORMA');
    expect(page).toContain('Net 30.');
    expect(page).toContain('Acme Corporation');
    expect(page).not.toContain('Somebody Else Ltd');
  });

  it('prints the total the money law computes, not one it was told', async () => {
    /*
     * 12 × 180.00 = 2160.00, 45 × 165.00 = 7425.00, 12 × 210.00 = 2520.00 →
     * subtotal 12105.00; less 10% = 1210.50 → 10894.50; tax 20% = 2178.90 →
     * total 13073.40. Worked here by hand rather than by calling the law,
     * because a test that computes its expectation the way the code does
     * asserts only that the code is self-consistent.
     */
    const outcome = await provider.render({
      kind: 'invoice',
      subject: subjectFor('invoice'),
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    const page = html(outcome[0]!.bytes);
    expect(page).toContain('EUR12,105.00');
    expect(page).toContain('−EUR1,210.50');
    expect(page).toContain('EUR2,178.90');
    expect(page).toContain('EUR13,073.40');
  });

  it('names every unmapped required column, not just the first', async () => {
    const subject = subjectFor('invoice');
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...subject, fields: {} },
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('MISSING_SLOT');
    expect(outcome.detail).toContain('customerName');
    // `number` and `issuedAt` are required WITH a default, so the engine fills
    // them and their absence is not a refusal. Getting that backwards would
    // refuse every document that had not been given a number yet.
    expect(outcome.detail).not.toContain('number');
    expect(outcome.detail).not.toContain('issuedAt');
  });

  it('refuses a Japanese document for PDF and renders it in HTML', async () => {
    /*
     * 34 O12, re-asked. The surface makes `ja` a first-class DOCUMENT language
     * (D49) and the base-14 fonts have no Japanese, so this is the pairing the
     * whole coverage design exists for: a typed refusal naming the glyphs on
     * one side, a complete document on the other.
     */
    const subject = subjectFor('invoice');
    const japanese = {
      ...subject,
      locale: 'ja-JP',
      fields: { ...subject.fields, customerName: '株式会社アクメ' },
    };

    const asPdf = await provider.render({
      kind: 'invoice',
      subject: japanese,
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(asPdf)) throw new Error('expected a refusal');
    expect(asPdf.code).toBe('LATIN_ONLY');
    expect(asPdf.dropped).toContain('株');

    const asHtml = await provider.render({
      kind: 'invoice',
      subject: japanese,
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    expect(isDocumentError(asHtml)).toBe(false);
    if (isDocumentError(asHtml)) return;
    expect(html(asHtml[0]!.bytes)).toContain('株式会社アクメ');
  });

  it('draws an Arabic document right to left, in its own language', async () => {
    const subject = subjectFor('invoice');
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...subject, locale: 'ar-EG', fields: { ...subject.fields, customerName: 'شركة' } },
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    const page = html(outcome[0]!.bytes);
    expect(page).toContain('dir="rtl"');
    expect(page).toContain('lang="ar-EG"');
    // The chrome is the DOCUMENT's language, not the viewer's.
    expect(page).toContain('الإجمالي');
  });

  it('falls back to English chrome for a language it has no words for', async () => {
    const subject = subjectFor('invoice');
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...subject, locale: 'ja-JP' },
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    // A row of missing keys would be worse than English.
    expect(html(outcome[0]!.bytes)).toContain('Subtotal');
  });

  it('warns when a letterhead image cannot reach the paper, rather than dropping it silently', async () => {
    const outcome = await provider.render({
      kind: 'invoice',
      subject: subjectFor('invoice'),
      formats: ['html', 'pdf'],
      paper: 'a4',
      settings: {},
      body: { ...emptyBody(), logoImage: 'data:image/png;base64,iVBORw0KGgo=' },
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(outcome.find((d) => d.format === 'pdf')!.warnings).toEqual([
      'the letterhead image is drawn in HTML only',
    ]);
    expect(outcome.find((d) => d.format === 'html')!.warnings).toEqual([]);
  });

  it('draws the document’s own text into the PDF, in WinAnsi bytes', async () => {
    /*
     * The counterpart to the HTML assertions above, and the one place `latin1`
     * is the CORRECT decoder: a PDF's content stream is single-byte WinAnsi,
     * so `é` is one byte and reading it back as latin1 is exact. It is also
     * the assertion that would catch a writer that produced a structurally
     * valid file with nothing drawn in it — every other PDF check in this
     * package is about the container.
     */
    const subject = subjectFor('invoice');
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...subject, fields: { ...subject.fields, customerName: 'Müller & Söhne' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));

    const pdf = LATIN1.decode(outcome[0]!.bytes);
    expect(pdf).toContain('(Müller & Söhne)');
    expect(pdf).toContain('(INVOICE)');
    expect(pdf).toContain('(Design system audit)');
    // The ampersand is NOT escaped in a PDF string literal — only `(`, `)`
    // and the backslash are. An HTML-shaped escape leaking in here would show
    // up as `&amp;` on the printed page.
    expect(pdf).not.toContain('&amp;');
    // WinAnsi puts `ü` at 0xFC and `ö` at 0xF6, one byte each.
    expect(outcome[0]!.bytes).toContain(0xfc);
    expect(outcome[0]!.bytes).toContain(0xf6);
  });

  it('refuses a body that is not an object at all', async () => {
    const outcome = await provider.render({
      kind: 'invoice',
      subject: subjectFor('invoice'),
      formats: ['html'],
      paper: 'a4',
      settings: {},
      body: ['not', 'an', 'object'] as unknown as Record<string, unknown>,
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('INVALID_SUBJECT');
  });

  it('draws a body from a future version rather than refusing the lot', async () => {
    // The renderer is handed documents stored months ago and, one day, ones
    // stored by a NEWER surface than itself. A field it has not heard of is
    // ignored; everything it understands still prints.
    const outcome = await provider.render({
      kind: 'invoice',
      subject: subjectFor('invoice'),
      formats: ['html'],
      paper: 'a4',
      settings: {},
      body: { ...emptyBody(), title: 'INVOICE', someBlockNobodyHasBuiltYet: { rows: [1, 2, 3] } },
    });
    expect(isDocumentError(outcome)).toBe(false);
  });

  it('gives every kind a filename carrying its number', async () => {
    for (const kind of provider.kinds()) {
      const outcome = await provider.render({
        kind: kind.id,
        subject: subjectFor(kind.id),
        formats: kind.formats,
        paper: kind.paper[0]!,
        settings: {},
      });
      if (isDocumentError(outcome)) throw new Error(`${kind.id}: ${JSON.stringify(outcome)}`);
      for (const document of outcome) {
        expect(document.filename).toBe(`${kind.id}-INV-1042.${document.format}`);
      }
    }
  });
});
