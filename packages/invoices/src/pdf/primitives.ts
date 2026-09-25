/**
 * The five drawing operations an invoice needs, and no sixth.
 *
 * Everything the document draws is one of: a run of text at a point, a run of
 * text whose RIGHT edge is at a point (every money column), a paragraph
 * wrapped to a width, a horizontal rule, and a filled box. That list is short
 * because it was taken from the comp rather than from imagination — anything
 * not on it is not drawn on any of the twelve starters.
 *
 * COORDINATES ARE TOP-DOWN. PDF's own origin is the bottom-left corner and
 * every layout anybody writes is top-down, so the conversion happens HERE,
 * once, in `at()`. A primitive that took PDF coordinates would push that
 * subtraction into every call site and guarantee that one of them forgot.
 */

import { widthOf, type FontWeight } from './helvetica.ts';
import { ascii, centralLiteral, fontName, literal, pt, rgb, runsOf } from './writer.ts';

export interface Frame {
  readonly widthPt: number;
  readonly heightPt: number;
}

/** Top-down y → PDF's bottom-up y. */
function at(frame: Frame, y: number): number {
  return frame.heightPt - y;
}

export interface TextStyle {
  readonly sizePt: number;
  readonly weight?: FontWeight;
  /** `#rrggbb`. Defaults to black. */
  readonly color?: string;
}

function setFill(color: string | undefined): number[] {
  if (color === undefined) return [];
  const [r, g, b] = rgb(color);
  return ascii(`${pt(r)} ${pt(g)} ${pt(b)} rg\n`);
}

/** A run of text with its LEFT edge and BASELINE at (x, y), measured top-down. */
export function text(frame: Frame, x: number, y: number, value: string, style: TextStyle): number[] {
  if (value === '') return [];
  const weight = style.weight ?? 'regular';
  const runs = runsOf(value);
  const ops: number[] = [
    ...ascii('q\n'),
    ...setFill(style.color),
    ...ascii(`BT\n${fontName(weight, runs[0]!.face)} ${pt(style.sizePt)} Tf\n`),
    ...ascii(`1 0 0 1 ${pt(x)} ${pt(at(frame, y))} Tm\n`),
  ];
  // Each run in its own face; the text position carries on from one to the
  // next, so a Czech word set in two faces reads as one word.
  runs.forEach((run, index) => {
    if (index > 0) ops.push(...ascii(`\n${fontName(weight, run.face)} ${pt(style.sizePt)} Tf\n`));
    ops.push(...(run.face === 'central' ? centralLiteral(run.text) : literal(run.text)), ...ascii(' Tj'));
  });
  ops.push(...ascii('\nET\nQ\n'));
  return ops;
}

/**
 * A run of text whose RIGHT edge sits at `x`.
 *
 * This is what every figure in a money column uses, and it is the one place
 * the width table earns its keep: the right edge is `x - widthOf(value)`, so
 * a wrong advance for one character moves that figure out of line with the one
 * above it. `writer.test.ts` asserts a column of differently-shaped amounts
 * lands on the same right edge for exactly that reason.
 */
export function textRight(
  frame: Frame,
  x: number,
  y: number,
  value: string,
  style: TextStyle,
): number[] {
  return text(frame, x - widthOf(value, style.sizePt, style.weight ?? 'regular'), y, value, style);
}

/** Break `value` into lines that fit `maxWidthPt`, breaking on spaces where it can. */
export function wrap(
  value: string,
  maxWidthPt: number,
  style: TextStyle,
): readonly string[] {
  const weight = style.weight ?? 'regular';
  const out: string[] = [];
  for (const paragraph of value.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line === '' ? word : `${line} ${word}`;
      if (line !== '' && widthOf(candidate, style.sizePt, weight) > maxWidthPt) {
        out.push(line);
        line = word;
        continue;
      }
      /*
       * A single word wider than the column. It is broken by CHARACTER rather
       * than left to overflow, because the thing that overflows an invoice's
       * description column in practice is a part number or a URL — one long
       * token, no spaces — and letting it run draws over the money beside it.
       */
      if (line === '' && widthOf(word, style.sizePt, weight) > maxWidthPt) {
        let chunk = '';
        for (const character of word) {
          if (widthOf(chunk + character, style.sizePt, weight) > maxWidthPt && chunk !== '') {
            out.push(chunk);
            chunk = character;
            continue;
          }
          chunk += character;
        }
        line = chunk;
        continue;
      }
      line = candidate;
    }
    out.push(line);
  }
  return out;
}

/** A paragraph, wrapped and drawn; returns the y the NEXT thing should start at. */
export function paragraph(
  frame: Frame,
  x: number,
  y: number,
  value: string,
  maxWidthPt: number,
  style: TextStyle,
  leadingPt: number,
): { readonly ops: number[]; readonly y: number } {
  const ops: number[] = [];
  let cursor = y;
  for (const line of wrap(value, maxWidthPt, style)) {
    ops.push(...text(frame, x, cursor, line, style));
    cursor += leadingPt;
  }
  return { ops, y: cursor };
}

/** A hairline rule from (x, y) running `widthPt` to the right. */
export function rule(
  frame: Frame,
  x: number,
  y: number,
  widthPt: number,
  color = '#e5e7eb',
  thicknessPt = 0.75,
): number[] {
  const [r, g, b] = rgb(color);
  return [
    ...ascii('q\n'),
    ...ascii(`${pt(r)} ${pt(g)} ${pt(b)} RG\n${pt(thicknessPt)} w\n`),
    ...ascii(`${pt(x)} ${pt(at(frame, y))} m\n${pt(x + widthPt)} ${pt(at(frame, y))} l\nS\nQ\n`),
  ];
}

/** A filled rectangle whose TOP-LEFT corner is (x, y). */
export function box(
  frame: Frame,
  x: number,
  y: number,
  widthPt: number,
  heightPt: number,
  color: string,
): number[] {
  const [r, g, b] = rgb(color);
  return [
    ...ascii('q\n'),
    ...ascii(`${pt(r)} ${pt(g)} ${pt(b)} rg\n`),
    ...ascii(
      `${pt(x)} ${pt(at(frame, y + heightPt))} ${pt(widthPt)} ${pt(heightPt)} re\nf\nQ\n`,
    ),
  ];
}
