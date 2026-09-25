/**
 * `document-render@1` conformance for this add-on (34-T06).
 *
 * The suite comes from `@adminium/add-on-host/testing`, mirrored from the
 * contract package, so this file is a fixture and a call — which is the whole
 * point of 25 D4 asking for two implementations before a contract enters the
 * registry. If the shape only ever fitted the add-on it was designed around,
 * "a second provider is a copy of this one" would be a sentence in a plan.
 *
 * WHAT THIS IMPLEMENTATION DISAGREES WITH THE OTHER ONE ABOUT, and why that is
 * the value it adds: `formats: ['pdf']` where the invoices provider renders
 * HTML too, `paper: ['a4']` where that one draws three papers including an
 * 80 mm till roll, and `coverage: 'ascii'` where that one is `winansi`. All
 * three fields sit on the KIND rather than on the contract because these two
 * implementations disagreed about all three.
 */

import { isDocumentError } from '@adminium/add-on-host/contracts';
import { describeDocumentRenderer } from '@adminium/add-on-host/testing';
import { describe, expect, it } from 'vitest';

import { MAX_LABELS } from './geometry.ts';
import provider from './server.ts';

const SUBJECT = {
  // A pinned clock in the subject, which is the only clock a provider may
  // read. Two renders being byte-identical means nothing if the fixture's
  // `now` came from `Date.now()` — the two calls are microseconds apart.
  now: { iso: '2026-09-10T09:15:00.000Z', timezone: 'Europe/Lisbon' },
  locale: 'en-US',
  currency: 'EUR',
  business: { name: 'Northwind Works', lines: ['18 Harbour Road', 'Lisbon'] },
  entity: {
    connectionId: 'conn_1',
    table: 'public.parts',
    pk: { id: 84 },
    label: 'Zinc tray',
  },
  number: null,
  fields: {
    sku: 'part-84',
    symbology: 'ean13',
    // A real EAN-13 with a correct check digit: `codeRefusal` is run over it,
    // so a made-up thirteen digits would be refused INVALID_SUBJECT and every
    // render assertion below would fail for the wrong reason.
    code: '5901234123457',
    entity: 'part',
    reference: 'zinc-tray',
    count: 12,
    on: '2026-09-10',
  },
  collections: {},
};

describeDocumentRenderer(provider, {
  settings: {},
  subject: () => SUBJECT,
  /*
   * `reference` and not the first text slot, which is `sku`. The row key is a
   * lookup and appears nowhere on the sheet, so a suite pushing `é` into it
   * would watch this provider render happily and conclude — correctly, about
   * the wrong field — that a `coverage: 'ascii'` kind had drawn an accent.
   * `code` would be worse: it is validated, so the refusal that came back
   * would be a check digit's, not the writer's.
   */
  textSlot: () => 'reference',
});

