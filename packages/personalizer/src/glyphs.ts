/**
 * THE STUDIO'S CUT ALPHABET — the letters as GEOMETRY, for the file that goes
 * to the laser.
 *
 * ── WHY AN ALPHABET LIVES IN THIS PACKAGE AT ALL ────────────────────────────
 *
 * Acceptance criterion 19: the production file carries OUTLINES, NEVER A FONT.
 * Not a `font-family`, not an embedded `.otf`, not a `<text>` element with a
 * name in it — because the moment the file names a face, whether the piece cuts
 * correctly depends on what is installed on the machine that opens it, and the
 * whole promise of this add-on ("what you typed is what we cut") stops being
 * true at the last step.
 *
 * A file of outlines needs outlines to put in it. This package cannot lift them
 * out of Georgia or anything else — those are somebody's typefaces, and
 * redrawing a mark is exactly what 24 D12 refuses on the visual side. So the
 * studio has its own: a SINGLE-STROKE SKELETON per letter, offset to a closed
 * contour by the face's stroke weight. That is what a small laser studio
 * actually does, it is dependency-free, it is deterministic, and it belongs to
 * nobody but this repo.
 *
 * ── HOW IT LINES UP WITH THE PREVIEW ────────────────────────────────────────
 *
 * The preview draws real type — the browser's own Georgia, or whatever the
 * face's stack resolves to — and this alphabet is not that. What the two share,
 * exactly, is the thing that matters: EVERY PEN POSITION. Both walk the same
 * measured advance table in `faces.ts`, so a letter starts at the same
 * millimetre in the file as it does in the picture, and the line as a whole is
 * the same width to the same decimal. The preview forces `textLength` to that
 * width; the file places each glyph at that offset. The words, their size,
 * their place and their spacing are identical; the letterforms are the studio's
 * own, and the production screen says so in one plain line rather than leaving
 * a reader to discover it.
 *
 * ── THE COORDINATES ─────────────────────────────────────────────────────────
 *
 * Per glyph: `w` is the ink width and every stroke is a polyline, both in units
 * of CAP HEIGHT. `y = 0` is the baseline and `y = 1` is the cap height, so a
 * descender is negative and the x-height (0.7) and ascender (1.0) are where a
 * reader would expect. A glyph is centred inside its measured advance when it
 * is placed, so a narrow alphabet inside a wide face's rhythm still sits
 * evenly rather than crowding to the left.
 *
 * `arc()` keeps the table short: a round letter is eight to twenty points that
 * nobody should have to type out, and typing them out is how a curve ends up
 * subtly different from the same curve in the letter beside it.
 */

/** Points on an ellipse, as a flat [x, y, x, y, …] run. Degrees, y upwards. */
function arc(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fromDeg: number,
  toDeg: number,
  steps = 14,
): number[] {
  const out: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = ((fromDeg + ((toDeg - fromDeg) * i) / steps) * Math.PI) / 180;
    out.push(round(cx + rx * Math.cos(a)), round(cy + ry * Math.sin(a)));
  }
  return out;
}

/** Three decimals of a millimetre-scale unit is well under a laser's kerf. */
function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export interface Glyph {
  /** Ink width, in units of cap height. */
  w: number;
  /** Skeleton strokes: flat [x, y, x, y, …] polylines. */
  s: number[][];
}

/** A full stop, and the dot on an `i` — one square, reused. */
const dot = (x: number, y: number, r = 0.045): number[] => [
  x - r,
  y - r,
  x + r,
  y - r,
  x + r,
  y + r,
  x - r,
  y + r,
  x - r,
  y - r,
];

