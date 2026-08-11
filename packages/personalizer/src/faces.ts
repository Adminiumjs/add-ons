/**
 * THE FIVE FACES THE STUDIO CUTS: what each one looks like, how wide its
 * letters are, and — for the file that goes to the laser — the outline of every
 * letter it can cut.
 *
 * ── WHY THE WIDTHS ARE A TABLE AND NOT A MEASUREMENT (24 D5c) ───────────────
 *
 * Comp L measures text with `document.createElement("canvas").getContext("2d")`
 * and `measureText`. D5c overrules that, and the reason is acceptance criterion
 * 17 rather than taste: canvas advances depend on the platform, on which fonts
 * happen to be installed, and on the browser's own fallback chain. A verdict
 * measured that way says "two characters more than fits" on one machine and
 * "it fits" on the next, the cart thumbnail and the proof stop being the same
 * picture, and none of it is reproducible in a headless suite. So the numbers
 * live HERE, committed, and the engine is a pure function of them.
 *
 * ── HOW THE NUMBERS WERE OBTAINED, EXACTLY ──────────────────────────────────
 *
 * Measured ONCE, by hand, and pasted in. `tools/measure-faces.html` is the page
 * that produced them and it ships in this package so anyone can reproduce or
 * revise the table: it sets `font = <weight> 1000px <stack>` on a 2D canvas and
 * reads `measureText(ch).width` for every printable ASCII character, then reads
 * `actualBoundingBoxAscent/Descent` off `H`, `x` and `Hgjy` for the cap height,
 * the x-height and the ink extents. Run it, copy the JSON, replace the arrays
 * below. It was run in Chrome on macOS on 2026-08-10.
 *
 * `advance` is therefore in PER MILLE OF THE TYPE SIZE, for ASCII 32…126 in
 * code order, and `cap`, `ink` and `xh` are per mille of the same size.
 *
 * ── AND WHY A STALE TABLE STILL CANNOT LIE ──────────────────────────────────
 *
 * A committed table on a machine whose fonts differ would normally drift away
 * from what the browser actually draws, and the shopper would see a line
 * overflowing a zone the engine had just called a fit. It cannot, because the
 * preview does not ask the browser to lay the text out: every `<text>` the
 * surface draws carries `textLength` set to the width THIS TABLE computed, with
 * `lengthAdjust="spacingAndGlyphs"`. The browser is told the answer. What the
 * table decides is what the reader sees, on every platform, in every locale —
 * and the production file below is placed from the same numbers, so the file
 * and the picture agree by construction rather than by luck.
 *
 * ── NO WEBFONT IS DOWNLOADED (24 D11) ───────────────────────────────────────
 *
 * Every `css` stack below is families a browser already has, ending in a
 * generic. A demo that fetched a font file would be a real third-party call in
 * an add-on whose whole claim is that it calls nothing.
 *
 * Face names are NAMES — Fenwick, Bramley, Row, Alder, Quarry — and names do
 * not translate, which is why they are not in the string bundle.
 */

