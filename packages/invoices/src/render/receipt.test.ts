/**
 * Receipts made from an app's OWN rows through a document profile it ships —
 * a practice's receipt for a patient's insurer, a till's emailed receipt —
 * rather than from a shape's payments row.
 *
 * What such a receipt needs that an invoice's payment did not: what the money
 * was for when it was not an invoice (the day of the visit, who gave it, the
 * payer's reference), the app's own word for how it was paid, a number in the
 * receipt series when Adminium's register numbered it, and a sale's lines.
 */

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import { describe as outlineOf } from '../kinds.ts';
import { renderDocument } from '../render.ts';
import provider from '../server.ts';
import { methodWord } from './layout.ts';
import { wordsFor } from './words.ts';

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

const NOW = { iso: '2026-09-03T09:15:00.000Z', timezone: 'Europe/London' };
const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const;

type Fields = Record<string, unknown>;

/** A practice's receipt: one payments row, mapped by the app's own profile. */
function visitSubject(fields: Fields = {}, locale = 'en-US', number: string | null = '2'): DocumentSubject {
  return {
    now: NOW,
    locale,
    currency: 'EUR',
    business: { name: 'Harbour Clinic', lines: ['1 Quay Street', 'Cork T12 X70A'] },
    entity: null,
    number,
    fields: {
      issuedAt: '2026-09-03',
      currency: 'EUR',
      amount: 8_500,
      paidWith: 'transfer',
      customerName: 'Tom Hale',
      title: 'Follow-up visit',
      serviceDate: '2026-08-28',
      attendedBy: 'Dr Rana Aziz',
      reference: 'AXA-7731-22',
      ...fields,
    },
    collections: {},
  };
}

async function draw(
  subject: DocumentSubject,
  paper: 'a4' | 'receipt-80mm' = 'receipt-80mm',
  settings: Fields = {},
  formats: readonly ('html' | 'pdf')[] = ['html', 'pdf'],
): Promise<readonly RenderedDocument[]> {
  const outcome = await provider.render({ kind: 'receipt', subject, formats, paper, settings });
  if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
  return outcome;
}

const page = (documents: readonly RenderedDocument[]) => UTF8.decode(documents.find((d) => d.format === 'html')!.bytes);
const pdf = (documents: readonly RenderedDocument[]) => LATIN1.decode(documents.find((d) => d.format === 'pdf')!.bytes);

/** The facts beside the addressee, label and value, in the order they are drawn. */
function facts(html: string): [string, string][] {
  const meta = /<div class="meta">(.*?)<\/div>/s.exec(html)?.[1] ?? '';
  return [...meta.matchAll(/<span class="k">(.*?)<\/span><span class="v">(?:<span class="fig">|<bdi>)(.*?)(?:<\/span>|<\/bdi>)<\/span><\/span>/g)].map(
    (match) => [match[1]!, match[2]!],
  );
}

describe('the receipt kind describes what a visit was for', () => {
  const slots = outlineOf('receipt').slots;
  const slot = (id: string) => slots.find((entry) => entry.id === id);

  it('offers the day of the service, who gave it and a reference, each optional', () => {
    expect(slot('serviceDate')).toMatchObject({ type: 'date', required: false });
    expect(slot('attendedBy')).toMatchObject({ type: 'text', required: false });
    expect(slot('reference')).toMatchObject({ type: 'text', required: false });
    for (const id of ['serviceDate', 'attendedBy', 'reference']) {
      // The contract's own rule for a slot id.
      expect(id).toMatch(/^[A-Za-z][A-Za-z0-9_]*$/);
      expect(slot(id)!.default).toBeUndefined();
    }
  });

  it('labels and explains each in all eight languages', () => {
    for (const id of ['serviceDate', 'attendedBy', 'reference']) {
      for (const locale of LOCALES) {
        expect(slot(id)!.label[locale], `${id} ${locale}`).toMatch(/\S/);
        expect(slot(id)!.help?.[locale], `${id} help ${locale}`).toMatch(/\S/);
      }
    }
  });

  it('can carry a sale’s stored figures, printed as stored', () => {
    for (const id of ['subtotal', 'tax', 'total', 'taxName']) expect(slot(id)?.required, id).toBe(false);
  });
});

