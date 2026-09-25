/**
 * The printed copy of a document built on one of this add-on's shapes — what
 * a client, a bookkeeper and a tax office read.
 *
 * Every subject here is shaped the way Adminium hands one over for a shape's
 * profile: money in minor units of the DOCUMENT's currency, rates in basis
 * points, the stored figures mapped, the letterhead in `business`. The pages
 * are read back as text and the assertions are on what a person sees.
 */

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import provider from '../server.ts';

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

const NOW = { iso: '2026-07-31T09:15:00.000Z', timezone: 'Europe/London' };

const BUSINESS = {
  name: 'Outline Studio',
  lines: ['12 Bell Street', 'Leeds LS1 4AB'],
  taxNumber: 'GB 123 4567 89',
  paymentInstructions: 'Bank transfer to Outline Studio\nSort code 12-34-56 · Account 12345678',
  footer: 'Thank you for working with us.',
};

type Fields = Record<string, unknown>;

function invoiceSubject(fields: Fields = {}, collections: Record<string, Fields[]> = {}): DocumentSubject {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'EUR',
    business: BUSINESS as DocumentSubject['business'],
    entity: null,
    number: 'INV-0042',
    fields: {
      customerName: 'Hearth & Loaf',
      customerContact: 'Amara Okafor',
      customerLines: ['3 Mill Lane', 'York YO1 7HH'],
      customerTaxNumber: 'GB 987 6543 21',
      title: 'Bakehouse rebrand — stage one',
      issuedAt: '2026-07-12',
      dueAt: '2026-07-26',
      terms: 'net14',
      currency: 'EUR',
      taxName: 'VAT',
      taxRate: 2000,
      subtotal: 109_900,
      tax: 21_980,
      total: 131_880,
      paid: 50_000,
      balance: 81_880,
      status: 'sent',
      ...fields,
    },
    collections: {
      items: [
        { desc: 'Brand strategy', qty: 1, rate: 60_000, discountKind: 'amount', discount: 0, amount: 60_000 },
        // Stored as 2 × 250.00 less 1.00. The page prints the STORED 499.00.
        { desc: 'Logo suite', qty: 2, rate: 25_000, discountKind: 'amount', discount: 1, amount: 49_900 },
      ],
      payments: [
        { number: 'REC-0018', paidOn: '2026-07-20', method: 'bank-transfer', amount: 50_000, voided: 'false' },
        { number: 'REC-0019', paidOn: '2026-07-21', method: 'card', amount: 9_999, voided: 'true' },
      ],
      ...collections,
    },
  };
}

async function render(
  kind: string,
  subject: DocumentSubject,
  formats: readonly ('html' | 'pdf')[] = ['html', 'pdf'],
  settings: Record<string, unknown> = { tax_name: 'VAT' },
): Promise<readonly RenderedDocument[]> {
  const outcome = await provider.render({ kind, subject, formats, paper: 'a4', settings });
  if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
  return outcome;
}

const page = (documents: readonly RenderedDocument[]) => UTF8.decode(documents.find((d) => d.format === 'html')!.bytes);
const pdf = (documents: readonly RenderedDocument[]) => LATIN1.decode(documents.find((d) => d.format === 'pdf')!.bytes);