export const GLYPHS: Readonly<Record<string, Glyph>> = {
  ' ': { w: 0, s: [] },

  // ── capitals ──────────────────────────────────────────────────────────────
  A: { w: 0.74, s: [[0, 0, 0.37, 1, 0.74, 0], [0.13, 0.3, 0.61, 0.3]] },
  B: {
    w: 0.68,
    s: [
      [0, 0, 0, 1],
      [0, 1, ...arc(0.36, 0.75, 0.3, 0.25, 90, -90), 0, 0.5],
      [0, 0.5, ...arc(0.34, 0.25, 0.34, 0.25, 90, -90), 0, 0],
    ],
  },
  C: { w: 0.7, s: [arc(0.35, 0.5, 0.35, 0.5, 55, 305, 18)] },
  D: { w: 0.7, s: [[0, 0, 0, 1], [0, 1, ...arc(0.32, 0.5, 0.38, 0.5, 90, -90, 16), 0, 0]] },
  E: { w: 0.62, s: [[0, 1, 0, 0], [0, 1, 0.62, 1], [0, 0.5, 0.5, 0.5], [0, 0, 0.62, 0]] },
  F: { w: 0.6, s: [[0, 0, 0, 1], [0, 1, 0.6, 1], [0, 0.52, 0.48, 0.52]] },
  G: { w: 0.74, s: [arc(0.37, 0.5, 0.37, 0.5, 50, 310, 18), [0.72, 0.16, 0.72, 0.46, 0.42, 0.46]] },
  H: { w: 0.7, s: [[0, 0, 0, 1], [0.7, 0, 0.7, 1], [0, 0.5, 0.7, 0.5]] },
  I: { w: 0.1, s: [[0.05, 0, 0.05, 1]] },
  J: { w: 0.48, s: [[0.48, 1, 0.48, 0.24, ...arc(0.24, 0.24, 0.24, 0.24, 0, -180, 10)]] },
  K: { w: 0.68, s: [[0, 0, 0, 1], [0.66, 1, 0, 0.42], [0.24, 0.6, 0.68, 0]] },
  L: { w: 0.58, s: [[0, 1, 0, 0, 0.58, 0]] },
  M: { w: 0.84, s: [[0, 0, 0, 1, 0.42, 0.35, 0.84, 1, 0.84, 0]] },
  N: { w: 0.72, s: [[0, 0, 0, 1, 0.72, 0, 0.72, 1]] },
  O: { w: 0.78, s: [arc(0.39, 0.5, 0.39, 0.5, 0, 360, 22)] },
  P: { w: 0.64, s: [[0, 0, 0, 1], [0, 1, ...arc(0.32, 0.72, 0.32, 0.28, 90, -90, 12), 0, 0.44]] },
  Q: {
    w: 0.78,
    s: [arc(0.39, 0.5, 0.39, 0.5, 0, 360, 22), [0.5, 0.22, 0.78, -0.08]],
  },
  R: {
    w: 0.68,
    s: [
      [0, 0, 0, 1],
      [0, 1, ...arc(0.3, 0.72, 0.32, 0.28, 90, -90, 12), 0, 0.44],
      [0.3, 0.44, 0.68, 0],
    ],
  },
  S: {
    w: 0.62,
    s: [
      [
        ...arc(0.31, 0.74, 0.31, 0.26, 60, 200, 10),
        ...arc(0.31, 0.26, 0.31, 0.26, 110, -80, 10),
      ],
    ],
  },
  T: { w: 0.66, s: [[0, 1, 0.66, 1], [0.33, 1, 0.33, 0]] },
  U: { w: 0.7, s: [[0, 1, 0, 0.3, ...arc(0.35, 0.3, 0.35, 0.3, 180, 360, 12), 0.7, 1]] },
  V: { w: 0.72, s: [[0, 1, 0.36, 0, 0.72, 1]] },
  W: { w: 0.96, s: [[0, 1, 0.2, 0, 0.48, 0.7, 0.76, 0, 0.96, 1]] },
  X: { w: 0.7, s: [[0, 1, 0.7, 0], [0, 0, 0.7, 1]] },
  Y: { w: 0.7, s: [[0, 1, 0.35, 0.5, 0.7, 1], [0.35, 0.5, 0.35, 0]] },
  Z: { w: 0.64, s: [[0, 1, 0.64, 1, 0, 0, 0.64, 0]] },

  // ── lower case ────────────────────────────────────────────────────────────
  a: { w: 0.56, s: [arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18), [0.56, 0.7, 0.56, 0]] },
  b: { w: 0.56, s: [[0, 0, 0, 1], arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18)] },
  c: { w: 0.52, s: [arc(0.26, 0.35, 0.26, 0.35, 55, 305, 14)] },
  d: { w: 0.56, s: [[0.56, 0, 0.56, 1], arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18)] },
  e: { w: 0.54, s: [[0, 0.38, 0.54, 0.38, ...arc(0.27, 0.35, 0.27, 0.35, 8, 320, 16)]] },
  f: {
    w: 0.38,
    s: [[0.12, 0, 0.12, 0.84, ...arc(0.26, 0.84, 0.14, 0.16, 180, 80, 6)], [0, 0.64, 0.34, 0.64]],
  },
  g: {
    w: 0.56,
    s: [
      arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18),
      [0.56, 0.7, 0.56, -0.1, ...arc(0.28, -0.1, 0.28, 0.2, 0, -180, 10)],
    ],
  },
  h: { w: 0.54, s: [[0, 0, 0, 1], [0, 0.4, ...arc(0.27, 0.42, 0.27, 0.28, 180, 0, 10), 0.54, 0]] },
  i: { w: 0.12, s: [[0.06, 0, 0.06, 0.7], dot(0.06, 0.88)] },
  j: {
    w: 0.24,
    s: [[0.18, 0.7, 0.18, -0.08, ...arc(0.02, -0.08, 0.16, 0.16, 0, -90, 6)], dot(0.18, 0.88)],
  },
  k: { w: 0.52, s: [[0, 0, 0, 1], [0.46, 0.7, 0, 0.28], [0.18, 0.42, 0.52, 0]] },
  l: { w: 0.14, s: [[0.06, 1, 0.06, 0.08, 0.14, 0]] },
  m: {
    w: 0.86,
    s: [
      [0, 0, 0, 0.7],
      [0, 0.42, ...arc(0.21, 0.44, 0.21, 0.26, 180, 0, 8), 0.42, 0],
      [0.42, 0.42, ...arc(0.64, 0.44, 0.22, 0.26, 180, 0, 8), 0.86, 0],
    ],
  },
  n: { w: 0.54, s: [[0, 0, 0, 0.7], [0, 0.42, ...arc(0.27, 0.42, 0.27, 0.28, 180, 0, 10), 0.54, 0]] },
  o: { w: 0.56, s: [arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18)] },
  p: { w: 0.56, s: [[0, -0.3, 0, 0.7], arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18)] },
  q: { w: 0.56, s: [[0.56, -0.3, 0.56, 0.7], arc(0.28, 0.35, 0.28, 0.35, 0, 360, 18)] },
  r: { w: 0.38, s: [[0, 0, 0, 0.7], [0, 0.44, ...arc(0.2, 0.46, 0.2, 0.24, 180, 55, 6)]] },
  s: {
    w: 0.48,
    s: [
      [
        ...arc(0.24, 0.52, 0.24, 0.18, 60, 200, 8),
        ...arc(0.24, 0.18, 0.24, 0.18, 110, -80, 8),
      ],
    ],
  },
  t: {
    w: 0.36,
    s: [[0.12, 0.92, 0.12, 0.14, ...arc(0.22, 0.14, 0.12, 0.14, 180, -80, 6)], [0, 0.7, 0.3, 0.7]],
  },
  u: {
    w: 0.54,
    s: [[0, 0.7, 0, 0.28, ...arc(0.27, 0.28, 0.27, 0.28, 180, 360, 10), 0.54, 0.7], [0.54, 0.7, 0.54, 0]],
  },
  v: { w: 0.52, s: [[0, 0.7, 0.26, 0, 0.52, 0.7]] },
  w: { w: 0.74, s: [[0, 0.7, 0.16, 0, 0.37, 0.5, 0.58, 0, 0.74, 0.7]] },
  x: { w: 0.5, s: [[0, 0.7, 0.5, 0], [0, 0, 0.5, 0.7]] },
  y: { w: 0.52, s: [[0, 0.7, 0.26, 0], [0.52, 0.7, 0.12, -0.3]] },
  z: { w: 0.48, s: [[0, 0.7, 0.48, 0.7, 0, 0, 0.48, 0]] },

  // ── figures ───────────────────────────────────────────────────────────────
  '0': { w: 0.6, s: [arc(0.3, 0.5, 0.3, 0.5, 0, 360, 20)] },
  '1': { w: 0.34, s: [[0.04, 0.78, 0.24, 1, 0.24, 0]] },
  '2': { w: 0.6, s: [[...arc(0.3, 0.72, 0.3, 0.28, 175, -25, 12), 0, 0, 0.6, 0]] },
  '3': {
    w: 0.6,
    s: [
      [
        ...arc(0.3, 0.74, 0.3, 0.26, 150, -85, 10),
        ...arc(0.3, 0.26, 0.3, 0.26, 85, -150, 10),
      ],
    ],
  },
  '4': { w: 0.64, s: [[0.44, 0, 0.44, 1, 0, 0.28, 0.64, 0.28]] },
  '5': { w: 0.6, s: [[0.58, 1, 0.08, 1, 0.05, 0.55], [0.05, 0.55, ...arc(0.3, 0.28, 0.3, 0.28, 100, -115, 12)]] },
  '6': { w: 0.6, s: [arc(0.3, 0.28, 0.3, 0.28, 0, 360, 18), [0, 0.28, 0.14, 0.86, 0.5, 1]] },
  '7': { w: 0.58, s: [[0, 1, 0.58, 1, 0.2, 0]] },
  '8': {
    w: 0.6,
    s: [arc(0.3, 0.74, 0.27, 0.26, 0, 360, 16), arc(0.3, 0.26, 0.3, 0.26, 0, 360, 16)],
  },
  '9': { w: 0.6, s: [arc(0.3, 0.72, 0.3, 0.28, 0, 360, 18), [0.6, 0.72, 0.46, 0.14, 0.1, 0]] },

  // ── punctuation ───────────────────────────────────────────────────────────
  //
  // EVERY PRINTABLE ASCII CHARACTER, and the completeness is the point rather
  // than a flourish. The table used to stop after fifteen marks, so `=`, `%`,
  // `*`, `@`, the brackets and the rest came back as "the studio has no letter
  // for that" — a refusal about a character any laser cuts happily, and the
  // only thing on offer was to cut the wording short. A skeleton is cheap; a
  // shopper deleting half a name because a table was short is not.
  //
  // `template.test.ts`'s coverage case walks codes 32…126 and NAMES whichever
  // are missing, so a character with a measured advance in `faces.ts` can never
  // again be one this file has no shape for. It used to assert a list of
  // seventeen expected absentees, which is a coverage test that passes by
  // agreeing with the hole.
  '.': { w: 0.1, s: [dot(0.05, 0.05)] },
  ',': { w: 0.12, s: [[0.09, 0.09, 0.09, 0.01, 0.0, -0.14]] },
  "'": { w: 0.1, s: [[0.05, 1, 0.05, 0.76]] },
  '"': { w: 0.2, s: [[0.03, 1, 0.03, 0.76], [0.17, 1, 0.17, 0.76]] },
  '-': { w: 0.34, s: [[0, 0.44, 0.34, 0.44]] },
  '!': { w: 0.12, s: [[0.06, 1, 0.06, 0.24], dot(0.06, 0.05)] },
  '?': {
    w: 0.54,
    s: [[...arc(0.27, 0.74, 0.27, 0.26, 175, -35, 10), 0.27, 0.3], dot(0.27, 0.05)],
  },
  ':': { w: 0.12, s: [dot(0.06, 0.05), dot(0.06, 0.5)] },
  ';': { w: 0.12, s: [dot(0.06, 0.5), [0.09, 0.09, 0.09, 0.01, 0.0, -0.14]] },
  '(': { w: 0.28, s: [arc(0.34, 0.5, 0.3, 0.62, 118, 242, 10)] },
  ')': { w: 0.28, s: [arc(-0.06, 0.5, 0.3, 0.62, -62, 62, 10)] },
  '/': { w: 0.44, s: [[0, 0, 0.44, 1]] },
  '&': {
    w: 0.74,
    s: [[...arc(0.26, 0.8, 0.22, 0.2, 20, 340, 12), 0.06, 0.46, 0.62, 0, 0.74, 0.18]],
  },
  '+': { w: 0.5, s: [[0.25, 0.16, 0.25, 0.74], [0, 0.45, 0.5, 0.45]] },
  '#': {
    w: 0.62,
    s: [[0.18, 0, 0.24, 0.86], [0.4, 0, 0.46, 0.86], [0.04, 0.26, 0.6, 0.26], [0.06, 0.6, 0.62, 0.6]],
  },
  '=': { w: 0.5, s: [[0, 0.58, 0.5, 0.58], [0, 0.32, 0.5, 0.32]] },
  '<': { w: 0.5, s: [[0.46, 0.78, 0.06, 0.45, 0.46, 0.12]] },
  '>': { w: 0.5, s: [[0.04, 0.78, 0.44, 0.45, 0.04, 0.12]] },
  '*': {
    w: 0.5,
    s: [[0.25, 0.96, 0.25, 0.44], [0.03, 0.83, 0.47, 0.57], [0.03, 0.57, 0.47, 0.83]],
  },
  '%': {
    w: 0.8,
    s: [
      arc(0.16, 0.8, 0.15, 0.16, 0, 360, 12),
      arc(0.64, 0.2, 0.15, 0.16, 0, 360, 12),
      [0.04, 0, 0.76, 1],
    ],
  },
  $: {
    w: 0.62,
    s: [
      [
        ...arc(0.31, 0.74, 0.31, 0.26, 60, 200, 10),
        ...arc(0.31, 0.26, 0.31, 0.26, 110, -80, 10),
      ],
      // The stem runs a touch past the bowl top and bottom, the way it does in
      // metal type — but only as far as the alphabet's own stated envelope, and
      // not one thousandth further. It was drawn to 1.06 and the envelope stops
      // at 1.05, which is not a rounding difference on a laser: everything
      // placing this alphabet — the zone fit, the production sheet's own
      // bounds — is computed from the envelope, so a glyph outside it is ink
      // nobody reserved room for.
      [0.31, 1.05, 0.31, -0.05],
    ],
  },
  '@': {
    w: 0.86,
    s: [
      arc(0.43, 0.5, 0.43, 0.5, -40, 300, 22),
      arc(0.44, 0.44, 0.16, 0.17, 0, 360, 12),
      [0.6, 0.44, 0.6, 0.28],
    ],
  },
  '[': { w: 0.28, s: [[0.24, 1, 0.06, 1, 0.06, -0.05, 0.24, -0.05]] },
  ']': { w: 0.28, s: [[0.04, 1, 0.22, 1, 0.22, -0.05, 0.04, -0.05]] },
  '{': {
    w: 0.3,
    s: [[0.28, 1, 0.16, 0.94, 0.16, 0.56, 0.04, 0.48, 0.16, 0.4, 0.16, 0.01, 0.28, -0.05]],
  },
  '}': {
    w: 0.3,
    s: [[0.02, 1, 0.14, 0.94, 0.14, 0.56, 0.26, 0.48, 0.14, 0.4, 0.14, 0.01, 0.02, -0.05]],
  },
  '|': { w: 0.1, s: [[0.05, 1.05, 0.05, -0.16]] },
  '\\': { w: 0.44, s: [[0, 1, 0.44, 0]] },
  '^': { w: 0.5, s: [[0.03, 0.72, 0.25, 1, 0.47, 0.72]] },
  _: { w: 0.5, s: [[0, -0.14, 0.5, -0.14]] },
  '`': { w: 0.2, s: [[0.02, 1, 0.18, 0.82]] },
  '~': { w: 0.52, s: [[0, 0.44, 0.13, 0.56, 0.26, 0.44, 0.39, 0.32, 0.52, 0.44]] },
};