describe('a receipt for a visit', () => {
  it('prints the visit’s day, who gave it and the reference, in the order a reader looks for them', async () => {
    const rows = facts(page(await draw(visitSubject())));
    expect(rows).toEqual([
      ['Receipt', 'REC-2'],
      ['Reference', 'AXA-7731-22'],
      ['Date of service', 'Aug 28, 2026'],
      ['Attended by', 'Dr Rana Aziz'],
      ['Received', 'Sep 3, 2026'],
      ['Method', 'Bank transfer'],
    ]);
  });

  it('puts the name in its own run, so it wraps on a till roll and keeps its direction', async () => {
    const html = page(await draw(visitSubject()));
    expect(html).toContain('<span class="k">Attended by</span><span class="v"><bdi>Dr Rana Aziz</bdi></span>');
  });

  it('draws the same rows in the PDF, on a till roll and on A4', async () => {
    for (const paper of ['receipt-80mm', 'a4'] as const) {
      const text = pdf(await draw(visitSubject(), paper));
      for (const shown of ['(Reference)', '(AXA-7731-22)', '(Date of service)', '(Aug 28, 2026)', '(Attended by)', '(Dr Rana Aziz)']) {
        expect(text, `${paper} ${shown}`).toContain(shown);
      }
      expect(text.indexOf('(Date of service)'), paper).toBeLessThan(text.indexOf('(Attended by)'));
    }
  });

  it('draws none of the three when the app maps none — a till’s receipt is as it was', async () => {
    const documents = await draw(visitSubject({ serviceDate: null, attendedBy: '', reference: undefined }));
    const html = page(documents);
    for (const absent of ['Date of service', 'Attended by', 'Reference']) {
      expect(html).not.toContain(absent);
      expect(pdf(documents)).not.toContain(`(${absent})`);
    }
  });

  it('prints them in German, and right to left in Arabic', async () => {
    const german = facts(page(await draw(visitSubject({}, 'de-DE'))));
    expect(german).toContainEqual(['Leistungsdatum', '28. Aug. 2026']);
    expect(german).toContainEqual(['Betreut von', 'Dr Rana Aziz']);
    expect(german).toContainEqual(['Referenz', 'AXA-7731-22']);

    const arabic = page(await draw(visitSubject({ attendedBy: 'د. رنا عزيز' }, 'ar-EG'), 'a4', {}, ['html']));
    expect(arabic).toContain('dir="rtl"');
    expect(arabic).toContain('<span class="k">تاريخ الخدمة</span>');
    expect(arabic).toContain('<span class="k">مقدّم الخدمة</span><span class="v"><bdi>د. رنا عزيز</bdi></span>');
    expect(arabic).toContain('<span class="k">المرجع</span>');
  });
});

