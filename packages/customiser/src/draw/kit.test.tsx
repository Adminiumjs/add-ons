// @vitest-environment happy-dom
/**
 * A KIT'S DESIGN, PIECE BY PIECE (BC-B7b.pieces, BC-E2, BC-F10).
 *
 * Iris's book nook (the sample's ordered design): its pieces laid flat as
 * the comp's rows lay them; each piece's sheet carrying only the parts cut
 * on it, at the piece's own size; the sign board's sheet the sign's; and
 * the laser's files made one a piece, each from its own sheet, so the words
 * land inside the piece they are cut on.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { beforeAll, describe, expect, it } from 'vitest';

import type { DesignData } from '../browser/api.ts';
import { readCatalogue, type Catalogue } from '../browser/catalogue.ts';
import { stubApi } from '../browser/testing/stub.ts';
import { makeLaserFiles, pieceSheetFor, sheetsFor, type MakeWords } from '../panels/make.ts';
import { flatSheet } from './flat.ts';
import { carryingPieces, kitPieces, layPieces, onFace, onPiece } from './kit.ts';
import { fontAt, type Font } from './outline.ts';

const MANROPE = new Uint8Array(readFileSync(createRequire(import.meta.url).resolve('@adminium/tokens/fonts/manrope/manrope-latin-wght-normal.woff2')));
const fonts = new Map<number, Font>();
const font = (_family: string, weight: number): Font => {
  if (!fonts.has(weight)) fonts.set(weight, fontAt(MANROPE, weight)!);
  return fonts.get(weight)!;
};
const LABELS = { logo: 'Your logo', photo: 'Your photo' };
const WORDS: MakeWords = { side: (side) => side, printAbout: () => '', pieceAbout: (name, size) => `${name} · ${size}`, proof: { title: '', spec: '', note: '' }, slug: () => '' };

let nook: Catalogue;
let iris: DesignData;
beforeAll(async () => {
  const maker = stubApi('maker');
  const rows = await maker.api.catalogue(maker.ids.nook);
  const sign = rows.pieces.find((one) => one['code'] === '09')!;
  rows.bases = rows.bases.map((one) => ({ ...one, faces: JSON.stringify([{ code: 'sign-board', name: 'Sign board', piece: String(sign['id']), mesh: '0', normal: [0, 0, 1], point: [0, 0, 0], u: [1, 0, 0], v: [0, -1, 0], bounds: { u0: 0, u1: 1, v0: 0, v1: 1 }, size: { w: 90, h: 20 } }]) }));
  nook = readCatalogue(rows, maker.ids.nook)!;
  const row = maker.tables['designs']!.find((one) => one['code'] === 'BR2288K7Q4X3M9ZD')!;
  iris = { base_id: row['base_id'] as number, ready_design_id: row['ready_design_id'] as number, values: structuredClone(row['values']) as DesignData['values'] };
});

describe('a kit’s pieces', () => {
  it('are its fourteen, in order, each at its size', () => {
    const pieces = kitPieces(nook);
    expect(pieces.map((one) => one.code)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14']);
    expect(pieces.find((one) => one.code === '09')).toMatchObject({ name: 'Shop sign', width: 92, height: 22 });
  });

  it('lie flat in the comp’s rows: left to right, 10 mm apart, a new row past 470 mm', () => {
    const laid = layPieces(kitPieces(nook));
    const at = (code: string) => laid.placed.find((one) => one.code === code)!;
    expect([at('01').x, at('01').y]).toEqual([0, 0]);
    expect([at('02').x, at('02').y]).toEqual([120, 0]);
    expect([at('03').x, at('03').y]).toEqual([240, 0]);
    // 03 ends at 390: the 150 mm right wall starts the second row, below the tallest of the first (180).
    expect([at('04').x, at('04').y]).toEqual([0, 190]);
    for (const one of laid.placed) expect(one.x + one.width).toBeLessThanOrEqual(470);
    expect(laid.width).toBeLessThanOrEqual(470);
  });

  it('carry the design where its parts are cut: the sign, the windows and the door', () => {
    const parts = nook.ready.find((one) => one.name === 'Corner shop')!.parts;
    const carrying = carryingPieces(nook, parts);
    expect(kitPieces(nook).filter((one) => carrying.has(one.id)).map((one) => one.code)).toEqual(['09', '10', '11', '12']);
  });
});

describe('a piece’s sheet and a face’s sheet', () => {
  it('lays out only the parts on the piece, at its own size, inside it', () => {
    const sign = kitPieces(nook).find((one) => one.code === '09')!;
    const sheet = flatSheet(nook, iris, { on: onPiece(sign), empty: 'hide', labels: LABELS });
    expect([sheet.face.width, sheet.face.height]).toEqual([92, 22]);
    expect(sheet.items.map((one) => one.code)).toEqual(['sign']);
    const words = sheet.items[0]!;
    expect(words.kind === 'text' && words.lines[0]!.text).toBe("Iris's Books");
    expect(words.box.x + words.box.w).toBeLessThanOrEqual(92);
    expect(words.box.y + words.box.h).toBeLessThanOrEqual(22);
    // The base piece carries nothing.
    expect(flatSheet(nook, iris, { on: onPiece(kitPieces(nook)[0]!), empty: 'hide', labels: LABELS }).items).toEqual([]);
  });

  it('lays out on the marked sign board what is on it and on the piece it is, at the piece’s size', () => {
    const on = onFace(nook.base.faces[0]!, kitPieces(nook));
    expect(on).toMatchObject({ face: 'sign-board', width: 92, height: 22 });
    expect(flatSheet(nook, iris, { on, empty: 'hide', labels: LABELS }).items.map((one) => one.code)).toEqual(['sign']);
  });
});

describe('the laser’s files for a kit (BC-E2)', () => {
  it('are one a piece, each drawn from its own sheet: the sign’s words inside the sign, on its ENGRAVE layer', async () => {
    const sheet = sheetsFor(nook, iris, () => false)[0]!;
    const made = await makeLaserFiles(nook, sheet, font, {}, 'design-92-v1', WORDS, async () => null, pieceSheetFor(nook, iris, () => false));
    expect(made).toHaveLength(14);
    const sign = made.find((one) => one.name === 'design-92-v1-09-shop-sign.svg')!;
    expect(sign.about).toBe('Shop sign · 92 × 22 mm');
    expect(sign.layers).toEqual(['CUT', 'ENGRAVE']);
    const svg = await sign.blob.text();
    expect(svg).toMatch(/viewBox="0 0 92 22"/);
    // Every point of the engraved words lies on the piece.
    const engrave = /<g[^>]*id="ENGRAVE"[^>]*>([\s\S]*?)<\/g>/.exec(svg)![1]!;
    const numbers = [...engrave.matchAll(/d="([^"]+)"/g)].flatMap((one) => one[1]!.match(/-?\d+(?:\.\d+)?/g)!.map(Number));
    const xs = numbers.filter((_, i) => i % 2 === 0);
    const ys = numbers.filter((_, i) => i % 2 === 1);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(92);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(22);
    // The base piece is cut, nothing engraved.
    expect(made[0]!.layers).toEqual(['CUT']);
  });
});
