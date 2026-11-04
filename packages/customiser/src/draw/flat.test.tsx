/**
 * A DESIGN LAID OUT FLAT, HELD TO WHERE THINGS GO.
 *
 * The sheet is what every picture of a design is drawn from: the editor's
 * stage, the proof, the print file, the laser's file. So these hold the
 * layout itself — a page's words hang from the top of their box, a piece's
 * sit in its middle, a logo sits at its size and nudge, a part left plain is
 * nothing on what is made — and that the editor's drawing puts every line on
 * the sheet's own baseline.
 */
// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { readCatalogue, type Catalogue } from '../browser/catalogue.ts';
import { stubApi } from '../browser/testing/stub.ts';
import { Drawing } from '../browser/ui/Drawing.tsx';
import { SharedContext, sharedFor } from '../browser/ui/context.tsx';
import { BASELINE, flatSheet, LINE_STEP, placeLines, sheetView, sidesMade, type FlatItem } from './flat.ts';
import type { DesignData } from '../browser/api.ts';

const LABELS = { logo: 'Your logo', photo: 'Your photo' };

async function catalogueOf(app: 'maker' | 'printing', base: 'cards' | 'coasters' | 'keyring'): Promise<{ catalogue: Catalogue; stub: ReturnType<typeof stubApi> }> {
  const stub = stubApi(app);
  const id = stub.ids[base];
  const catalogue = readCatalogue(await stub.api.catalogue(id), id);
  if (catalogue === null) throw new Error(`no catalogue for ${base}`);
  return { catalogue, stub };
}

const designOf = (stub: ReturnType<typeof stubApi>, code: string): DesignData => {
  const row = stub.tables['designs']!.find((one) => one['code'] === code)!;
  return { base_id: row['base_id'] as number, ready_design_id: row['ready_design_id'] as number, values: structuredClone(row['values']) as DesignData['values'] };
};
const textOf = (items: readonly FlatItem[], code: string) => {
  const found = items.find((one) => one.code === code);
  if (found?.kind !== 'text') throw new Error(`${code} is no text`);
  return found;
};

afterEach(cleanup);

describe('a page', () => {
  it('lays out both sides of Harbour Bakery’s cards, the words hanging from the top of their boxes', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const design = designOf(stub, 'MP4112C8G2S6E4WB');
    expect(sidesMade(catalogue, design)).toEqual(['front', 'back']);
    const front = flatSheet(catalogue, design, { side: 'front', empty: 'hide', labels: LABELS });
    expect(front.face).toMatchObject({ kind: 'page', width: 85, height: 55, bleed: 3, safe: 4 });
    const name = textOf(front.items, 'name');
    expect(name.lines.map((one) => one.text)).toEqual(['Nell Fairweather']);
    expect(name.lines[0]!.y).toBeCloseTo(name.box.y + name.sizeMm * BASELINE, 6);
    const back = flatSheet(catalogue, design, { side: 'back', empty: 'hide', labels: LABELS });
    const address = textOf(back.items, 'addr');
    expect(address.lines.map((one) => one.text)).toEqual(['12 Quay Street', 'Marlow SL7 1BT']);
    expect(address.lines[1]!.y - address.lines[0]!.y).toBeCloseTo(address.sizeMm * LINE_STEP, 6);
  });

  it('draws the logo it holds in its box, and says a box holds one when the page has no file for it', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const design = designOf(stub, 'MP4112C8G2S6E4WB');
    const held = flatSheet(catalogue, design, { side: 'front', empty: 'hide', labels: LABELS, holds: (column) => column === 'logo_file' });
    const logo = held.items.find((one) => one.code === 'logo');
    expect(logo?.kind).toBe('picture');
    if (logo?.kind === 'picture') expect(logo.drawn).toEqual(logo.box);
    const without = flatSheet(catalogue, design, { side: 'front', empty: 'hide', labels: LABELS });
    expect(without.items.find((one) => one.code === 'logo')).toMatchObject({ kind: 'slot', label: 'Your logo ✓', filled: true });
  });

  it('shows the bleed round the trim only with the guides', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const sheet = flatSheet(catalogue, designOf(stub, 'MP4112C8G2S6E4WB'), { labels: LABELS });
    expect(sheetView(sheet.face, false)).toEqual({ x: 0, y: 0, w: 85, h: 55 });
    expect(sheetView(sheet.face, true)).toEqual({ x: -3, y: -3, w: 91, h: 61 });
  });
});

