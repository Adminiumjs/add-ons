/**
 * WORDS AS OUTLINES: a line of a flat sheet's words drawn as the shapes of
 * its font's glyphs, in millimetres, on the line's own baseline and anchor.
 *
 * The laser and the press get no fonts: every word in a production file is
 * a path made here from the shop's font file (WOFF2, read by `fontkit`),
 * laid out by the font's own advances and kerning, at the size and weight
 * the sheet says. The editor draws the same line as text in the same font
 * file at the same baseline, so the two agree.
 */
import { create, type Font } from 'fontkit';

import type { FlatItem } from './flat.ts';

export type { Font };

/** A font read from its file's bytes; none for bytes that are no font. */
export function readFont(bytes: Uint8Array): Font | null {
  try {
    return create(bytes);
  } catch {
    return null;
  }
}

/**
 * The font at a weight, read again from its bytes: a variable font set to
 * that weight (its `wght` axis, held to its range), a fixed one as it is.
 *
 * `fontkit` cannot set a WOFF2 file's weight by itself: `getVariation` reads
 * the file's tables from the wrong place, and a weight set before the
 * glyphs are first unpacked trips over the composite glyphs. So the weight is
 * set on a fresh copy, the glyphs are unpacked with no weight, and only then
 * is the weight's processor made.
 */
export function fontAt(bytes: Uint8Array, weight: number): Font | null {
  const font = readFont(bytes);
  if (font === null) return null;
  const inner = font as unknown as { fvar?: { axis: { axisTag: string; minValue: number; maxValue: number; defaultValue: number }[] }; variationCoords: number[] | null; getGlyph: (id: number) => unknown };
  const axes = inner.fvar?.axis;
  if (axes === undefined || !axes.some((axis) => axis.axisTag.trim() === 'wght')) return font;
  let made: PropertyDescriptor | undefined;
  for (let at: object | null = Object.getPrototypeOf(font) as object | null; at !== null && made === undefined; at = Object.getPrototypeOf(at) as object | null) made = Object.getOwnPropertyDescriptor(at, '_variationProcessor');
  if (made?.get === undefined) return font;
  const make = made.get;
  let unpacked = false;
  Object.defineProperty(font, '_variationProcessor', { configurable: true, get: () => (unpacked ? make.call(font) : null) });
  inner.variationCoords = axes.map((axis) => (axis.axisTag.trim() === 'wght' ? Math.max(axis.minValue, Math.min(axis.maxValue, weight)) : axis.defaultValue));
  try {
    inner.getGlyph(0);
    unpacked = true;
    vary(font);
  } catch {
    return null;
  }
  return font;
}

interface PointLike {
  x: number;
  y: number;
}
type PointMaker = new (onCurve: boolean, endContour: boolean, x: number, y: number) => PointLike;

/**
 * The weight's changes put into a WOFF2 font's unpacked glyphs, as `fontkit`
 * puts them into a TrueType file's when it reads each glyph: every outline's
 * points moved, and each part of a glyph made of parts placed again. The
 * four points after an outline's own are its metrics', which the changes
 * also name.
 */
function vary(font: Font): void {
  const inner = font as unknown as { _variationProcessor: { transformPoints: (id: number, points: PointLike[]) => void } | null; _transformedGlyphs?: ({ points?: PointLike[]; components?: { dx: number; dy: number }[] } | null)[] };
  const processor = inner._variationProcessor;
  const glyphs = inner._transformedGlyphs;
  if (processor === null || glyphs === undefined) return;
  const sample = glyphs.find((one) => one?.points !== undefined && one.points.length > 0)?.points?.[0];
  if (sample === undefined) return;
  const Point = sample.constructor as PointMaker;
  const phantom = (): PointLike[] => [0, 1, 2, 3].map(() => new Point(false, true, 0, 0));
  glyphs.forEach((glyph, id) => {
    if (glyph === null || glyph === undefined) return;
    if (glyph.points !== undefined) processor.transformPoints(id, [...glyph.points, ...phantom()]);
    else if (glyph.components !== undefined) {
      const points = glyph.components.map((one) => new Point(true, true, one.dx, one.dy));
      processor.transformPoints(id, [...points, ...phantom()]);
      points.forEach((point, index) => {
        glyph.components![index]!.dx = point.x;
        glyph.components![index]!.dy = point.y;
      });
    }
  });
}

/** The characters of a text the font has no glyph for (each once). */
export function missingIn(font: Font, text: string): string[] {
  const out = new Set<string>();
  for (const char of text) if (!/\s/.test(char) && !font.hasGlyphForCodePoint(char.codePointAt(0)!)) out.add(char);
  return [...out];
}

const fixed = (value: number): string => (Math.round(value * 1000) / 1000 + 0).toString();

/** One line of words as one path's data, in millimetres. Its width too, for the anchor. */
export function linePath(font: Font, text: string, x: number, baseline: number, sizeMm: number, anchor: 'start' | 'middle' | 'end'): { d: string; width: number } {
  const run = font.layout(text);
  const k = sizeMm / font.unitsPerEm;
  const width = run.positions.reduce((sum, one) => sum + one.xAdvance, 0) * k;
  let pen = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const parts: string[] = [];
  run.glyphs.forEach((glyph, index) => {
    const at = run.positions[index]!;
    const ox = pen + at.xOffset * k;
    const oy = baseline - at.yOffset * k;
    // The font's y runs up; the sheet's runs down.
    const px = (value: number): string => fixed(ox + value * k);
    const py = (value: number): string => fixed(oy - value * k);
    for (const { command, args } of glyph.path.commands) {
      if (command === 'moveTo') parts.push(`M${px(args[0]!)} ${py(args[1]!)}`);
      else if (command === 'lineTo') parts.push(`L${px(args[0]!)} ${py(args[1]!)}`);
      else if (command === 'quadraticCurveTo') parts.push(`Q${px(args[0]!)} ${py(args[1]!)} ${px(args[2]!)} ${py(args[3]!)}`);
      else if (command === 'bezierCurveTo') parts.push(`C${px(args[0]!)} ${py(args[1]!)} ${px(args[2]!)} ${py(args[3]!)} ${px(args[4]!)} ${py(args[5]!)}`);
      else parts.push('Z');
    }
    pen += at.xAdvance * k;
  });
  return { d: parts.join(''), width };
}

/** Every line of a text item as path data, in its font (already at its weight). */
export function textPaths(item: Extract<FlatItem, { kind: 'text' }>, font: Font): string[] {
  return item.lines.map((line) => linePath(font, line.text, line.x, line.y, item.sizeMm, item.anchor).d).filter((d) => d !== '');
}