describe('the label-sheet provider refuses what it cannot draw', () => {
  it('names the glyph and writes no sheet at all (34 D6)', async () => {
    const outcome = await provider.render({
      kind: 'label-sheet',
      subject: { ...SUBJECT, fields: { ...SUBJECT.fields, reference: 'zinc-tráy' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });

    /*
     * `isDocumentError`, not `Array.isArray`. TypeScript does not narrow a
     * union through `Array.isArray` when the array side is `readonly` — the
     * guard returns `arg is any[]`, which a `readonly RenderedDocument[]` is
     * not — so the negative branch stays the whole union and every property
     * access below is an error. That is the entire reason the contract ships
     * a narrowing helper rather than leaving callers to write the check.
     */
    expect(isDocumentError(outcome)).toBe(true);
    if (!isDocumentError(outcome)) return;
    expect(outcome.code).toBe('LATIN_ONLY');
    expect(outcome.dropped).toEqual(['á']);
    // The point of the refusal: `renderLabelSheet` would have returned a sheet
    // reading `zinc-try`, which scans, prints, and is wrong.
    expect(outcome).not.toHaveProperty('bytes');
  });

  it('lists each undrawable glyph once, however many times it occurs', async () => {
    const outcome = await provider.render({
      kind: 'label-sheet',
      subject: { ...SUBJECT, fields: { ...SUBJECT.fields, reference: 'ééß' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.dropped).toEqual(['é', 'ß']);
  });

  it('refuses a number that is not a code it draws, before anything is drawn', async () => {
    const outcome = await provider.render({
      kind: 'label-sheet',
      // Thirteen digits with the wrong check digit — the failure a shop
      // actually makes, and one a sheet would happily print unscannably.
      subject: { ...SUBJECT, fields: { ...SUBJECT.fields, code: '5901234123456' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('INVALID_SUBJECT');
    expect(outcome.detail).toContain('ean13Check');
  });

  it('refuses a symbology it has never heard of rather than guessing one', async () => {
    const outcome = await provider.render({
      kind: 'label-sheet',
      subject: { ...SUBJECT, fields: { ...SUBJECT.fields, symbology: 'qr' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('INVALID_SUBJECT');
    expect(outcome.detail).toContain('symbology');
  });

  it('refuses a symbology it has been given and does not know, even though it could read one', async () => {
    // Only an ABSENT symbology is read from the number; a wrong one given is
    // still a mapping somebody should fix.
    const outcome = await provider.render({
      kind: 'label-sheet',
      subject: { ...SUBJECT, fields: { ...SUBJECT.fields, symbology: 'upc' } },
      formats: ['pdf'],
      paper: 'a4',
      settings: {},
    });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('INVALID_SUBJECT');
  });
});

/**
 * SHELF LABELS FROM A HOST'S OWN COLUMN.
 *
 * A till keeps its product numbers on the menu item (`menu_items.barcode`), not
 * in this add-on's list, and has no column saying which symbology each is. Its
 * document profile maps the columns it has — the row's key, the number, the
 * item's name — and the sheet is drawn from those alone.
 */
describe('a label sheet mapped from a host’s barcode column', () => {
  const shelf = (code: string) => ({
    ...SUBJECT,
    fields: { sku: 'menu-item-12', code, reference: 'Oat flat white' },
  });

  it('reads thirteen digits as EAN-13, and draws it', async () => {
    const outcome = await provider.render({ kind: 'label-sheet', subject: shelf('5901234123457'), formats: ['pdf'], paper: 'a4', settings: {} });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(outcome).toHaveLength(1);
    expect(outcome[0]!.filename).toBe('labels-5901234123457.pdf');
    expect(new TextDecoder('latin1').decode(outcome[0]!.bytes)).toContain('(Oat flat white)');
  });

  it('still checks the check digit of a number it read as EAN-13', async () => {
    const outcome = await provider.render({ kind: 'label-sheet', subject: shelf('5901234123456'), formats: ['pdf'], paper: 'a4', settings: {} });
    if (!isDocumentError(outcome)) throw new Error('expected a refusal');
    expect(outcome.code).toBe('INVALID_SUBJECT');
    expect(outcome.detail).toContain('ean13Check');
  });

  it('reads anything else as Code 128', async () => {
    const outcome = await provider.render({ kind: 'label-sheet', subject: shelf('CAF-0012'), formats: ['pdf'], paper: 'a4', settings: {} });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    expect(outcome[0]!.filename).toBe('labels-CAF-0012.pdf');
  });

  it('asks for the number, and for nothing a till does not keep', () => {
    const required = provider
      .describe('label-sheet')
      .slots.filter((slot) => slot.required && slot.default === undefined)
      .map((slot) => slot.id);
    expect(required).toEqual(['sku', 'code', 'reference']);
  });
});

/*
 * How many labels a request asks for. A till's row keeps no count, so the slot
 * is left unmapped and filled — when it is filled at all — by the request that
 * asked for the sheet. Unfilled it is one label; anything it holds is read as
 * a whole number and kept between one and ten sheets' worth.
 */
describe('how many labels a sheet carries', () => {
  const drawn = async (count: unknown) => {
    const fields: Record<string, unknown> = { sku: 'menu-item-12', code: '5901234123457', reference: 'Oat flat white' };
    if (count !== undefined) fields.count = count;
    const outcome = await provider.render({ kind: 'label-sheet', subject: { ...SUBJECT, fields }, formats: ['pdf'], paper: 'a4', settings: {} });
    if (isDocumentError(outcome)) throw new Error(JSON.stringify(outcome));
    const text = new TextDecoder('latin1').decode(outcome[0]!.bytes);
    return {
      labels: text.split('(Oat flat white)').length - 1,
      sheets: (text.match(/\/Type\/Page\//g) ?? []).length,
    };
  };

  it('offers an optional count, explained in all eight languages, that nothing has to map', () => {
    const slot = provider.describe('label-sheet').slots.find((entry) => entry.id === 'count')!;
    expect(slot).toMatchObject({ type: 'number', required: false });
    expect(slot.default).toBeUndefined();
    for (const locale of ['en-US', 'de-DE', 'fr-FR', 'cs-CZ', 'da-DK', 'zh-CN', 'zh-TW', 'ar-EG'] as const) {
      expect(slot.help?.[locale], locale).toContain(String(MAX_LABELS));
    }
  });

  it('draws one label when nothing fills the count', async () => {
    expect(await drawn(undefined)).toEqual({ labels: 1, sheets: 1 });
    expect(await drawn(null)).toEqual({ labels: 1, sheets: 1 });
  });

  it('draws the number a request asks for, over as many sheets as it takes', async () => {
    expect(await drawn(30)).toEqual({ labels: 30, sheets: 2 });
    // A request's value may arrive as text.
    expect(await drawn('24')).toEqual({ labels: 24, sheets: 1 });
    expect(await drawn(2.9)).toEqual({ labels: 2, sheets: 1 });
  });

  it('keeps the count between one label and ten sheets', async () => {
    expect(await drawn(0)).toEqual({ labels: 1, sheets: 1 });
    expect(await drawn(-5)).toEqual({ labels: 1, sheets: 1 });
    expect(await drawn('many')).toEqual({ labels: 1, sheets: 1 });
    expect(await drawn(1_000_000)).toEqual({ labels: MAX_LABELS, sheets: 10 });
  });
});