describe('an invoice built on the shape', () => {
  it('prints the stored figures as stored, never a second computation of them', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('€1,099.00'); // subtotal
    expect(html).toContain('VAT 20%');
    expect(html).toContain('€219.80');
    expect(html).toContain('€1,318.80'); // total
    expect(html).toContain('€499.00'); // the stored line, not 2 × 250.00
    expect(html).toContain('less €1.00 discount');
  });

  it('draws the letterhead: name, lines, and the tax name with the tax number', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('Outline Studio');
    expect(html).toContain('12 Bell Street');
    expect(html).toContain('VAT GB 123 4567 89');
  });

  it('draws both parties: the client’s contact, address and tax number', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('Invoice to');
    expect(html).toContain('Hearth &amp; Loaf');
    expect(html).toContain('Amara Okafor');
    expect(html).toContain('York YO1 7HH');
    expect(html).toContain('Tax number GB 987 6543 21');
  });

  it('prints the issued number, the days and the terms in the document’s words', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('INV-0042');
    expect(html).toContain('Jul 12, 2026');
    expect(html).toContain('Jul 26, 2026');
    expect(html).toContain('Net 14');
    expect(html).toContain('Bakehouse rebrand — stage one');
  });

  it('says how to pay, with the number as the reference', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('How to pay');
    expect(html).toContain('Sort code 12-34-56');
    expect(html).toContain('Reference: INV-0042');
    expect(html).toContain('Thank you for working with us.');
  });

  it('lists the payments so far and the amount due in bold — a voided payment left off', async () => {
    const html = page(await render('invoice', invoiceSubject()));
    expect(html).toContain('Payments so far');
    expect(html).toContain('Jul 20, 2026');
    expect(html).toContain('Bank transfer');
    expect(html).toContain('€500.00');
    expect(html).toMatch(/<div class="due"><span>Amount due<\/span><span class="fig">€818\.80<\/span><\/div>/);
    expect(html).not.toContain('€99.99');
  });

  it('prints only the amount due when the business turned the payments list off', async () => {
    const html = page(await render('invoice', invoiceSubject(), ['html'], { show_payment_ledger: false }));
    expect(html).not.toContain('Payments so far');
    expect(html).toContain('Amount due');
    expect(html).toContain('€818.80');
  });

  it('puts the same words in the PDF', async () => {
    const text = pdf(await render('invoice', invoiceSubject()));
    // Small headings are drawn in capitals, as the page sets them in CSS.
    for (const word of ['(PAYMENTS SO FAR)', '(Amount due)', '(Reference: INV-0042)', '(HOW TO PAY)', '(Hearth & Loaf)']) {
      expect(text).toContain(word);
    }
  });

  it('draws the same subject to the same bytes twice', async () => {
    const first = await render('invoice', invoiceSubject());
    const second = await render('invoice', invoiceSubject());
    expect(second.map((d) => Array.from(d.bytes))).toEqual(first.map((d) => Array.from(d.bytes)));
  });
});

describe('the currency’s own decimals and sign', () => {
  it('prints yen with no decimals — ¥4,373, not ¥43.73', async () => {
    const subject = invoiceSubject(
      { currency: 'JPY', subtotal: 4049, tax: 324, total: 4373, taxRate: 800, paid: null, balance: 4373 },
      {
        items: [
          { desc: 'Three hours, a rate off', qty: 3, rate: 1200, discountKind: 'percent', discount: 12.5, amount: 3150 },
          { desc: 'One piece', qty: 1, rate: 999, discountKind: 'amount', discount: 100, amount: 899 },
        ],
        payments: [],
      },
    );
    const html = page(await render('invoice', subject));
    expect(html).toContain('¥4,049');
    expect(html).toContain('¥324');
    expect(html).toContain('¥4,373');
    expect(html).toContain('¥1,200');
    expect(html).toContain('less 12.5% discount');
    expect(html).toContain('less ¥100 discount');
    expect(html).not.toMatch(/¥[\d,]+\.\d/);
    // And the PDF draws it: ¥ is in the writer's fonts.
    expect(pdf(await render('invoice', subject))).toContain('4,373');
  });

  it('prints dinars with three decimals', async () => {
    const subject = invoiceSubject(
      { currency: 'KWD', subtotal: 11_505, tax: 575, total: 12_080, taxRate: 500, paid: null, balance: 12_080 },
      {
        items: [
          { desc: 'Two', qty: 2, rate: 1250, discountKind: 'amount', discount: 0, amount: 2500 },
          { desc: 'One, a rate off', qty: 1, rate: 10_005, discountKind: 'percent', discount: 10, amount: 9005 },
        ],
        payments: [],
      },
    );
    const html = page(await render('invoice', subject));
    expect(html).toMatch(/KWD\s11\.505/);
    expect(html).toMatch(/KWD\s0\.575/);
    expect(html).toMatch(/KWD\s12\.080/);
    expect(html).toMatch(/KWD\s9\.005/);
  });

  it('writes the sign the document’s language writes: 1.318,80 € in German', async () => {
    const html = page(await render('invoice', { ...invoiceSubject(), locale: 'de-DE' }));
    expect(html).toMatch(/1\.318,80\s€/);
    expect(html).toContain('Rechnung an');
    expect(html).toContain('So bezahlen Sie');
  });

  it('draws a French PDF, whose figures use a narrow no-break space', async () => {
    const documents = await render('invoice', { ...invoiceSubject(), locale: 'fr-FR' });
    expect(documents.map((d) => d.format)).toEqual(['html', 'pdf']);
    expect(page(documents)).toMatch(/1 318,80\s€/);
  });

  it('prints the code where the PDF cannot draw the sign, on the page and the PDF alike', async () => {
    const subject = invoiceSubject({ currency: 'INR' });
    const documents = await render('invoice', subject);
    expect(documents.map((d) => d.format)).toEqual(['html', 'pdf']);
    expect(page(documents)).toMatch(/INR\s1,318\.80/);
    expect(page(documents)).not.toContain('₹');
    expect(pdf(documents)).toContain('INR');
  });
});