/**
 * WHAT THE STUDIO CUTS IN PLACE OF A MARK IT HAS NO SHAPE FOR.
 *
 * A shopper's keyboard, and every word processor they might paste out of,
 * writes typographic marks: the curly apostrophe in O’Brien, the em dash, the
 * ellipsis, the middle dot. None of them is ASCII, so none of them is in the
 * table above and none of them has a measured advance — and the answer used to
 * be a refusal whose only way out was to cut the wording short at the mark.
 * Deleting the second half of somebody's surname because their keyboard chose
 * a rounder apostrophe is not a remedy.
 *
 * So each one names the mark the studio WOULD cut in its place, and the surface
 * offers exactly that, as a button that says what it will do. It is a shopper's
 * decision rather than a silent rewrite: what a customer typed is what a shop
 * quotes back at them, and swapping a character under them without saying so
 * is how a name comes back cut wrong.
 *
 * Only exact equivalents are here. A letter with no plain form — `é`, and every
 * letter of a script this alphabet does not carry — is NOT in this table, and
 * `template.ts` says so in words instead of inventing a lookalike.
 */
export const SUBSTITUTES: Readonly<Record<string, string>> = {
  '‘': "'", // ‘ left single quote
  '’': "'", // ’ right single quote, the apostrophe in O’Brien
  '‚': ',', // ‚ single low quote
  '‛': "'", // ‛ reversed single quote
  '′': "'", // ′ prime
  '“': '"', // “ left double quote
  '”': '"', // ” right double quote
  '„': '"', // „ double low quote
  '″': '"', // ″ double prime
  '«': '"', // « left guillemet
  '»': '"', // » right guillemet
  '‐': '-', // ‐ hyphen
  '‑': '-', // ‑ non-breaking hyphen
  '‒': '-', // ‒ figure dash
  '–': '-', // – en dash
  '—': '-', // — em dash
  '−': '-', // − minus sign
  '…': '...', // … ellipsis
  '·': '.', // · middle dot
  '•': '.', // • bullet
  '×': 'x', // × multiplication sign
  '⁄': '/', // ⁄ fraction slash
  '\u00A0': ' ', // no-break space
  '\u2009': ' ', // thin space
  '\u202F': ' ', // narrow no-break space
};

