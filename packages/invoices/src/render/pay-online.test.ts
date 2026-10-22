/**
 * An invoice's pay link and its code to scan, as Adminium gives them: printed
 * under how to pay while something is owed, in HTML and in the PDF, and never
 * on a void or a paid invoice. A link that is not `https`, or a code that is
 * not one, is not drawn; the rest of the page is. (A document with neither
 * draws to the bytes it always did: `unchanged.test.ts`.)
 */

import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import provider from '../server.ts';
import { payQrOf, payUrlOf } from '../subject.ts';

const URL_TO_PAY = 'https://pay.crumbandco.test/pay/AAAAAAAAAAAAAAAAAAAAAA';
const SIZE = 21;
/** A square of modules: not a real code (the host makes those), but the shape of one. */
const MODULES = Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, col) => ((row * 7 + col * 3) % 5 === 0 ? '1' : '0')).join(''));
const QR = { text: URL_TO_PAY.slice(0, 64), modules: MODULES, png: 'data:image/png;base64,iVBORw0KGgo=' };

const NOW = { iso: '2026-10-21T09:15:00.000Z', timezone: 'Europe/Berlin' };
const BUSINESS = { name: 'Crumb & Co.', lines: ['1 Mill Lane', 'Berlin'], paymentInstructions: 'Bank transfer to Crumb & Co.\nIBAN DE89 3704 0044 0532 0130 00' };

function invoice(fields: Record<string, unknown> = {}): DocumentSubject {
  return {
    now: NOW,
    locale: 'en-US',
    currency: 'EUR',
    business: BUSINESS as DocumentSubject['business'],
    entity: null,
    number: 'INV-0042',
    fields: { customerName: 'Lena Fischer', issuedAt: '2026-10-19', dueAt: '2026-11-02', currency: 'EUR', subtotal: 12_000, tax: 0, total: 12_000, paid: 0, balance: 12_000, status: 'sent', payUrl: URL_TO_PAY, payQr: QR, ...fields },
    collections: { items: [{ desc: 'Sourdough loaves', qty: 24, rate: 500, amount: 12_000 }], payments: [] },
  };
}

const UTF8 = new TextDecoder();
const LATIN1 = new TextDecoder('latin1');

async function draw(subject: DocumentSubject, paper: 'a4' | 'receipt-80mm' = 'a4'): Promise<{ html: string; pdf: string }> {
  const outcome = await provider.render({ kind: 'invoice', subject, formats: ['html', 'pdf'], paper, settings: {} });
  if (isDocumentError(outcome)) throw new Error(`${outcome.code}: ${outcome.detail ?? ""}`);
  const of = (format: string) => (outcome as readonly RenderedDocument[]).find((drawn) => drawn.format === format)!.bytes;
  return { html: UTF8.decode(of('html')), pdf: LATIN1.decode(of('pdf')) };
}

describe('an invoice’s pay link', () => {
  it('prints the link under how to pay, with its code, in HTML', async () => {
    const { html } = await draw(invoice());
    expect(html).toContain(`Or pay online: ${URL_TO_PAY}`);
    expect(html).toContain(`<img class="pay-qr" alt="" src="${QR.png}">`);
    expect(html).toContain('.foot .pay-qr');
    // Under the business's own instructions and the reference, not instead of them.
    expect(html.indexOf('IBAN DE89')).toBeLessThan(html.indexOf('Or pay online'));
  });

  it('prints the link, on a line of its own, and the code as squares, in the PDF', async () => {
    for (const paper of ['a4', 'receipt-80mm'] as const) {
      const { pdf } = await draw(invoice(), paper);
      expect(pdf, paper).toContain('(Or pay online:');
      expect(pdf, paper).toContain('pay.crumbandco.test');
      // One filled square per run of dark modules: the code is drawn, not an image.
      const runs = MODULES.reduce((sum, row) => sum + (row.match(/1+/g) ?? []).length, 0);
      expect(pdf.split(' re\nf\n').length - 1, paper).toBeGreaterThanOrEqual(runs);
    }
  });

  it('prints it in the invoice’s language', async () => {
    const { html } = await draw({ ...invoice(), locale: 'de-DE' });
    expect(html).toContain(`Oder online bezahlen: ${URL_TO_PAY}`);
  });

  it('keeps the link and leaves the code out when the host gave none', async () => {
    const { html } = await draw(invoice({ payQr: null }));
    expect(html).toContain(`Or pay online: ${URL_TO_PAY}`);
    expect(html).not.toContain('pay-qr"');
  });

  it('prints nothing to pay online on a paid or a void invoice', async () => {
    for (const fields of [{ paid: 12_000, balance: 0 }, { status: 'void', voidedOn: '2026-10-20' }]) {
      const { html, pdf } = await draw(invoice(fields));
      expect(html, JSON.stringify(fields)).not.toContain('pay online');
      expect(html, JSON.stringify(fields)).not.toContain('pay-qr');
      expect(pdf, JSON.stringify(fields)).not.toContain('pay online');
    }
  });

  it('draws no link that is not https, and no code that is not one', () => {
    expect(payUrlOf(URL_TO_PAY)).toBe(URL_TO_PAY);
    for (const bad of ['http://pay.crumbandco.test/pay/x', 'javascript:alert(1)', 'https://x.test/a b', 'https://x.test/"><script>', 42, null]) expect(payUrlOf(bad), String(bad)).toBe('');
    expect(payQrOf(QR)).toEqual({ modules: MODULES, png: QR.png });
    expect(payQrOf({ ...QR, modules: MODULES.slice(1) })).toBeNull();
    expect(payQrOf({ ...QR, modules: MODULES.map((row) => row.replace('0', '2')) })).toBeNull();
    expect(payQrOf({ ...QR, png: 'data:image/svg+xml;base64,PHN2Zz4=' })).toBeNull();
    expect(payQrOf('a code')).toBeNull();
  });
});
