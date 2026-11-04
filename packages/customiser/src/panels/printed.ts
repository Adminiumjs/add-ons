/**
 * A 3D-PRINTED ITEM'S FILE: THE 3MF, MADE IN THE SHOP'S BROWSER (BC-E2.keyring,
 * BC-F10; Birch Row Customiser 2084, 2102-2119).
 *
 * Made from the design's newest version, never a picture: on each face the
 * shop marked, the parts the design puts there are laid out on that face's
 * sheet (the one the customer's preview painted), their words drawn as the
 * outlines of the shop's own font files and a logo as its cleaned drawing's
 * filled paths. Those shapes are raised from the face of the model to print,
 * or cut into it, by the face's depth (`three/relief.ts`), and the model with
 * them is written as one mesh in a 3MF in millimetres (`three/threemf.ts`).
 *
 * A logo sent as a picture has no edges to raise: the rules refuse it on a
 * printed item, and were one here it would be left out and said so.
 */
import type { Catalogue } from '../browser/catalogue.ts';
import type { DesignData } from '../browser/api.ts';
import { flatSheet } from '../draw/flat.ts';
import { textPaths, type Font } from '../draw/outline.ts';
import { engravedOf } from '../draw/svgfile.ts';
import { frameInto, IDENTITY, times, type ReadSvg } from '../draw/svgread.ts';
import { missingFonts, FontMissing } from '../draw/pdf.ts';
import { extent, type MarkedFace } from '../three/faces.ts';
import { readPrintModel } from '../three/printModel.ts';
import { joinShapes, relief, ringsOfPaths, type ReliefMesh, type ReliefPath } from '../three/relief.ts';
import { write3mf } from '../three/threemf.ts';
import { fileBytes } from '../pages/shared/stored.ts';
import type { Made } from './make.ts';

/** Why a printed item's file could not be made, for the panel to say. */
export type PrintedProblem = 'no-model' | 'no-face' | 'empty' | 'off-face' | 'no-room' | 'unreadable';

export class PrintedRefused extends Error {
  readonly problem: PrintedProblem;
  constructor(problem: PrintedProblem) {
    super(problem);
    this.problem = problem;
  }
}

/** What the file's line and chips say, in the shop's language. */
export interface PrintedWords {
  /** "Name keyring — “SAM” raised 1 mm". */
  about: (name: string, words: string, mode: 'raised' | 'cut', depth: string) => string;
}

/** The file's chips, as a machine's layers are named (CUT, ENGRAVE): the same in every language. */
export const printedChips = (mode: 'raised' | 'cut'): string[] => ['MODEL', mode === 'raised' ? 'WORDS RAISED' : 'WORDS CUT IN'];

const NO_LABELS = { logo: '', photo: '', image: '' };
const slug = (text: string): string => text.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item';
const mm = (value: number): string => String(Math.round(value * 10) / 10);

/** The relief of a face: its own, else the rules of an area on it, else raised 1 mm. */
export function reliefOfFace(catalogue: Catalogue, face: MarkedFace): { mode: 'raised' | 'cut'; depth: number } {
  if (face.relief !== undefined) return { mode: face.relief.mode, depth: face.relief.depth };
  const area = catalogue.rows.areas.find((one) => one['face'] === face.code);
  const rules = typeof area?.['rules'] === 'string' ? (JSON.parse(area['rules']) as Record<string, unknown>) : ((area?.['rules'] ?? {}) as Record<string, unknown>);
  return { mode: rules['mode'] === 'cut' ? 'cut' : 'raised', depth: typeof rules['depthMm'] === 'number' ? rules['depthMm'] : 1 };
}

