/**
 * A PIECE'S FILE FOR THE LASER: one SVG at the piece's size in millimetres,
 * in three layers the machine reads by name and colour.
 *
 * - `CUT` (red hairline): the piece's outline, from the outline the shop
 *   uploaded (its red lines, or every line not named otherwise), else the
 *   piece's own rectangle with its corners;
 * - `SCORE` (blue hairline): what the uploaded outline scores;
 * - `ENGRAVE` (black): the customer's words as the outlines of their font,
 *   a logo drawn as a drawing, the shop's engraved lines.
 *
 * Nothing in it is words or a picture: every word is a path, so the laser
 * needs no fonts, and the file is made only of what Adminium keeps when it
 * cleans an SVG (shapes, groups, a clip), so it can be stored like any other.
 */
import type { FlatItem, FlatSheet } from './flat.ts';
import { frameInto, matrixText, times, type Matrix, type ReadSvg } from './svgread.ts';

export type LaserLayer = 'CUT' | 'SCORE' | 'ENGRAVE';

/** What goes on the ENGRAVE layer beside the words: a logo drawn as a drawing, in the box the sheet puts it. */
export interface DrawnLogo {
  svg: ReadSvg;
  item: Extract<FlatItem, { kind: 'picture' }>;
}

export interface PieceFileInput {
  width: number;
  height: number;
  corner: number;
  /** The shop's outline of the piece, read; none for a plain rectangle. */
  outline: ReadSvg | null;
  /** The words, as outline path data in millimetres from the piece's top-left. */
  words: readonly string[];
  logos: readonly DrawnLogo[];
  /** The shop's engraved lines and shapes on the piece. */
  lines: readonly Extract<FlatItem, { kind: 'shape' }>[];
}

const fixed = (value: number): string => String(Math.round(value * 1000) / 1000 + 0);
const LAYER_PAINT: Readonly<Record<LaserLayer, string>> = {
  CUT: 'fill="none" stroke="#ff0000" stroke-width="0.1"',
  SCORE: 'fill="none" stroke="#0000ff" stroke-width="0.1"',
  ENGRAVE: 'fill="#000000" stroke="none"',
};
/** Path data is written as it was read, but only drawing commands and numbers go into the file. */
const safeD = (d: string): string => d.replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]/g, '');

/** The layers a piece's file holds, in the order the machine runs them. */
export function layersOf(input: PieceFileInput): LaserLayer[] {
  const out: LaserLayer[] = ['CUT'];
  if (input.outline?.shapes.some((one) => one.layer === 'SCORE') === true) out.push('SCORE');
  if (input.words.length > 0 || input.logos.length > 0 || input.lines.length > 0 || input.outline?.shapes.some((one) => one.layer === 'ENGRAVE') === true) out.push('ENGRAVE');
  return out;
}

/** The piece's laser file. */
export function pieceSvg(input: PieceFileInput): string {
  const { width: w, height: h } = input;
  const layers: Record<LaserLayer, string[]> = { CUT: [], SCORE: [], ENGRAVE: [] };
  const defs: string[] = [];
  if (input.outline === null || !input.outline.shapes.some((one) => one.layer === null || one.layer === 'CUT')) {
    layers.CUT.push(`<rect x="0" y="0" width="${fixed(w)}" height="${fixed(h)}"${input.corner > 0 ? ` rx="${fixed(input.corner)}"` : ''}/>`);
  }
  if (input.outline !== null) {
    const frame = frameInto(input.outline.view, { x: 0, y: 0, w, h }, 'stretch');
    for (const shape of input.outline.shapes) {
      const layer: LaserLayer = shape.layer ?? 'CUT';
      layers[layer].push(`<path d="${safeD(shape.d)}" transform="${matrixText(times(frame, shape.matrix))}"/>`);
    }
  }
  for (const d of input.words) layers.ENGRAVE.push(`<path d="${safeD(d)}"/>`);
  input.logos.forEach((logo, index) => {
    const { item, svg } = logo;
    const frame: Matrix = frameInto(svg.view, item.drawn, item.fill ? 'slice' : 'meet');
    const clip = `logo-clip-${String(index + 1)}`;
    if (item.fill) defs.push(`<clipPath id="${clip}"><rect x="${fixed(item.box.x)}" y="${fixed(item.box.y)}" width="${fixed(item.box.w)}" height="${fixed(item.box.h)}"/></clipPath>`);
    const shapes = svg.shapes
      .filter((one) => one.fill !== null || one.stroke !== null)
      .map((one) => {
        // Engraved in one colour: what the logo fills is filled, what it strokes is stroked, at its own width.
        const paint = one.fill !== null ? '' : ` fill="none" stroke="#000000" stroke-width="${fixed(one.strokeWidth)}"`;
        return `<path d="${safeD(one.d)}" transform="${matrixText(times(frame, one.matrix))}"${paint}/>`;
      });
    layers.ENGRAVE.push(`<g${item.fill ? ` clip-path="url(#${clip})"` : ''}>${shapes.join('')}</g>`);
  });
  for (const line of input.lines) {
    const { box } = line;
    const stroke = ` fill="none" stroke="#000000" stroke-width="${fixed(line.line)}"`;
    if (line.shape === 'ellipse') layers.ENGRAVE.push(`<ellipse cx="${fixed(box.x + box.w / 2)}" cy="${fixed(box.y + box.h / 2)}" rx="${fixed(Math.max(0, box.w / 2 - line.line / 2))}" ry="${fixed(Math.max(0, box.h / 2 - line.line / 2))}"${stroke}/>`);
    else {
      layers.ENGRAVE.push(`<rect x="${fixed(box.x)}" y="${fixed(box.y)}" width="${fixed(box.w)}" height="${fixed(box.h)}"${stroke}/>`);
      if (line.shape === 'door') {
        layers.ENGRAVE.push(`<rect x="${fixed(box.x + box.w * 0.15)}" y="${fixed(box.y + box.h * 0.1)}" width="${fixed(box.w * 0.7)}" height="${fixed(box.h * 0.35)}"${stroke}/>`);
        layers.ENGRAVE.push(`<rect x="${fixed(box.x + box.w * 0.15)}" y="${fixed(box.y + box.h * 0.52)}" width="${fixed(box.w * 0.7)}" height="${fixed(box.h * 0.38)}"${stroke}/>`);
      }
    }
  }
  const groups = layersOf(input).map((layer) => `<g id="${layer}" ${LAYER_PAINT[layer]}>${layers[layer].join('')}</g>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${fixed(w)}mm" height="${fixed(h)}mm" viewBox="0 0 ${fixed(w)} ${fixed(h)}">${defs.length > 0 ? `<defs>${defs.join('')}</defs>` : ''}${groups.join('')}</svg>\n`;
}

/** The parts of a sheet a piece's file engraves: its words, its logos, its lines. */
export function engravedOf(sheet: FlatSheet): { words: Extract<FlatItem, { kind: 'text' }>[]; pictures: Extract<FlatItem, { kind: 'picture' }>[]; lines: Extract<FlatItem, { kind: 'shape' }>[] } {
  return {
    words: sheet.items.filter((one): one is Extract<FlatItem, { kind: 'text' }> => one.kind === 'text'),
    pictures: sheet.items.filter((one): one is Extract<FlatItem, { kind: 'picture' }> => one.kind === 'picture'),
    lines: sheet.items.filter((one): one is Extract<FlatItem, { kind: 'shape' }> => one.kind === 'shape' && one.stroke !== null),
  };
}