describe('the way it was paid, in the app’s own spelling', () => {
  const english = wordsFor('en-US');

  it('reads the spellings apps store, whatever their case', () => {
    const cases: [string, string][] = [
      ['bank-transfer', 'Bank transfer'],
      ['transfer', 'Bank transfer'],
      ['bank_transfer', 'Bank transfer'],
      ['Bank Transfer', 'Bank transfer'],
      ['BANK', 'Bank transfer'],
      ['wire', 'Bank transfer'],
      ['card', 'Card'],
      ['credit-card', 'Card'],
      ['credit_card', 'Card'],
      ['CREDIT_CARD', 'Card'],
      ['debit-card', 'Card'],
      ['debit_card', 'Card'],
      ['check', 'Cheque'],
      ['Cheque', 'Cheque'],
      [' cash ', 'Cash'],
      ['gift_card', 'Gift card'],
      ['gift-card', 'Gift card'],
      ['qr', 'QR code'],
      ['other', 'Other'],
    ];
    for (const [stored, printed] of cases) expect(methodWord(stored, english), stored).toBe(printed);
  });

  it('prints anything else exactly as the app wrote it, rather than guessing', () => {
    for (const stored of ['voucher', 'Card ending 6411', 'credit', 'debit', 'Direct debit', 'constructor', 'toString', '']) {
      expect(methodWord(stored, english), stored).toBe(stored);
    }
  });

  it('prints a practice’s `transfer` in the document’s language, on the page and in the ledger', async () => {
    expect(facts(page(await draw(visitSubject({ paidWith: 'TRANSFER' }, 'de-DE'))))).toContainEqual(['Zahlungsweg', 'Überweisung']);
    expect(facts(page(await draw(visitSubject({ paidWith: 'gift_card' }, 'fr-FR'))))).toContainEqual(['Moyen', 'Carte cadeau']);
    for (const locale of LOCALES) {
      const words = wordsFor(locale);
      expect(methodWord('transfer', words), locale).toBe(words.methodBankTransfer);
      expect(methodWord('gift_card', words), locale).not.toBe('gift_card');
      expect(methodWord('qr', words), locale).not.toBe('qr');
    }
  });
});

describe('a receipt numbered by Adminium’s register', () => {
  it('prints a bare number in the receipt series — REC-2, not 2 — and names the file by it', async () => {
    const documents = await draw(visitSubject());
    expect(facts(page(documents))[0]).toEqual(['Receipt', 'REC-2']);
    expect(documents.map((d) => d.filename)).toEqual(['receipt-REC-2.html', 'receipt-REC-2.pdf']);
    expect(pdf(documents)).toContain('(REC-2)');
  });

  it('uses the business’s own receipt prefix, and none when it is set to none', async () => {
    expect(facts(page(await draw(visitSubject(), 'a4', { prefix_receipt: 'R/' })))[0]).toEqual(['Receipt', 'R/2']);
    expect(facts(page(await draw(visitSubject(), 'a4', { prefix_receipt: '' })))[0]).toEqual(['Receipt', '2']);
  });

  it('reads the number from the mapped field when the subject carries none', async () => {
    const subject = visitSubject({ number: '0015' }, 'en-US', null);
    expect(facts(page(await draw(subject)))[0]).toEqual(['Receipt', 'REC-0015']);
  });

  it('never doubles a prefix, and leaves an app’s own number as the app wrote it', async () => {
    for (const number of ['REC-0018', 'rec-7', 'T-1042', '2026/0007', 'A12']) {
      expect(facts(page(await draw(visitSubject({}, 'en-US', number))))[0], number).toEqual(['Receipt', number]);
    }
  });

  it('puts only a receipt in the receipt series', async () => {
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...visitSubject({ customerName: 'Tom Hale' }), number: '2' },
      formats: ['html'],
      paper: 'a4',
      settings: {},
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(outcome[0]!.filename).toBe('invoice-2.html');
  });

  it('does the same when drawn in a page, from the add-on’s settings', () => {
    const outcome = renderDocument({
      kind: 'receipt',
      record: { number: '3', issuedAt: '2026-09-03', amount: 1_200 },
      recordId: 'p-3',
      now: NOW,
      settings: { prefix_receipt: 'KV-' },
      currency: 'EUR',
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(outcome.map((d) => d.filename)).toContain('receipt-KV-3.html');
  });
});

/** A till's ticket: its lines, the stored figures, the tip, and what was charged. */
function saleSubject(fields: Fields = {}): DocumentSubject {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Daybreak Coffee', lines: ['9 Front Street'] },
    entity: null,
    number: 'T-1042',
    fields: {
      issuedAt: '2026-09-03',
      currency: 'USD',
      paidWith: 'card',
      subtotal: 1_690,
      tax: 125,
      total: 1_646,
      tip: 300,
      amount: 1_946,
      ...fields,
    },
    collections: {
      items: [
        { desc: 'Flat white', qty: 2, rate: 450, amount: 900 },
        { desc: 'Almond croissant', qty: 1, rate: 790, amount: 790 },
      ],
    },
  };
}