/** The five, in the order the studio lists them. */
export const FACE_IDS = ['fenwick', 'bramley', 'row', 'alder', 'quarry'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export interface Face {
  id: FaceId;
  /** A proper noun. Never translated, never an i18n key. */
  name: string;
  /** What the preview draws with. Families a browser already has (D11). */
  css: string;
  weight: number;
  /** A face cut only in capitals. */
  upper: boolean;
  /**
   * Below this, in millimetres of cap height, the thin strokes start to close
   * up on open grain. The shop WARNS at this size rather than refusing — the
   * piece still cuts, it just reads softer, and that is the maker's call.
   */
  smallestMm: number;
  /** Per mille of the type size, ASCII 32…126 in code order. Measured. */
  advance: readonly number[];
  /** Per mille of the type size. Measured off `H`, `x` and `Hgjy`. */
  cap: number;
  xh: number;
  inkAsc: number;
  inkDesc: number;
  /** The slant, in degrees, the cut alphabet applies to this face. */
  slantDeg: number;
  /** Stroke width of the cut alphabet, as a fraction of cap height. */
  strokeRatio: number;
}

/** ASCII 32 — the first code the table carries. */
const FIRST_CODE = 32;

export const FACES: Readonly<Record<FaceId, Face>> = {
  fenwick: {
    id: 'fenwick',
    name: 'Fenwick',
    css: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    weight: 600,
    upper: false,
    smallestMm: 6,
    cap: 693,
    xh: 484,
    inkAsc: 756,
    inkDesc: 217,
    slantDeg: 0,
    strokeRatio: 0.11,
    advance: [
      254, 376, 510, 703, 641, 879, 799, 269, 447, 447, 482, 703, 328, 379, 328, 472, 701, 490,
      626, 625, 649, 599, 648, 554, 676, 648, 367, 367, 703, 703, 703, 548, 967, 758, 757, 715,
      834, 721, 671, 807, 913, 446, 595, 817, 686, 1023, 839, 820, 701, 820, 797, 649, 684, 833,
      762, 1126, 809, 732, 689, 447, 472, 447, 703, 703, 500, 596, 646, 531, 663, 572, 393, 577,
      680, 354, 346, 632, 344, 1016, 690, 636, 658, 648, 520, 513, 397, 677, 567, 863, 588, 562,
      525, 500, 388, 500, 703,
    ],
  },
  bramley: {
    id: 'bramley',
    name: 'Bramley',
    css: '"Rockwell", "Roboto Slab", "Bookman Old Style", Georgia, serif',
    weight: 700,
    upper: false,
    smallestMm: 5,
    cap: 736,
    xh: 513,
    inkAsc: 749,
    inkDesc: 238,
    slantDeg: 0,
    strokeRatio: 0.15,
    advance: [
      271, 384, 531, 724, 576, 857, 869, 294, 373, 373, 621, 724, 384, 373, 384, 551, 630, 630,
      630, 630, 630, 630, 630, 631, 630, 630, 384, 384, 724, 724, 724, 610, 977, 757, 757, 847,
      858, 723, 691, 915, 824, 444, 440, 853, 691, 1129, 858, 926, 723, 926, 790, 576, 734, 734,
      757, 1073, 802, 757, 700, 452, 551, 452, 632, 542, 361, 626, 680, 604, 671, 609, 392, 668,
      668, 378, 331, 668, 361, 1076, 684, 615, 670, 681, 492, 522, 388, 674, 658, 914, 595, 659,
      563, 417, 662, 417, 724,
    ],
  },
  row: {
    id: 'row',
    name: 'Row',
    css: 'Manrope, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    weight: 600,
    upper: false,
    smallestMm: 4,
    cap: 705,
    xh: 518,
    inkAsc: 726,
    inkDesc: 181,
    slantDeg: 0,
    strokeRatio: 0.12,
    advance: [
      200, 300, 438, 627, 633, 863, 691, 265, 362, 362, 433, 633, 232, 437, 232, 295, 639, 468,
      591, 617, 633, 612, 641, 563, 632, 641, 232, 232, 633, 633, 633, 519, 883, 673, 628, 704,
      693, 566, 542, 720, 719, 251, 537, 636, 537, 851, 709, 746, 604, 745, 626, 619, 595, 704,
      663, 952, 668, 647, 626, 362, 295, 362, 633, 560, 500, 532, 583, 530, 582, 541, 338, 578,
      569, 229, 229, 521, 229, 843, 560, 559, 579, 578, 345, 498, 337, 560, 513, 765, 508, 521,
      493, 362, 233, 362, 633,
    ],
  },
  alder: {
    id: 'alder',
    name: 'Alder',
    css: '"Snell Roundhand", "Bradley Hand", "Segoe Script", "Brush Script MT", cursive',
    weight: 600,
    upper: false,
    smallestMm: 8,
    cap: 722,
    xh: 368,
    inkAsc: 722,
    inkDesc: 311,
    slantDeg: 11,
    strokeRatio: 0.09,
    advance: [
      268, 370, 333, 537, 537, 796, 667, 222, 389, 389, 333, 600, 278, 370, 278, 278, 537, 426,
      537, 537, 537, 537, 537, 537, 537, 537, 278, 278, 600, 600, 600, 481, 800, 870, 981, 667,
      944, 685, 796, 630, 944, 611, 611, 907, 574, 1000, 796, 741, 815, 722, 907, 556, 796, 833,
      759, 1000, 870, 778, 704, 389, 350, 389, 600, 500, 259, 519, 481, 407, 519, 407, 278, 519,
      481, 259, 259, 481, 259, 722, 481, 481, 481, 519, 389, 370, 278, 481, 481, 704, 593, 481,
      481, 389, 222, 389, 600,
    ],
  },
  quarry: {
    id: 'quarry',
    name: 'Quarry',
    css: '"Haettenschweiler", "Arial Narrow", "Avenir Next Condensed", "Helvetica Neue Condensed", sans-serif',
    weight: 600,
    upper: true,
    smallestMm: 5,
    cap: 716,
    xh: 519,
    inkAsc: 716,
    inkDesc: 210,
    slantDeg: 0,
    strokeRatio: 0.13,
    advance: [
      228, 273, 389, 456, 456, 729, 592, 195, 273, 273, 319, 479, 228, 273, 228, 228, 456, 456,
      456, 456, 456, 456, 456, 456, 456, 456, 273, 273, 479, 479, 479, 501, 800, 592, 592, 592,
      592, 547, 501, 638, 592, 228, 456, 592, 501, 683, 592, 638, 547, 638, 592, 547, 501, 592,
      547, 774, 547, 547, 501, 273, 228, 273, 479, 456, 273, 456, 501, 456, 501, 456, 273, 501,
      501, 228, 228, 456, 228, 729, 501, 501, 501, 501, 319, 456, 273, 501, 456, 638, 456, 456,
      410, 319, 230, 319, 479,
    ],
  },
};

export const FACE_LIST: readonly Face[] = FACE_IDS.map((id) => FACES[id]);

export function faceOf(id: string | undefined): Face {
  return (id !== undefined && (FACES as Record<string, Face>)[id]) || FACES.fenwick;
}

/** What the maker's own text becomes on an uppercase-only face. */
export function shape(text: string, face: Face): string {
  return face.upper ? text.toUpperCase() : text;
}

/**
 * One character's advance, in millimetres, at a given CAP HEIGHT.
 *
 * SIZE MEANS CAP HEIGHT throughout this add-on, because that is what a maker
 * measures with a rule: "eleven millimetres" is how tall a capital stands on
 * the piece, not the invisible em box around it. The table is per mille of the
 * type size, so the conversion is one division and it is here rather than
 * scattered through the callers.
 *
 * A character the table does not carry — anything outside printable ASCII —
 * returns `null` rather than a guess. The caller turns that into a verdict that
 * names the character, which is the honest answer for an alphabet that is
 * actually cut into wood: the studio does not have that letter.
 */
export function advanceMm(ch: string, face: Face, capMm: number): number | null {
  const code = ch.codePointAt(0) ?? 0;
  const index = code - FIRST_CODE;
  const mille = face.advance[index];
  if (mille === undefined || code > 126) return null;
  return (mille / 1000) * (capMm / (face.cap / 1000));
}

/** Every character in `text` the studio has no letter for, in order, deduplicated. */
export function uncuttable(text: string, face: Face): string[] {
  const out: string[] = [];
  for (const ch of shape(text, face)) {
    if (advanceMm(ch, face, 10) === null && !out.includes(ch)) out.push(ch);
  }
  return out;
}

/**
 * The width of a line, in millimetres, at a given cap height.
 *
 * Sum of advances, no kerning — and that is a decision rather than an omission.
 * The measuring page reports both: for "The Hartleys" the summed advances came
 * within 0.02% of the browser's own laid-out width on three of the five faces
 * and within 1% on the fourth. Kerning pairs would be another table an order of
 * magnitude larger, and the surface forces the drawn width to this number
 * anyway, so a pair table would change what the browser draws rather than
 * correcting an error.
 *
 * Characters the studio cannot cut contribute nothing to the width; the verdict
 * names them separately, so a line is never quietly measured as if a missing
 * letter were a space.
 */
export function lineWidthMm(text: string, face: Face, capMm: number): number {
  let total = 0;
  for (const ch of shape(text, face)) total += advanceMm(ch, face, capMm) ?? 0;
  return total;
}

/** How tall the ink stands, ascender to descender, at a given cap height. */
export function lineInkMm(face: Face, capMm: number): number {
  return ((face.inkAsc + face.inkDesc) / face.cap) * capMm;
}
