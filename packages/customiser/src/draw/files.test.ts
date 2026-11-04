// @vitest-environment happy-dom
/**
 * THE PRODUCTION FILES, READ BACK.
 *
 * Made from the samples' ordered designs with a real font file (Manrope, the
 * dashboard's own WOFF2): Harbour Bakery's business cards as print PDFs and
 * a proof, Birch Row's coaster as a laser SVG. Each is read back the way the
 * press or the laser would: the PDF's page and its trim and bleed boxes, no
 * font in it; the SVG's layers, every word a path, nothing Adminium's
 * cleaner would refuse. And each word sits where the editor draws it.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { beforeAll, describe, expect, it } from 'vitest';

import type { DesignData } from '../browser/api.ts';
import { readCatalogue, type Catalogue } from '../browser/catalogue.ts';
import { stubApi } from '../browser/testing/stub.ts';
import { foreignParts } from '../testing/svg-rules.ts';
import { flatSheet, sheetsOf, type FlatItem } from './flat.ts';
import { fontAt, linePath, textPaths, type Font } from './outline.ts';
import { A4, FontMissing, MM, printPdf, printSize, proofPdf, type PdfAssets } from './pdf.ts';
import { engravedOf, layersOf, pieceSvg } from './svgfile.ts';
import { readSvg } from './svgread.ts';

const LABELS = { logo: 'Your logo', photo: 'Your photo' };
// The dashboard's own copy of Manrope (OFL-1.1), as its tokens package serves it.
const MANROPE = new Uint8Array(readFileSync(createRequire(import.meta.url).resolve('@adminium/tokens/fonts/manrope/manrope-latin-wght-normal.woff2')));
const fonts = new Map<number, Font>();
/** Every family the samples name, set in Manrope for the test: the press and the laser need only outlines. */
const font = (_family: string, weight: number): Font => {
  if (!fonts.has(weight)) fonts.set(weight, fontAt(MANROPE, weight)!);
  return fonts.get(weight)!;
};
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><g transform="translate(2 2)"><rect x="0" y="0" width="16" height="16" rx="3" fill="#c0562f"/><circle cx="28" cy="8" r="8" fill="none" stroke="#1f2a36" stroke-width="2"/></g><text x="0" y="19">Loaf</text></svg>`;

let cards: Catalogue;
let coasters: Catalogue;
let harbour: DesignData;
let pinfold: DesignData;
beforeAll(async () => {
  const print = stubApi('printing');
  cards = readCatalogue(await print.api.catalogue(print.ids.cards), print.ids.cards)!;
  const row = print.tables['designs']!.find((one) => one['code'] === 'MP4112C8G2S6E4WB')!;
  harbour = { base_id: row['base_id'] as number, ready_design_id: row['ready_design_id'] as number, values: structuredClone(row['values']) as DesignData['values'] };
  const maker = stubApi('maker');
  coasters = readCatalogue(await maker.api.catalogue(maker.ids.coasters), maker.ids.coasters)!;
  const coaster = maker.tables['designs']!.find((one) => one['code'] === 'BR2290H5F3P9V8YA')!;
  pinfold = { base_id: coaster['base_id'] as number, ready_design_id: coaster['ready_design_id'] as number, values: structuredClone(coaster['values']) as DesignData['values'] };
});

const assets = (): PdfAssets => ({ font, pictures: { logo_file: { kind: 'svg', svg: readSvg(LOGO)! } } });
const pageBox = (page: ReturnType<PDFDocument['getPage']>, name: 'TrimBox' | 'BleedBox' | 'MediaBox'): number[] => {
  const box = name === 'TrimBox' ? page.getTrimBox() : name === 'BleedBox' ? page.getBleedBox() : page.getMediaBox();
  return [box.x, box.y, box.width, box.height].map((one) => Math.round((one / MM) * 100) / 100);
};
/** Whether a page names no font at all (pdf-lib keeps an empty font list on every page). */
const noFonts = (page: ReturnType<PDFDocument['getPage']>): boolean => {
  const fonts = page.node.Resources()?.lookup(PDFName.of('Font'));
  return fonts === undefined || (fonts instanceof PDFDict && fonts.keys().length === 0);
};

/** The box a path's data reaches, from its numbers taken in pairs (a path of moves, lines and curves only). */
function reach(d: string): { x0: number; x1: number; y0: number; y1: number } {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const xs = n.filter((_v, i) => i % 2 === 0);
  const ys = n.filter((_v, i) => i % 2 === 1);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

describe('the print file of a side (MC-F1.print)', () => {
  it('is a 111 × 81 mm page for an 85 × 55 card: the trim at 13 mm in, the bleed 3 mm round it, no font in it', async () => {
    const sheets = sheetsOf(cards, harbour, { empty: 'hide', labels: LABELS, holds: () => true });
    expect(sheets.map((one) => one.side)).toEqual(['front', 'back']);
    for (const sheet of sheets) {
      const bytes = await printPdf(sheet, assets(), { font: font('Manrope', 400), text: `Harbour · ${sheet.side} · trim 85 x 55 mm, 3 mm bleed` });
      const doc = await PDFDocument.load(bytes);
      expect(doc.getPageCount()).toBe(1);
      const page = doc.getPage(0);
      expect(pageBox(page, 'MediaBox')).toEqual([0, 0, 111, 81]);
      expect(pageBox(page, 'TrimBox')).toEqual([13, 13, 85, 55]);
      expect(pageBox(page, 'BleedBox')).toEqual([10, 10, 91, 61]);
      // Words are outlines: the press needs no fonts.
      expect(noFonts(page)).toBe(true);
    }
    expect(printSize(sheets[0]!.face)).toEqual({ page: '111 × 81', trim: '85 × 55', bleed: '3' });
  });

  it('prints a page made in the full editor from the parts the customer placed', async () => {
    const placed: DesignData = { ...harbour, values: { ...harbour.values, parts: {}, placed: [{ id: 't1', side: 'front', kind: 'text', x: 6, y: 20, w: 70, h: 6, text: 'Fresh every morning', size: 12, weight: 700, colour: 'ink' }, { id: 'i1', side: 'front', kind: 'image', x: 60, y: 4, w: 20, h: 20, file: 'logo_file' }] } };
    const sheet = flatSheet(cards, placed, { empty: 'hide', labels: LABELS, holds: () => true });
    const doc = await PDFDocument.load(await printPdf(sheet, assets(), { font: null, text: '' }));
    expect(pageBox(doc.getPage(0), 'TrimBox')).toEqual([13, 13, 85, 55]);
    expect(noFonts(doc.getPage(0))).toBe(true);
  });

  it('is not made while a family the design sets words in has no font file, and says which', async () => {
    const sheet = flatSheet(cards, harbour, { empty: 'hide', labels: LABELS });
    await expect(printPdf(sheet, { font: () => null, pictures: {} }, { font: null, text: '' })).rejects.toBeInstanceOf(FontMissing);
  });
});

describe('the proof (MC-F1.proof)', () => {
  it('is one A4 page of both sides, with no font in it', async () => {
    const sheets = sheetsOf(cards, harbour, { empty: 'hide', labels: LABELS, holds: () => true });
    const bytes = await proofPdf(sheets, assets(), { title: 'Proof · Harbour · version 1', spec: 'Business cards, 85 × 55 mm, both sides', sides: { front: 'Front', back: 'Back' }, note: 'The red line is where it is cut.' }, font('Manrope', 700));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    const size = doc.getPage(0).getSize();
    expect([Math.round(size.width * 100) / 100, Math.round(size.height * 100) / 100]).toEqual([A4.w, A4.h]);
    expect(noFonts(doc.getPage(0))).toBe(true);
  });
});

describe('the laser’s file of a piece (BC-E2)', () => {
  const made = () => {
    const sheet = flatSheet(coasters, pinfold, { empty: 'hide', labels: LABELS, holds: () => true });
    const parts = engravedOf(sheet);
    const words = parts.words.flatMap((item) => textPaths(item, font(item.font, item.weight)));
    const input = { width: sheet.face.width, height: sheet.face.height, corner: sheet.face.corner, outline: null, words, logos: parts.pictures.map((item) => ({ item, svg: readSvg(LOGO)! })), lines: parts.lines };
    return { sheet, input, svg: pieceSvg(input) };
  };

  it('is the coaster at 95 × 95 mm, cut and engraved, every word a path and the logo a drawing', () => {
    const { svg, input } = made();
    expect(layersOf(input)).toEqual(['CUT', 'ENGRAVE']);
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = doc.documentElement;
    expect([root.getAttribute('width'), root.getAttribute('height'), root.getAttribute('viewBox')]).toEqual(['95mm', '95mm', '0 0 95 95']);
    expect([...root.children].filter((one) => one.localName === 'g').map((one) => one.getAttribute('id'))).toEqual(['CUT', 'ENGRAVE']);
    expect(doc.getElementById('CUT')!.getAttribute('stroke')).toBe('#ff0000');
    expect(doc.getElementById('CUT')!.querySelector('rect')!.getAttribute('rx')).toBe(String(coasters.base.corner));
    // No words are left as words, the logo's own word included.
    expect(doc.getElementsByTagName('text')).toHaveLength(0);
    expect(svg).not.toContain('Loaf');
    expect(doc.getElementById('ENGRAVE')!.querySelectorAll('path').length).toBeGreaterThan(2);
  });

  it('holds nothing Adminium’s cleaner would refuse or take out', () => {
    expect(foreignParts(made().svg)).toEqual([]);
    // The rules themselves catch what they should.
    expect(foreignParts('<svg xmlns="http://www.w3.org/2000/svg"><image href="x.png"/><text>Hi</text></svg>')).toEqual(['<image>', 'image@href']);
  });

  it('takes the cut and the score from the shop’s outline, by the layer named or the laser’s colour', () => {
    const outline = readSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 190 190"><g id="SCORE"><line x1="10" y1="95" x2="180" y2="95"/></g><circle cx="95" cy="95" r="90" fill="none" stroke="#ff0000"/></svg>')!;
    const { input } = made();
    const svg = pieceSvg({ ...input, outline });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect([...doc.documentElement.children].filter((one) => one.localName === 'g').map((one) => one.getAttribute('id'))).toEqual(['CUT', 'SCORE', 'ENGRAVE']);
    // The outline replaces the plain rectangle, scaled from its own 190 units to the coaster's 95 mm.
    expect(doc.getElementById('CUT')!.querySelector('rect')).toBeNull();
    expect(doc.getElementById('CUT')!.querySelector('path')!.getAttribute('transform')).toBe('matrix(0.5 0 0 0.5 0 0)');
    expect(foreignParts(svg)).toEqual([]);
  });
});

describe('one drawing, three places', () => {
  it('sets each word on the baseline and anchor the editor draws it on, in the file and the print', () => {
    const sheet = flatSheet(coasters, pinfold, { empty: 'hide', labels: LABELS });
    const words = sheet.items.find((one): one is Extract<FlatItem, { kind: 'text' }> => one.kind === 'text' && one.code === 'words')!;
    const line = words.lines[0]!;
    const path = textPaths(words, font(words.font, words.weight))[0]!;
    const box = reach(path);
    const { width } = linePath(font(words.font, words.weight), line.text, line.x, line.y, words.sizeMm, words.anchor);
    // Anchored in the middle as the editor's text-anchor is: as far either side of its x, give or take the glyphs' own margins.
    expect(Math.abs((box.x0 + box.x1) / 2 - line.x)).toBeLessThan(words.sizeMm * 0.2);
    expect(box.x1 - box.x0).toBeLessThanOrEqual(width + 0.01);
    // On its baseline: capitals stand on it, nothing but a descender goes below it.
    expect(box.y0).toBeLessThan(line.y - words.sizeMm * 0.5);
    expect(box.y1).toBeLessThan(line.y + words.sizeMm * 0.3);
  });
});