describe('a page made in the full editor', () => {
  it('lays out the parts the customer placed, back to front, and nothing of the form', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const design = designOf(stub, 'MP4112C8G2S6E4WB');
    design.values = { ...design.values, parts: {}, placed: [
      { id: 's1', side: 'front', kind: 'rect', x: -3, y: -3, w: 91, h: 20, colour: '#c8a35a' },
      { id: 't1', side: 'front', kind: 'text', x: 6, y: 30, w: 70, h: 6, text: 'Fresh every morning', font: 'Manrope', size: 12, weight: 700, align: 'center', colour: 'accent' },
      { id: 'i1', side: 'front', kind: 'image', x: 60, y: 4, w: 20, h: 20, file: 'logo_file', fit: 'fill' },
      { id: 't2', side: 'back', kind: 'text', x: 6, y: 6, w: 70, h: 6, text: 'Back words', size: 9 },
    ] };
    const sheet = flatSheet(catalogue, design, { side: 'front', empty: 'hide', labels: { ...LABELS, image: 'Image' }, holds: () => true });
    expect(sheet.items.map((one) => [one.code, one.kind])).toEqual([['s1', 'shape'], ['t1', 'text'], ['i1', 'picture']]);
    const words = textOf(sheet.items, 't1');
    const size = 12 * (25.4 / 72);
    expect(words).toMatchObject({ anchor: 'middle', weight: 700, sizeMm: size });
    expect(words.lines[0]).toMatchObject({ text: 'Fresh every morning', x: 41 });
    expect(words.lines[0]!.y).toBeCloseTo(30 + size * BASELINE, 6);
    expect(sheet.items[0]).toMatchObject({ fill: '#c8a35a' });
    expect(sheet.items[2]).toMatchObject({ column: 'logo_file', fill: true, drawn: { x: 60, y: 4, w: 20, h: 20 } });
    const unheld = flatSheet(catalogue, design, { side: 'front', empty: 'hide', labels: { ...LABELS, image: 'Image' } });
    expect(unheld.items[2]).toMatchObject({ kind: 'slot', label: 'Image' });
  });
});

describe('a piece', () => {
  it('sets the words in the middle of their box, in the wood’s engraving colour', async () => {
    const { catalogue, stub } = await catalogueOf('maker', 'coasters');
    const design = designOf(stub, 'BR2290H5F3P9V8YA');
    const sheet = flatSheet(catalogue, design, { empty: 'hide', labels: LABELS });
    expect(sheet.face).toMatchObject({ kind: 'piece', width: 95, height: 95, colour: '#6b4428' });
    const words = textOf(sheet.items, 'words');
    expect(words.anchor).toBe('middle');
    expect(words.lines[0]!.x).toBeCloseTo(words.box.x + words.box.w / 2, 6);
    // One line: its block (one size high) is centred, the baseline 0.82 of a size below the block's top.
    expect(words.lines[0]!.y).toBeCloseTo(words.box.y + words.box.h / 2 - words.sizeMm / 2 + words.sizeMm * BASELINE, 6);
    expect(words.colour).toBe('#24130a');
  });

  it('puts a logo at its size in its box and nudged where the customer put it', async () => {
    const { catalogue, stub } = await catalogueOf('maker', 'coasters');
    const design = designOf(stub, 'BR2290H5F3P9V8YA');
    design.values.parts['logo'] = { file: 'logo_file', scale: 50, nx: 2, ny: -1 };
    const sheet = flatSheet(catalogue, design, { empty: 'hide', labels: LABELS, holds: () => true });
    const logo = sheet.items.find((one) => one.code === 'logo');
    if (logo?.kind !== 'picture') throw new Error('no picture');
    expect(logo.drawn.w).toBeCloseTo(logo.box.w / 2, 6);
    expect(logo.drawn.x).toBeCloseTo(logo.box.x + logo.box.w / 4 + 2, 6);
    expect(logo.drawn.y).toBeCloseTo(logo.box.y + logo.box.h / 4 - 1, 6);
  });

  it('colours a printed item with the plastic its colour part chose', async () => {
    const { catalogue, stub } = await catalogueOf('maker', 'keyring');
    const sheet = flatSheet(catalogue, designOf(stub, 'BR2289R4W8N2T6JC'), { empty: 'hide', labels: LABELS });
    const amber = Object.values(catalogue.shared).flat().find((one) => one.code === 'amber')!;
    expect(sheet.face.colour).toBe(amber.hex);
    expect(textOf(sheet.items, 'name').lines[0]!.text).toBe('SAM');
  });
});