describe('a sale’s receipt from a till', () => {
  it('keeps its lines when the amount charged is mapped too', async () => {
    const html = page(await draw(saleSubject()));
    expect(html).toContain('Flat white');
    expect(html).toContain('Almond croissant');
    expect(html).not.toContain('Payment against');
  });

  it('prints the stored figures, the reduction they leave, the tip, and how it was paid', async () => {
    const html = page(await draw(saleSubject()));
    const ladder = [...html.matchAll(/<div class="row[^"]*"><span class="k">(.*?)<\/span><span class="fig">(.*?)<\/span><\/div>/g)].map((m) => [m[1], m[2]]);
    expect(ladder).toEqual([
      ['Subtotal', '$16.90'],
      // 16.90 + 1.25 − 16.46: the ticket's reduction, which it stores no column for.
      ['Reduction', '-$1.69'],
      ['Tax', '$1.25'],
      ['Gratuity', '$3.00'],
      ['Total', '$19.46'],
      ['Card', '$19.46'],
    ]);
  });

  it('prints no reduction when the stored figures add up', async () => {
    const html = page(await draw(saleSubject({ total: 1_815, amount: 2_115 })));
    expect(html).not.toContain('Reduction');
    expect(html).toContain('$21.15');
  });

  it('draws the same in the PDF', async () => {
    const text = pdf(await draw(saleSubject()));
    for (const shown of ['(Flat white)', '(Reduction)', '(-$1.69)', '(Gratuity)', '(Card)', '($19.46)']) expect(text, shown).toContain(shown);
  });
});

describe('what a line carries besides its figures', () => {
  const LINE_KINDS = ['invoice', 'receipt', 'credit-note', 'quote'] as const;

  it('offers a day and a list of names on every line, each optional, in all eight languages', () => {
    for (const kind of LINE_KINDS) {
      const columns = outlineOf(kind).slots.find((entry) => entry.id === 'items')!.columns!;
      expect(columns.find((column) => column.id === 'date'), kind).toMatchObject({ type: 'date', required: false });
      expect(columns.find((column) => column.id === 'options'), kind).toMatchObject({ type: 'text[]', required: false });
      for (const id of ['date', 'options']) {
        const column = columns.find((entry) => entry.id === id)!;
        for (const locale of LOCALES) {
          expect(column.label[locale], `${kind} ${id} ${locale}`).toMatch(/\S/);
          expect(column.help?.[locale], `${kind} ${id} help ${locale}`).toMatch(/\S/);
        }
      }
    }
  });

  it('offers an invoice the period of service and a reference, each optional', () => {
    const slots = outlineOf('invoice').slots;
    expect(slots.find((entry) => entry.id === 'serviceFrom')).toMatchObject({ type: 'date', required: false });
    expect(slots.find((entry) => entry.id === 'serviceTo')).toMatchObject({ type: 'date', required: false });
    expect(slots.find((entry) => entry.id === 'reference')).toMatchObject({ type: 'text', required: false });
    for (const id of ['serviceFrom', 'serviceTo', 'reference']) {
      const slot = slots.find((entry) => entry.id === id)!;
      expect(slot.default).toBeUndefined();
      for (const locale of LOCALES) {
        expect(slot.label[locale], `${id} ${locale}`).toMatch(/\S/);
        expect(slot.help?.[locale], `${id} help ${locale}`).toMatch(/\S/);
      }
    }
    // The receipt's `reference` keeps its own explanation, and both kinds share the slot's name.
    expect(outlineOf('receipt').slots.find((entry) => entry.id === 'reference')!.help!['en-US']).toContain('insurer');
    expect(slots.find((entry) => entry.id === 'reference')!.label).toEqual(outlineOf('receipt').slots.find((entry) => entry.id === 'reference')!.label);
  });

  it('prints the German period as the term an invoice must carry', () => {
    expect(wordsFor('de-DE').servicePeriod).toBe('Leistungszeitraum');
    for (const locale of LOCALES) expect(wordsFor(locale).servicePeriod, locale).toMatch(/\S/);
  });
});

/*
 * ── A KITCHEN'S RECEIPT: THE NAMES CHOSEN ON A LINE, UNDER IT ──────────────
 *
 * Order #2109 at a lunch counter: a grain bowl built from three choices, and a
 * cookie. The kitchen's profile maps the line's name, quantity and price, the
 * names chosen on it one level below, the stored subtotal, tax and total, and
 * the order's own number as the reference — the receipt's own number is the
 * register's.
 */
function orderSubject(lines: Fields[] = [], fields: Fields = {}): DocumentSubject {
  return {
    now: { iso: '2026-07-28T11:16:00.000Z', timezone: 'America/New_York' },
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Juniper Kitchen', lines: ['41 Alder Street'] },
    entity: null,
    number: '2118',
    fields: {
      issuedAt: '2026-07-28',
      currency: 'USD',
      reference: '#2109',
      paidWith: 'card',
      attendedBy: 'Sam',
      subtotal: 21_50,
      tax: 1_77,
      total: 23_27,
      ...fields,
    },
    collections: {
      items:
        lines.length > 0
          ? lines
          : [
              { desc: 'Signature grain bowl', qty: 1, rate: 18_00, options: ['Farro', 'Grilled chicken', 'Avocado'] },
              { desc: 'Cookie', qty: 1, rate: 3_50, options: [] },
            ],
    },
  };
}

describe('a kitchen’s receipt, the choices under each line', () => {
  it('prints the grain bowl at $18.00 with its three choices under it, on a till roll and on A4', async () => {
    for (const paper of ['receipt-80mm', 'a4'] as const) {
      const html = page(await draw(orderSubject(), paper));
      expect(html, paper).toContain(
        '<td><bdi>Signature grain bowl</bdi><span class="note">Farro · Grilled chicken · Avocado</span></td><td class="right"><span class="fig">1</span></td><td class="right"><span class="fig">$18.00</span></td><td class="right"><span class="fig">$18.00</span></td>',
      );
      expect(html, paper).toContain('<td><bdi>Cookie</bdi></td>');
      expect(html, paper).toContain('<span class="fig">$23.27</span>');
    }
  });

  it('quotes the order’s number as the reference, beside the register’s receipt number', async () => {
    expect(facts(page(await draw(orderSubject())))).toEqual([
      ['Receipt', 'REC-2118'],
      ['Reference', '#2109'],
      ['Attended by', 'Sam'],
      ['Received', 'Jul 28, 2026'],
      ['Method', 'Card'],
    ]);
  });

  it('draws the choices in the PDF with a middle dot the font has, on a till roll and on A4', async () => {
    for (const paper of ['receipt-80mm', 'a4'] as const) {
      const outcome = await draw(orderSubject(), paper, {}, ['pdf']);
      const bytes = outcome[0]!.bytes;
      // U+00B7 is WinAnsi 0xB7: one byte, drawn, not dropped.
      const wanted = [...'(Farro '].map((c) => c.charCodeAt(0)).concat(0xb7, ...[...' Grilled chicken '].map((c) => c.charCodeAt(0)), 0xb7);
      const at = Buffer.from(bytes).indexOf(Buffer.from(wanted));
      expect(at, paper).toBeGreaterThan(0);
      expect(pdf(outcome), paper).toContain('(Signature grain bowl)');
      expect(outcome[0]!.warnings, paper).toEqual([]);
    }
  });

  it('reads the names from text with one name a line, as well as from a list', async () => {
    const lines = [{ desc: 'Signature grain bowl', qty: 1, rate: 18_00, options: 'Farro\nGrilled chicken\n\n Avocado ' }];
    expect(page(await draw(orderSubject(lines)))).toContain('<span class="note">Farro · Grilled chicken · Avocado</span>');
  });

  it('prints the choices above a reduction on a stored line, one small line each', async () => {
    const lines = [
      { desc: 'Signature grain bowl', qty: 1, rate: 18_00, discountKind: 'amount', discount: 2, amount: 16_00, options: ['Farro', 'Avocado'] },
    ];
    const documents = await draw(orderSubject(lines));
    expect(page(documents)).toContain('<span class="note">Farro · Avocado</span><span class="note">less $2.00 discount</span>');
    const text = pdf(documents);
    expect(text.indexOf('(Farro · Avocado)')).toBeGreaterThan(0);
    expect(text.indexOf('(Farro · Avocado)')).toBeLessThan(text.indexOf('(less $2.00 discount)'));
  });

  it('escapes a name like every other value', async () => {
    const lines = [{ desc: 'Bowl', qty: 1, rate: 1_00, options: ['<script>alert(1)</script>', 'Tofu & rice'] }];
    const html = page(await draw(orderSubject(lines)));
    expect(html).not.toContain('<script');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; · Tofu &amp; rice');
  });

  it('puts a line’s day under it on a till roll, where a column of days does not fit', async () => {
    const lines = [{ desc: 'Class pass', qty: 1, rate: 12_00, amount: 12_00, date: '2026-07-30', options: ['Morning'] }];
    const roll = page(await draw(orderSubject(lines), 'receipt-80mm'));
    expect(roll).not.toContain('<th>Date</th>');
    expect(roll).toContain('<td><bdi>Class pass</bdi><span class="note">Jul 30, 2026</span><span class="note">Morning</span></td>');
    const sheet = page(await draw(orderSubject(lines), 'a4'));
    expect(sheet).toContain('<thead><tr><th>Date</th><th>Description</th>');
    expect(sheet).toContain('<tr><td><span class="fig">Jul 30, 2026</span></td><td><bdi>Class pass</bdi><span class="note">Morning</span></td>');
  });
});

/*
 * ── A TICKET OFFICE'S RECEIPT: NOTHING NEW, AND NOTHING LOST ───────────────
 *
 * Order WV-8790, a weekend pass. The number has letters, so it is printed as
 * the app wrote it and never put in the receipt series.
 */
describe('a ticket office’s receipt', () => {
  const ticketSubject = (fields: Fields = {}, items?: Fields[]): DocumentSubject => ({
    now: { iso: '2026-07-28T18:00:00.000Z', timezone: 'Europe/London' },
    locale: 'en-US',
    currency: 'USD',
    business: { name: 'Waveform', lines: [] },
    entity: null,
    number: '57',
    fields: { issuedAt: '2026-07-20', currency: 'USD', amount: 85_00, paidWith: 'card', customerName: 'Ada Quill', reference: 'WV-8790', ...fields },
    collections: items === undefined ? {} : { items },
  });

  it('prints the order as the reference on the receipt of its payment', async () => {
    const html = page(await draw(ticketSubject(), 'a4'));
    expect(facts(html)).toEqual([
      ['Receipt', 'REC-57'],
      ['Reference', 'WV-8790'],
      ['Received', 'Jul 20, 2026'],
      ['Method', 'Card'],
    ]);
    expect(html).toContain('<span class="fig">$85.00</span>');
  });

  it('prints the weekend pass as its line when the number is the order’s own', async () => {
    const documents = await draw({ ...ticketSubject({ reference: '' }, [{ desc: 'Weekend pass', qty: 1, rate: 85_00, amount: 85_00 }]), number: 'WV-8790' }, 'a4');
    expect(facts(page(documents))[0]).toEqual(['Receipt', 'WV-8790']);
    expect(page(documents)).toContain('<td><bdi>Weekend pass</bdi></td>');
    expect(pdf(documents)).toContain('(Weekend pass)');
    expect(documents.map((d) => d.filename)).toEqual(['receipt-WV-8790.html', 'receipt-WV-8790.pdf']);
  });
});