describe('a void document', () => {
  const voided = () =>
    invoiceSubject({
      status: 'void',
      voidedOn: '2026-07-30',
      // Nothing maps the reason — but were a column of that name ever to
      // reach a subject, it would still not reach the page.
      voidReason: 'Client went bust',
      void_reason: 'Client went bust',
    });

  it('carries VOID across the sheet and the day it was voided — never the reason', async () => {
    const documents = await render('invoice', voided());
    const html = page(documents);
    expect(html).toContain('<div class="void" aria-hidden="true"><span>VOID</span></div>');
    expect(html).toContain('<span class="k">Void</span>');
    expect(html).toContain('Voided on Jul 30, 2026. The number is kept so the sequence has no gaps. Nothing is owed on it.');
    expect(html).not.toContain('went bust');
    const text = pdf(documents);
    expect(text).toContain('(VOID)');
    expect(text).not.toContain('went bust');
  });

  it('asks nobody to pay it and lists no payments', async () => {
    const html = page(await render('invoice', voided()));
    expect(html).not.toContain('How to pay');
    expect(html).not.toContain('Payments so far');
    expect(html).toContain('INV-0042');
  });

  it('marks a voided payment’s receipt too', async () => {
    const html = page(await render('receipt', receiptSubject({ voided: 'true', voidedOn: '2026-07-22' })));
    expect(html).toContain('<span>VOID</span>');
    expect(html).toContain('Jul 22, 2026');
  });
});