describe('a part left empty', () => {
  it('shows its example words on a card, dims them on the stage, and leaves them off what is made', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const design = designOf(stub, 'MP4112C8G2S6E4WB');
    delete design.values.parts['title'];
    const sample = textOf(flatSheet(catalogue, design, { empty: 'sample', labels: LABELS }).items, 'title');
    expect(sample.dim).toBe(false);
    expect(textOf(flatSheet(catalogue, design, { empty: 'dim', labels: LABELS }).items, 'title').dim).toBe(true);
    expect(flatSheet(catalogue, design, { empty: 'hide', labels: LABELS }).items.some((one) => one.code === 'title')).toBe(false);
  });
});

describe('lines of words', () => {
  it('anchor where the part aligns them on a page, and always in the middle on a piece', () => {
    const box = { x: 10, y: 20, w: 40, h: 10 };
    expect(placeLines(['a'], box, 4, 'end', true)).toMatchObject({ anchor: 'end', lines: [{ x: 50 }] });
    expect(placeLines(['a'], box, 4, 'start', false)).toMatchObject({ anchor: 'middle', lines: [{ x: 30 }] });
  });
});

describe('the editor’s drawing', () => {
  it('puts every line where the sheet puts it, and draws a held logo from its file as a picture', async () => {
    const { catalogue, stub } = await catalogueOf('printing', 'cards');
    const design = designOf(stub, 'MP4112C8G2S6E4WB');
    const shared = sharedFor('en-US', 'print', 'Marlow Press');
    const { container } = render(
      <SharedContext.Provider value={shared}>
        <Drawing catalogue={catalogue} design={design} side="back" empty="hide" pictures={{ logo_file: { id: 'up_1', name: 'loaf.svg', size: 1200, kind: 'svg', url: 'blob:logo', fresh: true } }} />
      </SharedContext.Provider>,
    );
    const sheet = flatSheet(catalogue, design, { side: 'back', empty: 'hide', labels: LABELS, holds: () => true });
    const lines = sheet.items.flatMap((one) => (one.kind === 'text' ? one.lines : []));
    const spans = [...container.querySelectorAll('tspan')].map((one) => ({ text: one.textContent, x: Number(one.getAttribute('x')), y: Number(one.getAttribute('y')) }));
    expect(spans).toEqual(lines.map((one) => ({ text: one.text, x: one.x, y: one.y })));
    const front = render(
      <SharedContext.Provider value={shared}>
        <Drawing catalogue={catalogue} design={design} side="front" empty="hide" pictures={{ logo_file: { id: 'up_1', name: 'loaf.svg', size: 1200, kind: 'svg', url: 'blob:logo', fresh: true } }} />
      </SharedContext.Provider>,
    );
    expect(front.container.querySelector('image')?.getAttribute('href')).toBe('blob:logo');
    // Never the picture's markup in the page.
    expect(front.container.querySelectorAll('svg svg')).toHaveLength(0);
  });
});
