/**
 * Documents that use none of the newer values draw to the SAME BYTES they
 * drew before those values existed.
 *
 * A line's day, the names under it, an invoice's period of service and its
 * reference each print only when a document carries them, and the item table
 * of the PDF was widened to take a column of days. Neither may move a single
 * byte of a document that carries none of them — an invoice already sent, a
 * till's receipt already printed, must come out the same when drawn again.
 *
 * So every fixture below is drawn in every language, on every paper, with and
 * without the payments list, as HTML and as PDF, and the bytes of each are
 * folded into one digest per fixture. The digests were taken from release
 * 1.0.5, before the change. A difference here is a changed document: find
 * out why before touching a digest.
 */

import { createHash } from 'node:crypto';

import { isDocumentError, type DocumentSubject } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import provider from '../server.ts';

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'];
const PAPERS = ['a4', 'letter', 'receipt-80mm'] as const;
const NOW = { iso: '2026-07-31T09:15:00.000Z', timezone: 'Europe/London' };
const BUSINESS = { name: 'Outline Studio', lines: ['12 Bell Street', 'Leeds LS1 4AB'], taxNumber: 'GB 123 4567 89', paymentInstructions: 'Bank transfer to Outline Studio\nSort code 12-34-56 · Account 12345678', footer: 'Thank you for working with us.' };
type F = Record<string, unknown>;
const inv = (fields: F = {}, collections: Record<string, F[]> = {}): DocumentSubject => ({ now: NOW, locale: 'en-US', currency: 'EUR', business: BUSINESS as DocumentSubject['business'], entity: null, number: 'INV-0042',
  fields: { customerName: 'Hearth & Loaf', customerContact: 'Amara Okafor', customerLines: ['3 Mill Lane', 'York YO1 7HH'], customerTaxNumber: 'GB 987 6543 21', title: 'Bakehouse rebrand — stage one', issuedAt: '2026-07-12', dueAt: '2026-07-26', terms: 'net14', currency: 'EUR', taxName: 'VAT', taxRate: 2000, subtotal: 109_900, tax: 21_980, total: 131_880, paid: 50_000, balance: 81_880, status: 'sent', ...fields },
  collections: { items: [ { desc: 'Brand strategy', qty: 1, rate: 60_000, discountKind: 'amount', discount: 0, amount: 60_000 }, { desc: 'Logo suite', qty: 2, rate: 25_000, discountKind: 'amount', discount: 1, amount: 49_900 } ],
    payments: [ { number: 'REC-0018', paidOn: '2026-07-20', method: 'bank-transfer', amount: 50_000, voided: 'false' }, { number: 'REC-0019', paidOn: '2026-07-21', method: 'card', amount: 9_999, voided: 'true' } ], ...collections } });
const rec = (fields: F = {}): DocumentSubject => ({ now: NOW, locale: 'en-US', currency: 'EUR', business: BUSINESS as DocumentSubject['business'], entity: null, number: 'REC-0018', fields: { issuedAt: '2026-07-20', currency: 'EUR', amount: 50_000, paidWith: 'bank-transfer', invoiceNumber: 'INV-0042', invoiceTotal: 131_880, balanceAfter: 81_880, voided: 'false', ...fields }, collections: {} });
const stmt = (): DocumentSubject => ({ now: NOW, locale: 'en-US', currency: 'EUR', business: BUSINESS as DocumentSubject['business'], entity: null, number: null,
  fields: { customerName: 'Hearth & Loaf', currency: 'EUR', issuedAt: '2026-07-31', periodFrom: '2026-01-01', periodTo: '2026-07-31', openingBalance: 20_000, documentsTotal: 131_880, paymentsTotal: 70_000, closingBalance: 81_880 },
  collections: { entries: [ { date: '2026-07-12', kind: 'document', number: 'INV-0042', amount: 131_880, balance: 151_880 }, { date: '2026-07-15', kind: 'payment', number: 'REC-0017', amount: 20_000, balance: 131_880 }, { date: '2026-07-20', kind: 'payment', number: 'REC-0018', amount: 50_000, balance: 81_880 } ] } });
const quote = (): DocumentSubject => ({ ...inv({ sentOn: '2026-07-01', validUntil: '2026-07-31', status: 'accepted', scope: ['Marks, a type pairing and signage.', 'Two rounds of changes.'], paymentSplit: ['50 % to start', '50 % on delivery'], signedName: 'Cleo Nkemdi', signedOn: '2026-07-05', termsVersion: 'v3', fingerprint: '9f2c4a7e11b0c3d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9', paid: null, balance: null }), number: 'QUO-0007' });
const visit = (fields: F = {}): DocumentSubject => ({ now: { iso: '2026-09-03T09:15:00.000Z', timezone: 'Europe/London' }, locale: 'en-US', currency: 'EUR', business: { name: 'Harbour Clinic', lines: ['1 Quay Street', 'Cork T12 X70A'] }, entity: null, number: '2',
  fields: { issuedAt: '2026-09-03', currency: 'EUR', amount: 8_500, paidWith: 'transfer', customerName: 'Tom Hale', title: 'Follow-up visit', serviceDate: '2026-08-28', attendedBy: 'Dr Rana Aziz', reference: 'AXA-7731-22', ...fields }, collections: {} });
const sale = (fields: F = {}): DocumentSubject => ({ now: { iso: '2026-09-03T09:15:00.000Z', timezone: 'Europe/London' }, locale: 'en-US', currency: 'USD', business: { name: 'Daybreak Coffee', lines: ['9 Front Street'] }, entity: null, number: 'T-1042',
  fields: { issuedAt: '2026-09-03', currency: 'USD', paidWith: 'card', subtotal: 1_690, tax: 125, total: 1_646, tip: 300, amount: 1_946, ...fields },
  collections: { items: [ { desc: 'Flat white', qty: 2, rate: 450, amount: 900 }, { desc: 'Almond croissant', qty: 1, rate: 790, amount: 790 } ] } });
