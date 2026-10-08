/**
 * THE CONTRACT'S OWN CHECKS OVER WHAT OFFERS PRINTS, and what the shared
 * suite does not look at: what a first print says and what a later one says,
 * how a code is grouped, and that it reads left to right on an Arabic card.
 */
import { isDocumentError, type DocumentSubject, type RenderedDocument } from '@adminium/add-on-contracts';
import { describeDocumentRenderer } from '@adminium/add-on-contracts/testing';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import provider from './documents.ts';
import { groupedCode } from './documents/render.ts';

const NOW = { iso: '2026-10-01T10:00:00.000Z', timezone: 'Europe/Lisbon' };
// A QR code as Adminium hands one: its text, its modules, and a picture of it.
const side = 21;
const QR = { text: 'GC-7K2MW3HNQ4XP', modules: Array.from({ length: side }, (_, row) => Array.from({ length: side }, (_, column) => ((row * 3 + column) % 2 === 0 ? '1' : '0')).join('')), png: 'data:image/png;base64,iVBORw0KGgo=' };
const subject = (fields: Record<string, unknown>, more: Partial<DocumentSubject> = {}): DocumentSubject => ({ now: NOW, locale: 'en-US', currency: 'USD', business: { name: 'Daybreak Coffee', lines: [] }, entity: { connectionId: 'c1', table: 'offers_gift_cards', pk: { id: 1 }, label: 'Q4XP' }, number: null, fields, collections: {}, ...more });
// Money reaches a provider in the currency's smallest unit, a whole number.
const CARD = { code: 'GC-7K2MW3HNQ4XP', qr: QR, amount: 1900, useBy: '2027-08-03', printedAt: NOW.iso };
const VOUCHER = { code: 'AAAABBBB7K2M', qr: { ...QR, text: 'AAAABBBB7K2M' }, name: '10 classes', worth: 'pack', value: null, usesLeft: 6, usesTotal: 10, useBy: null, printedAt: NOW.iso };

describeDocumentRenderer(provider, {
  settings: {},
  subject: (kind) => subject(kind.id.startsWith('gift-card') ? CARD : VOUCHER),
  // The name on a voucher; a card has no text of the place's own on it but its code.
  textSlot: (kind) => (kind.id.startsWith('gift-card') ? 'code' : 'name'),
});

const html = async (kind: string, fields: Record<string, unknown>, more: Partial<DocumentSubject> = {}, paper: 'a6' | 'receipt-80mm' = kind.endsWith('-strip') ? 'receipt-80mm' : 'a6'): Promise<string> => {
  const out = await provider.render({ kind, subject: subject(fields, more), formats: ['html'], paper, settings: {} });
  if (isDocumentError(out)) throw new Error(`refused: ${out.code} ${out.detail ?? ''}`);
  return new TextDecoder().decode((out[0] as RenderedDocument).bytes);
};