describe('the print copy in every language', () => {
  it('draws an Arabic invoice right to left, in HTML, and says to print it as a PDF', async () => {
    const documents = await render('invoice', { ...invoiceSubject(), locale: 'ar-EG' });
    expect(documents.map((d) => d.format)).toEqual(['html']);
    expect(documents[0]!.warnings).toEqual(['لهذه اللغة، استخدم الطباعة واختر الحفظ بصيغة PDF.']);
    const html = page(documents);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('lang="ar-EG"');
    expect(html).toContain('فاتورة إلى');
    expect(html).toContain('طريقة الدفع');
    expect(html).toContain('المدفوعات حتى الآن');
    // Figures are isolated, so the digits of a total keep their order.
    expect(html).toMatch(/<span class="fig">[^<]*١٬٣١٨٫٨٠[^<]*<\/span>/);
    // …and read left to right, or the page's direction turns the amount around its currency.
    expect(html).toMatch(/\.fig \{[^}]*direction: ltr;[^}]*unicode-bidi: isolate;/);
  });

  it.each(['zh-CN', 'zh-TW'])('draws a %s invoice as the print copy only', async (locale) => {
    const documents = await render('invoice', { ...invoiceSubject(), locale });
    expect(documents.map((d) => d.format)).toEqual(['html']);
    expect(documents[0]!.warnings[0]).toContain('PDF');
  });

  it('refuses the PDF alone for Arabic, naming the glyphs, as the contract says', async () => {
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...invoiceSubject(), locale: 'ar-EG' },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('LATIN_ONLY');
    expect(outcome.dropped?.length).toBeGreaterThan(0);
  });

  it.each(['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ'])('draws a %s invoice as a PDF too', async (locale) => {
    const documents = await render('invoice', { ...invoiceSubject(), locale });
    expect(documents.map((d) => d.format)).toEqual(['html', 'pdf']);
    expect(documents.find((d) => d.format === 'pdf')!.warnings).toEqual([]);
  });

  it('draws Czech in the PDF, the letters WinAnsi lacks in the second face', async () => {
    const text = pdf(await render('invoice', { ...invoiceSubject(), locale: 'cs-CZ' }));
    expect(text).toContain('/F3 ');
    // "ODBĚRATEL", the label set in capitals: the Ě is the only letter the
    // second (bold) face draws, and the word carries on in the first.
    expect(text).toMatch(/\(ODB\) Tj\n\/F4 [\d.]+ Tf\n\(.\) Tj\n\/F2 [\d.]+ Tf\n\(RATEL\) Tj/);
  });
});

function receiptSubject(fields: Fields = {}): DocumentSubject {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'EUR',
    business: BUSINESS as DocumentSubject['business'],
    entity: null,
    number: 'REC-0018',
    fields: {
      issuedAt: '2026-07-20',
      currency: 'EUR',
      amount: 50_000,
      paidWith: 'bank-transfer',
      invoiceNumber: 'INV-0042',
      invoiceTotal: 131_880,
      balanceAfter: 81_880,
      voided: 'false',
      ...fields,
    },
    collections: {},
  };
}

describe('the receipt of one payment', () => {
  it('names the payment, the invoice it pays and the balance left after it', async () => {
    const html = page(await render('receipt', receiptSubject()));
    expect(html).toContain('Receipt REC-0018 · for INV-0042');
    expect(html).toContain('Payment against INV-0042');
    expect(html).toContain('Invoice total');
    expect(html).toContain('Received Jul 20, 2026');
    expect(html).toContain('Balance left');
    expect(html).toContain('€818.80');
    expect(html).toContain('Bank transfer');
    expect(html).toContain('Thank you');
    expect(html).toContain('This receipt confirms money received. It is not a new invoice.');
  });

  it('prints on a till roll too', async () => {
    const outcome = await provider.render({ kind: 'receipt', subject: receiptSubject(), formats: ['html', 'pdf'], paper: 'receipt-80mm', settings: {} });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(page(outcome)).toContain('80mm auto');
    expect(pdf(outcome)).toContain('(THANK YOU)');
  });
});

function statementSubject(): DocumentSubject {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'EUR',
    business: BUSINESS as DocumentSubject['business'],
    entity: null,
    number: null,
    fields: {
      customerName: 'Hearth & Loaf',
      currency: 'EUR',
      issuedAt: '2026-07-31',
      periodFrom: '2026-01-01',
      periodTo: '2026-07-31',
      openingBalance: 20_000,
      documentsTotal: 131_880,
      paymentsTotal: 70_000,
      closingBalance: 81_880,
    },
    collections: {
      entries: [
        { date: '2026-07-12', kind: 'document', number: 'INV-0042', amount: 131_880, balance: 151_880 },
        { date: '2026-07-15', kind: 'payment', number: 'REC-0017', amount: 20_000, balance: 131_880 },
        { date: '2026-07-20', kind: 'payment', number: 'REC-0018', amount: 50_000, balance: 81_880 },
      ],
    },
  };
}

