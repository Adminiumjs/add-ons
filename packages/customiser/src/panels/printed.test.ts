// @vitest-environment jsdom
/**
 * "MAKE THE FILES" FOR A 3D-PRINTED ITEM (BC-E2.keyring, BC-F10): the comp's
 * keyring with "SAM" on its marked top, made from the design's data into a
 * 3MF of the model with the words raised 1 mm (or cut in), as one closed
 * mesh in millimetres, named and described as the panel lists it.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { describe, expect, it } from 'vitest';

import type { CatalogueRows, DesignData } from '../browser/api.ts';
import { readCatalogue } from '../browser/catalogue.ts';
import { fontAt } from '../draw/outline.ts';
import { keyringStl } from '../testing/keyring.ts';
import { facesValue } from '../three/faceStore.ts';
import { surveyOf, type FaceRelief, type MarkedFace } from '../three/faces.ts';
import { read3mf, readStl, trianglesOfPrint } from '../three/printModel.ts';
import { isClosed } from '../three/relief.ts';
import { zipEntries } from '../three/zip.ts';
import { makePrintedFile, printedChips, PrintedRefused } from './printed.ts';

const MANROPE = new Uint8Array(readFileSync(createRequire(import.meta.url).resolve('@adminium/tokens/fonts/manrope/manrope-latin-wght-normal.woff2')));
const STL = new Uint8Array(keyringStl());
const PRINT = 'file_01JD00000000000000000000PR';

/** The keyring's top, as Mark faces finds and keeps it: the largest flat face, facing up. */
function topFace(relief: FaceRelief): MarkedFace {
  const survey = surveyOf(trianglesOfPrint(readStl(STL)), '0')!;
  const top = survey.faces.find((one) => one.plane.normal[2] > 0.99)!.plane;
  return { ...top, code: 'the-front', name: 'The front', piece: null, size: { w: 56, h: 24 }, relief };
}

function rows(relief: FaceRelief, print: string | null = PRINT): CatalogueRows {
  return {
    bases: [{ id: 15, app: 'maker', name: 'Name keyring', kind: 'printed', width_mm: 56, height_mm: 24, corner_mm: 12, material: 'PLA', thickness_mm: 4, print_file: print, model_file: null, faces: facesValue([topFace(relief)]), offered: null }],
    pieces: [],
    areas: [{ id: 81, app: 'maker', base_id: 15, code: 'front', name: 'The front', face: 'the-front', piece_id: null, shape: 'rect', x_mm: 4.5, y_mm: 2.4, w_mm: 47, h_mm: 19.2, takes: 'words', required: true, rules: JSON.stringify({ chars: 8, grows: true, unit: 'mm', size: 11, min: 6, max: 14, fonts: ['Manrope'], font: 'Manrope', upper: true, mode: relief.mode, depthMm: relief.depth, smallestLetterMm: relief.smallest }), position: 1 }],
    ready: [],
    parts: [],
    fonts: [{ id: 1, family: 'Manrope', name: 'Manrope', weights: '[400,700,800]', file: 'font' }],
    palettes: [],
    colours: [],
    features: [],
  };
}

const DESIGN: DesignData = { base_id: 15, ready_design_id: null, values: { parts: { front: { text: 'SAM' } } } };
const font = (_family: string, weight: number) => fontAt(MANROPE, weight);
const read = async (file: unknown): Promise<Uint8Array | null> => (file === PRINT ? STL : null);
const words = { about: (name: string, said: string, mode: 'raised' | 'cut', depth: string) => `${name} — “${said}” ${mode === 'raised' ? 'raised' : 'cut in'} ${depth} mm` };

async function made(relief: FaceRelief, print: string | null = PRINT) {
  const catalogue = readCatalogue(rows(relief, print), 15)!;
  return await makePrintedFile(catalogue, DESIGN, font, {}, () => false, 'design-91-v2', words, read);
}

describe('the keyring’s 3MF', () => {
  it('is named for the design and the item, says what it holds, and carries the comp’s chips', async () => {
    const file = await made({ mode: 'raised', depth: 1, smallest: 4 });
    expect(file.name).toBe('design-91-v2-name-keyring.3mf');
    expect(file.about).toBe('Name keyring — “SAM” raised 1 mm · 56 × 24 × 5 mm');
    expect(file.layers).toEqual(['MODEL', 'WORDS RAISED']);
    expect(file.kind).toBe('machine');
    expect(file.blob.type).toBe('model/3mf');
    expect(printedChips('cut')).toEqual(['MODEL', 'WORDS CUT IN']);
  });

  it('holds one closed mesh, in millimetres, the words standing 1 mm proud of the 4 mm keyring', async () => {
    const file = await made({ mode: 'raised', depth: 1, smallest: 4 });
    const bytes = new Uint8Array(await file.blob.arrayBuffer());
    expect(zipEntries(bytes).map((one) => one.name)).toContain('3D/3dmodel.model');
    const back = await read3mf(bytes);
    expect(isClosed({ positions: back.positions, index: back.index! })).toBe(true);
    let top = -Infinity;
    for (let i = 2; i < back.positions.length; i += 3) top = Math.max(top, back.positions[i]!);
    expect(top).toBeCloseTo(5, 4);
  });

  it('cut in, keeps the keyring 4 mm and lowers the face inside the letters', async () => {
    const file = await made({ mode: 'cut', depth: 1.5, smallest: 4 });
    expect(file.about).toBe('Name keyring — “SAM” cut in 1.5 mm · 56 × 24 × 4 mm');
    expect(file.layers).toEqual(['MODEL', 'WORDS CUT IN']);
    const back = await read3mf(new Uint8Array(await file.blob.arrayBuffer()));
    expect(isClosed({ positions: back.positions, index: back.index! })).toBe(true);
    expect([...back.positions].filter((_, i) => i % 3 === 2).some((z) => Math.abs(z - 2.5) < 1e-4)).toBe(true);
  });

  it('says why where it cannot be made: no model to print, no marked face, or words off the face', async () => {
    const problem = async (run: () => Promise<unknown>): Promise<string> => {
      try {
        await run();
      } catch (caught) {
        if (caught instanceof PrintedRefused) return caught.problem;
        throw caught;
      }
      return 'made';
    };
    expect(await problem(() => made({ mode: 'raised', depth: 1, smallest: 4 }, null))).toBe('no-model');
    const bare = rows({ mode: 'raised', depth: 1, smallest: 4 });
    bare.bases[0]!['faces'] = null;
    expect(await problem(() => makePrintedFile(readCatalogue(bare, 15)!, DESIGN, font, {}, () => false, 's', words, read))).toBe('no-face');
    const long = { ...DESIGN, values: { parts: { front: { text: 'SAMANTHA', size: 14 } } } };
    expect(await problem(() => makePrintedFile(readCatalogue(rows({ mode: 'raised', depth: 1, smallest: 4 }), 15)!, long, font, {}, () => false, 's', words, read))).toBe('off-face');
  });
});