/** The shapes a face's sheet raises: its words as outlines and its drawn logos, in millimetres on the sheet. */
function pathsOn(sheet: ReturnType<typeof flatSheet>, font: (family: string, weight: number) => Font | null, logos: Readonly<Record<string, ReadSvg>>): { paths: ReliefPath[][]; words: string[]; leftOut: string[] } {
  const parts = engravedOf(sheet);
  const paths: ReliefPath[][] = [];
  const words: string[] = [];
  for (const item of parts.words) {
    // One path a line: its letters are joined together, and with every other line's.
    for (const d of textPaths(item, font(item.font, item.weight)!)) paths.push([{ d, matrix: IDENTITY }]);
    words.push(item.lines.map((line) => line.text).join(' '));
  }
  const leftOut: string[] = [];
  for (const item of parts.pictures) {
    const svg = logos[item.column];
    if (svg === undefined) {
      leftOut.push(item.column);
      continue;
    }
    const frame = frameInto(svg.view, item.drawn, item.fill ? 'slice' : 'meet');
    // Only what the drawing fills is raised: a stroke alone has no area to stand up.
    for (const shape of svg.shapes.filter((one) => one.fill !== null)) paths.push([{ d: shape.d, matrix: times(frame, shape.matrix) }]);
  }
  return { paths, words, leftOut };
}

/**
 * The printed item's 3MF: the model to print with the design raised from (or
 * cut into) each marked face that carries part of it.
 */
export async function makePrintedFile(
  catalogue: Catalogue,
  data: DesignData,
  font: (family: string, weight: number) => Font | null,
  logos: Readonly<Record<string, ReadSvg>>,
  holds: (column: string) => boolean,
  stem: string,
  words: PrintedWords,
  read: (file: unknown) => Promise<Uint8Array | null> = fileBytes,
): Promise<Made> {
  const base = catalogue.base;
  const bytes = await read(base.row['print_file']);
  if (bytes === null) throw new PrintedRefused('no-model');
  let model: ReliefMesh | { positions: Float32Array; index: Uint32Array | null };
  try {
    model = await readPrintModel(bytes);
  } catch {
    throw new PrintedRefused('unreadable');
  }
  const faces = base.faces;
  if (faces.length === 0) throw new PrintedRefused('no-face');
  const sheets = faces.map((face) => ({ face, sheet: flatSheet(catalogue, data, { on: { piece: null, face: face.code, width: Math.max(face.size.w, 1), height: Math.max(face.size.h, 1) }, empty: 'hide', labels: NO_LABELS, holds }) }));
  const missing = missingFonts(sheets.map((one) => one.sheet), { font });
  if (missing.length > 0) throw new FontMissing(missing);
  const said: string[] = [];
  const leftOut = new Set<string>();
  let made: { mode: 'raised' | 'cut'; depth: number } | null = null;
  for (const { face, sheet } of sheets) {
    const { paths, words: lines, leftOut: left } = pathsOn(sheet, font, logos);
    for (const column of left) leftOut.add(column);
    if (paths.length === 0) continue;
    const shapes = joinShapes(paths.flatMap((group) => ringsOfPaths(group)));
    if (shapes.length === 0) continue;
    const how = reliefOfFace(catalogue, face);
    try {
      model = relief({ model, face, sheet: { width: sheet.face.width, height: sheet.face.height }, shapes, mode: how.mode, depth: how.depth });
    } catch (caught) {
      const problem = (caught as { problem?: unknown }).problem;
      throw new PrintedRefused(problem === 'off-face' || problem === 'no-room' || problem === 'no-face' || problem === 'empty' ? problem : 'unreadable');
    }
    made ??= how;
    said.push(...lines);
  }
  if (made === null || model.index === null) throw new PrintedRefused('empty');
  const box = extent({ positions: model.positions, index: model.index });
  const size = `${mm(box.max[0] - box.min[0])} × ${mm(box.max[1] - box.min[1])} × ${mm(box.max[2] - box.min[2])} mm`;
  const text = said.join(' · ');
  const about = words.about(base.name, text, made.mode, mm(made.depth));
  const file = write3mf({ positions: model.positions, index: model.index, name: base.name, title: about });
  return {
    name: `${stem}-${slug(base.name)}.3mf`,
    about: `${about} · ${size}`,
    layers: printedChips(made.mode),
    kind: 'machine',
    blob: new Blob([file as BlobPart], { type: 'model/3mf' }),
    leftOut: [...leftOut],
  };
}