describe('what Offers prints', () => {
  it('is four kinds, HTML only, each on its own paper, and the manifest declares the same four', () => {
    expect(provider.kinds().map((kind) => `${kind.id} ${kind.formats.join(',')} ${kind.paper.join(',')} ${kind.coverage}`)).toEqual(['gift-card html a6 all', 'gift-card-strip html receipt-80mm all', 'voucher html a6 all', 'voucher-strip html receipt-80mm all']);
    const declared = manifest.documents as unknown as { kind: string; addOn: string; table: string; mapping: Record<string, { column: string }>; requestValues?: string[]; where?: unknown }[];
    expect(declared.map((one) => `${one.kind} ${one.addOn} ${one.table}`)).toEqual(['gift-card offers gift_cards', 'gift-card-strip offers gift_cards', 'voucher offers vouchers', 'voucher-strip offers vouchers']);
    for (const one of declared) {
      const slots = provider.describe(one.kind).slots;
      // Every slot the manifest fills is one the kind has; every slot it must have is filled, asked for, or Adminium's own.
      for (const id of Object.keys(one.mapping)) expect(slots.map((slot) => slot.id), `${one.kind}: ${id}`).toContain(id);
      for (const slot of slots.filter((candidate) => candidate.required)) expect(Object.keys(one.mapping), `${one.kind}: ${slot.id}`).toContain(slot.id);
      for (const asked of one.requestValues ?? []) expect(slots.map((slot) => slot.id)).toContain(asked);
    }
    // A credit has no code: no card is printed for one.
    expect(declared[0]).toMatchObject({ where: { column: 'kind', in: ['card'] }, requestValues: ['first'] });
    // The figure a card prints is what is on it, and the QR code is of the code as it is stored.
    expect(declared[0]!.mapping).toEqual({ code: { column: 'code' }, qr: { column: 'code' }, amount: { column: 'balance' }, useBy: { column: 'expires_on' } });
  });

  it('a first print shows the amount', async () => {
    const page = await html('gift-card', { ...CARD, first: '1' });
    expect(page).toContain('<div class="figure"><span dir="ltr">$19.00</span></div>');
    expect(page).not.toContain('Balance');
    // The amount comes in the currency's smallest unit: a currency with none is not divided.
    expect(await html('gift-card', { ...CARD, first: '1' }, { currency: 'JPY' })).toContain('<span dir="ltr">¥1,900</span>');
  });

  it('a re-print shows the balance and the day', async () => {
    const page = await html('gift-card', CARD);
    expect(page).toContain('Balance $19.00 on Oct 1, 2026');
    // Any value of `first` but the one the issue sends is a re-print.
    expect(await html('gift-card', { ...CARD, first: 'yes' })).toContain('Balance $19.00 on Oct 1, 2026');
    // The day is the venue's: a card printed late in the evening in Lisbon is printed that day.
    expect(await html('gift-card', { ...CARD, printedAt: '2026-10-01T23:30:00.000Z' }, { now: { iso: '2026-10-01T23:30:00.000Z', timezone: 'Europe/Lisbon' } })).toContain('on Oct 2, 2026');
    expect(await html('gift-card', { ...CARD, printedAt: '2026-10-01T23:30:00.000Z' }, { now: { iso: '2026-10-01T23:30:00.000Z', timezone: 'America/New_York' } })).toContain('on Oct 1, 2026');
  });

  it('two renders are the same bytes', async () => {
    for (const kind of provider.kinds()) {
      const fields = kind.id.startsWith('gift-card') ? CARD : VOUCHER;
      expect(await html(kind.id, fields), kind.id).toBe(await html(kind.id, fields));
    }
  });

  it('groups a code in fours behind its two letters: a card keeps them, a voucher is given them by its worth', async () => {
    expect(groupedCode('GC-7K2MW3HNQ4XP', 'GC')).toBe('GC-7K2M-W3HN-Q4XP');
    expect(groupedCode('gc7k2mw3hnq4xp', 'GC')).toBe('GC-7K2M-W3HN-Q4XP');
    expect(groupedCode('AAAABBBB7K2M', 'VC')).toBe('VC-AAAA-BBBB-7K2M');
    // Twelve characters that happen to begin with the letters are all code.
    expect(groupedCode('GCAABBBB7K2M', 'GC')).toBe('GC-GCAA-BBBB-7K2M');
    expect(await html('gift-card', CARD)).toContain('<div class="code" dir="ltr">GC-7K2M-W3HN-Q4XP</div>');
    expect(await html('voucher', VOUCHER)).toContain('>PK-AAAA-BBBB-7K2M<');
    expect(await html('voucher', { ...VOUCHER, worth: 'amount', value: '5.000', usesTotal: 1, usesLeft: 1 })).toContain('>VC-AAAA-BBBB-7K2M<');
  });

  it('the code is drawn left-to-right in an Arabic card, and the page itself right to left', async () => {
    const page = await html('gift-card', CARD, { locale: 'ar-EG' });
    expect(page).toContain('<html lang="ar-EG" dir="rtl">');
    expect(page).toContain('<div class="code" dir="ltr">GC-7K2M-W3HN-Q4XP</div>');
    expect(page).toContain('بطاقة هدية');
    expect(page).toMatch(/<div class="figure"><span dir="ltr">[^<]+<\/span><\/div>/);
  });

  it('the strip is 80 mm wide, the card A6, and neither is drawn on the other\'s paper', async () => {
    expect(await html('gift-card-strip', CARD)).toContain('@page { size: 80mm auto;');
    expect(await html('gift-card', CARD)).toContain('@page { size: A6;');
    const wrong = await provider.render({ kind: 'gift-card-strip', subject: subject(CARD), formats: ['html'], paper: 'a6', settings: {} });
    expect(isDocumentError(wrong) && wrong.code).toBe('INVALID_SUBJECT');
  });

  it('a voucher says what it is: an amount, a percent, or the uses a pack has left', async () => {
    expect(await html('voucher', VOUCHER)).toContain('6 of 10 uses left');
    // A pack nobody has used yet has every use it was made with.
    expect(await html('voucher', { ...VOUCHER, usesLeft: null })).toContain('10 of 10 uses left');
    expect(await html('voucher', { ...VOUCHER, worth: 'amount', value: '5.000' })).toContain('>$5.00<');
    expect(await html('voucher', { ...VOUCHER, worth: 'percent', value: '12.500' })).toContain('12.5% off');
    expect(await html('voucher', { ...VOUCHER, useBy: '2026-11-30' })).toContain('Use it by Nov 30, 2026');
    expect(await html('voucher', VOUCHER)).not.toContain('Use it by');
  });

  it('draws the QR code it was handed, writes what a person typed as text, and refuses a card with no code', async () => {
    expect(await html('gift-card', CARD)).toContain(`<img class="qr" alt="" src="${QR.png}">`);
    expect(await html('gift-card', { ...CARD, qr: undefined })).not.toContain('<img');
    const named = await html('voucher', { ...VOUCHER, name: '<b>Tea & cake</b>' }, { business: { name: 'Bread "n" Butter', lines: [] } });
    expect(named).toContain('&lt;b&gt;Tea &amp; cake&lt;/b&gt;');
    expect(named).toContain('Bread &quot;n&quot; Butter');
    expect(named).not.toContain('<b>');
    const none = await provider.render({ kind: 'gift-card', subject: subject({ ...CARD, code: '' }), formats: ['html'], paper: 'a6', settings: {} });
    expect(isDocumentError(none) && `${none.code} ${String(none.detail)}`).toBe('MISSING_SLOT code');
    const unknown = await provider.render({ kind: 'coupon', subject: subject(CARD), formats: ['html'], paper: 'a6', settings: {} });
    expect(isDocumentError(unknown) && unknown.code).toBe('UNSUPPORTED_KIND');
  });
});