describe('a statement', () => {
  it('lists every entry with the balance after it, then what is still open', async () => {
    const html = page(await render('statement', statementSubject()));
    expect(html).toContain('Statement of account');
    expect(html).toContain('Statement for');
    expect(html).toContain('Jan 1, 2026 – Jul 31, 2026');
    expect(html).toContain('Owed at the start');
    expect(html).toContain('Invoice INV-0042');
    expect(html).toContain('Payment REC-0018');
    expect(html).toContain('-€500.00');
    expect(html).toContain('€1,518.80');
    expect(html).toMatch(/<div class="row total"><span class="k">Balance<\/span><span class="fig">€818\.80<\/span><\/div>/);
    expect(html).toContain('Reference: the invoice number');
  });

  it('is named by the day it runs to, and draws to the same bytes twice', async () => {
    const first = await render('statement', statementSubject());
    const second = await render('statement', statementSubject());
    expect(first.map((d) => d.filename)).toEqual(['statement-2026-07-31.html', 'statement-2026-07-31.pdf']);
    expect(second.map((d) => Array.from(d.bytes))).toEqual(first.map((d) => Array.from(d.bytes)));
  });
});

describe('a quote', () => {
  it('shows the days, the scope, the split and the acceptance', async () => {
    const subject: DocumentSubject = {
      ...invoiceSubject({
        sentOn: '2026-07-01',
        validUntil: '2026-07-31',
        status: 'accepted',
        scope: ['Marks, a type pairing and signage.', 'Two rounds of changes.'],
        paymentSplit: ['50 % to start', '50 % on delivery'],
        signedName: 'Cleo Nkemdi',
        signedOn: '2026-07-05',
        termsVersion: 'v3',
        fingerprint: '9f2c4a7e11b0c3d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9',
        paid: null,
        balance: null,
      }),
      number: 'QUO-0007',
    };
    const html = page(await render('quote', subject));
    expect(html).toContain('Quote for');
    expect(html).toContain('Valid until');
    expect(html).toContain('Marks, a type pairing and signage.');
    expect(html).toContain('How it gets paid');
    expect(html).toContain('50 % on delivery');
    expect(html).toContain('Accepted and signed');
    expect(html).toContain('Cleo Nkemdi');
    expect(html).toContain('terms v3 · fingerprint 9f2c…c8d9');
    expect(html).not.toContain('Payments so far');
  });
});

describe('what an authored template decides still stands', () => {
  it('keeps a template’s own symbol when nothing maps a currency', async () => {
    const outcome = await provider.render({
      kind: 'invoice',
      subject: { ...invoiceSubject(), fields: { customerName: 'Somebody' }, collections: { items: [{ desc: 'One', qty: 1, rate: 1000 }] } },
      formats: ['html'],
      paper: 'a4',
      settings: {},
      body: { currency: '£', title: 'INVOICE' },
    });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(page(outcome)).toContain('£10.00');
  });

  it('draws a letterhead image in HTML only when it is a raster data URI', async () => {
    const png = 'data:image/png;base64,iVBORw0KGgo=';
    const withImage = await render('invoice', { ...invoiceSubject(), business: { ...BUSINESS, logoDataUrl: png } as DocumentSubject['business'] });
    expect(page(withImage)).toContain(`<img class="mark-image" alt="" src="${png}">`);
    expect(withImage.find((d) => d.format === 'pdf')!.warnings).toEqual(['the letterhead image is drawn in HTML only']);

    const script = await render('invoice', { ...invoiceSubject(), business: { ...BUSINESS, logoDataUrl: 'javascript:alert(1)' } as DocumentSubject['business'] });
    expect(page(script)).not.toContain('javascript:');
    expect(page(script)).toContain('<span class="mark" aria-hidden="true">O</span>');
  });

  it('falls back to the settings for a letterhead an older server does not send', async () => {
    const subject = { ...invoiceSubject(), business: { name: 'Outline Studio', lines: [] } };
    const html = page(await render('invoice', subject, ['html'], { tax_number: 'GB 1', payment_instructions: 'Pay by cheque', footer: 'Kind regards' }));
    expect(html).toContain('Tax number GB 1');
    expect(html).toContain('Pay by cheque');
    expect(html).toContain('Kind regards');
  });
});