const handMapped = (): DocumentSubject => ({ ...inv(), fields: { customerName: 'Somebody', issuedAt: '2026-07-12', taxRate: 2000 }, collections: { items: [{ desc: 'One', qty: 1, rate: 1000 }, { desc: 'Two', qty: 3, rate: 250 }] } });

const CASES: [string, string, DocumentSubject][] = [
  ['invoice', 'invoice', inv()],
  ['invoice-void', 'invoice', inv({ status: 'void', voidedOn: '2026-07-30' })],
  ['invoice-jpy', 'invoice', inv({ currency: 'JPY', subtotal: 4049, tax: 324, total: 4373, taxRate: 800, paid: null, balance: 4373 }, { items: [ { desc: 'Three hours, a rate off', qty: 3, rate: 1200, discountKind: 'percent', discount: 12.5, amount: 3150 }, { desc: 'One piece', qty: 1, rate: 999, discountKind: 'amount', discount: 100, amount: 899 } ], payments: [] })],
  ['invoice-inr', 'invoice', inv({ currency: 'INR' })],
  ['invoice-hand', 'invoice', handMapped()],
  ['credit-note', 'credit-note', { ...inv({ references: 'INV-0041' }), number: 'CN-0003' }],
  ['credit-note-hand', 'credit-note', handMapped()],
  ['receipt-payment', 'receipt', rec()],
  ['receipt-void', 'receipt', rec({ voided: 'true', voidedOn: '2026-07-22' })],
  ['statement', 'statement', stmt()],
  ['quote', 'quote', quote()],
  ['visit', 'receipt', visit()],
  ['visit-none', 'receipt', visit({ serviceDate: null, attendedBy: '', reference: undefined })],
  ['sale', 'receipt', sale()],
  ['sale-even', 'receipt', sale({ total: 1_815, amount: 2_115 })],
  ['receipt-hand-lines', 'receipt', { ...handMapped(), number: '7' }],
];

/** One digest per fixture, over every drawing of it — taken from release 1.0.5. */
const DIGESTS: Readonly<Record<string, string>> = {
  'invoice': '4fb6eaa0c0a9d94dc6c582bf67c4ea8fff192e35196b0bb01e646ff168cf8584',
  'invoice-void': '8ecb957c5e93277310753a35ce7974975463f13e8f53d46ce4688789b3138e2f',
  'invoice-jpy': '11870c86368eb434752bb20968ea21ae71f325d41aedee32f3d77812ba85e303',
  'invoice-inr': 'a04b9b8d9d23ae777e3fc9ebeca261101eba96e3e108e10638fbbe072d4e25c3',
  'invoice-hand': '86b6c80eabaefefb6da3f7cb16682aa27d1811cc4dae793cfc305f7f8a511daf',
  'credit-note': '7a69a26a7f2d8ab7cbef1756c4ff54db6f48a2b85cd582e0d40b7be89317498b',
  'credit-note-hand': '1552abecc5730b0f8de33f9529748ac6dd28b6557b94274eb77115f2c03323a8',
  'receipt-payment': 'e5211f3afb469944f9d594cd0d1e978cb57304387e9273e08c534614ca5919b9',
  'receipt-void': '5aebb343f064ef7bd6a94b052bf22b1e4e21204b2c115ee2df8fb2fe36836dbd',
  'statement': '9f03077bc33e1c5509f92313b97287afad973697487c39b569d6c659b74ee5e8',
  'quote': 'fc18c24240951eea11f716e38b02cf7b822a2ae5b50fc9e690f797558c989106',
  'visit': 'f3e50d9cb5aee069b78365bc5ff1a1f55d603a8c0ed4cc6fa95950ed42f5d69f',
  'visit-none': 'd97422e7156862e006dec396eb86f1eb7a50140015d68149415b55b4964a1fba',
  'sale': 'a2a46b4c8bac5c466fcd5e975c2e01c0f57718c6a12c5828b5561f47edaf2d2f',
  'sale-even': 'e4d678ff1f96b4d9783a424c769f363dd9313888c0cfa6e61fafb806eaea8a41',
  'receipt-hand-lines': 'ec6e11917fa6ed4fb0d5af0fa0358e01d57afa1cb1253323bb11d686f5bcdab7',
};

describe('a document that uses none of the newer values', () => {
  it.each(CASES.map(([name]) => name))('draws %s to the bytes it drew before', async (name) => {
    const [, kind, subject] = CASES.find(([entry]) => entry === name)!;
    const lines: string[] = [];
    for (const locale of LOCALES) {
      for (const paper of PAPERS) {
        for (const settings of [{ tax_name: 'VAT' }, { show_payment_ledger: false }]) {
          const outcome = await provider.render({ kind, subject: { ...subject, locale }, formats: ['html', 'pdf'], paper, settings });
          const key = `${name} ${kind} ${locale} ${paper} ${JSON.stringify(settings)}`;
          if (isDocumentError(outcome)) {
            lines.push(`${key} error ${outcome.code}`);
            continue;
          }
          for (const drawn of outcome) lines.push(`${key} ${drawn.format} ${createHash('sha256').update(drawn.bytes).digest('hex')}`);
        }
      }
    }
    const digest = createHash('sha256');
    for (const line of lines.sort()) digest.update(`${line}\n`);
    expect(digest.digest('hex')).toBe(DIGESTS[name]);
  });
});