/** The mark the studio cuts in place of this one, if there is an exact one. */
export function substituteFor(ch: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(SUBSTITUTES, ch) ? SUBSTITUTES[ch] : undefined;
}

/** Does the studio have a letter for this character? */
export function hasGlyph(ch: string): boolean {
  return Object.prototype.hasOwnProperty.call(GLYPHS, ch);
}

/**
 * A skeleton polyline offset to a CLOSED CONTOUR, `half` either side.
 *
 * Miter joins, clamped: a sharp corner in a letter like `V` would otherwise
 * throw its outline several cap heights out into the sheet, which on a laser is
 * not an ugly join, it is a cut through the piece. The clamp is 2.6 — beyond
 * that the join is squared off, which is what a bevel would have done anyway.
 *
 * OPEN POLYLINES ONLY, AND THAT IS WHY `o` WORKS. A ring drawn as one polyline
 * whose last point returns to its first offsets into a single closed polygon
 * that runs the whole way round the outside and back round the inside — an
 * annulus, filled correctly by either fill rule, with a seam one stroke wide
 * where it started. One code path for a straight stroke and a bowl.
 */
export function outlinePolyline(points: readonly number[], half: number): number[] {
  const n = points.length / 2;
  if (n < 2) return [];

  const px = (i: number) => points[i * 2]!;
  const py = (i: number) => points[i * 2 + 1]!;

  /** Unit normal of segment i → i+1, rotated left. */
  const normals: [number, number][] = [];
  for (let i = 0; i < n - 1; i += 1) {
    const dx = px(i + 1) - px(i);
    const dy = py(i + 1) - py(i);
    const len = Math.hypot(dx, dy) || 1;
    normals.push([-dy / len, dx / len]);
  }

  const offsetAt = (i: number, side: 1 | -1): [number, number] => {
    const a = normals[Math.max(0, i - 1)]!;
    const b = normals[Math.min(normals.length - 1, i)]!;
    let mx = a[0] + b[0];
    let my = a[1] + b[1];
    const len = Math.hypot(mx, my);
    if (len < 1e-6) {
      // A perfect reversal — the skeleton doubles back on itself. Fall back to
      // the incoming normal rather than dividing by nothing.
      mx = a[0];
      my = a[1];
    } else {
      mx /= len;
      my /= len;
      const cos = mx * b[0] + my * b[1];
      const miter = Math.min(2.6, 1 / Math.max(0.12, cos));
      mx *= miter;
      my *= miter;
    }
    return [round(px(i) + side * mx * half), round(py(i) + side * my * half)];
  };

  const out: number[] = [];
  for (let i = 0; i < n; i += 1) out.push(...offsetAt(i, 1));
  for (let i = n - 1; i >= 0; i -= 1) out.push(...offsetAt(i, -1));
  out.push(out[0]!, out[1]!);
  return out;
}
