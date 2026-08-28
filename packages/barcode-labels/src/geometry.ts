/**
 * THE PAPER: what a sheet of these labels is, in millimetres.
 *
 * ── WHY THE NUMBERS ARE HERE AND NOT IN THE RENDERER ───────────────────────
 *
 * Two modules need them and would otherwise each carry a copy. `sheet.ts` lays
 * a symbol out on a label, and `codes.ts` caps how long a Code 128 code may be
 * — and that cap is not a taste: it is the longest code whose bars still fit
 * this label at a width a scanner can read. Written twice, the two would
 * disagree the first time somebody changed the label size, and the visible
 * result would be a form that accepts a code and a sheet that draws it too
 * narrow to scan. Nothing would be red. So there is one set of numbers and both
 * derive from it.
 *
 * ── AND WHY THE LAYOUT IS DESCRIBED RATHER THAN NAMED ──────────────────────
 *
 * There is a very common label sheet with these measurements, and this file
 * does not say whose it is, because 24 D12 forbids naming a company and a
 * stationery reference is a company's catalogue number. What is written down
 * instead is the geometry itself — the label size, the grid, the margins — so a
 * shop can hold a sheet against it and see whether it is the one they have.
 * That is more useful than a name anyway: a name only helps somebody who buys
 * that name.
 *
 * ── THE ONE NUMBER THAT IS A STANDARD AND NOT A CHOICE ─────────────────────
 *
 * `MIN_MODULE_MM`. Everything else here could be a different sheet tomorrow;
 * that one is the narrowest module either symbology may be drawn at and still
 * be scannable at an ordinary till, and it is the floor the Code 128 cap is
 * computed against. Lowering it to fit a longer code would be trading a limit
 * somebody can work around — "your reference is too long for this label" — for
 * a barcode that reads four times out of five, which is the worse of the two by
 * a wide margin. An intermittent barcode gets blamed on the scanner.
 */

import { moduleCountFor } from './code128.ts';

/** PostScript points per millimetre. A point is 1/72 inch; an inch is 25.4 mm. */
export const PT_PER_MM = 72 / 25.4;

/** Millimetres to points, which is the only unit a PDF page understands. */
export function pt(mm: number): number {
  return mm * PT_PER_MM;
}

/** A4, which is what the sheet is. */
export const PAGE = { widthMm: 210, heightMm: 297 } as const;

/** One label. */
export const LABEL = {
  widthMm: 63.5,
  heightMm: 33.9,
  /** Clear margin inside the label, on every side. Nothing is drawn in it. */
  padMm: 3,
} as const;

/** How the labels sit on the sheet. */
export const GRID = {
  columns: 3,
  rows: 8,
  /** Between columns. There is none between rows: the labels touch. */
  gutterMm: 2.5,
} as const;

export const LABELS_PER_SHEET = GRID.columns * GRID.rows;

/**
 * How many sheets one run may come to.
 *
 * A cap rather than none, and it is about bytes rather than about labels: every
 * page carries its own content stream, so a run nobody bounded is a document
 * that grows without limit in a browser tab. Ten sheets is 240 labels, which is
 * more than anybody sticks on anything in one sitting, and the form says the
 * number rather than silently truncating.
 */
export const MAX_SHEETS = 10;
export const MAX_LABELS = LABELS_PER_SHEET * MAX_SHEETS;

/** The width inside a label's own margins, which is all a symbol may use. */
export const USABLE_WIDTH_MM = LABEL.widthMm - LABEL.padMm * 2;

/** The narrowest a module may be drawn, in millimetres. See this file's header. */
export const MIN_MODULE_MM = 0.19;

/**
 * The longest Code 128 code this label can carry.
 *
 * COMPUTED, NOT TYPED IN. The arithmetic is `moduleCountFor(n) × MIN_MODULE_MM
 * ≤ USABLE_WIDTH_MM`, solved by walking up from one until it stops holding —
 * a loop rather than algebra because the module count is a function in
 * `code128.ts` and re-deriving its formula here would be the second copy this
 * file's header is written against.
 *
 * It comes out at twenty-two characters on this label, which is long enough for
 * every catalogue reference either host app uses and short enough that a shop
 * meeting the limit is meeting a real one.
 */
export const CODE128_MAX_LENGTH = ((): number => {
  let length = 1;
  while (moduleCountFor(length + 1) * MIN_MODULE_MM <= USABLE_WIDTH_MM) length += 1;
  return length;
})();
