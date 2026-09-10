/**
 * WinAnsiEncoding and Helvetica's widths — the two tables a base-14 PDF needs
 * and the only two this package carries.
 *
 * ── WHY THE FULL TABLE, WHEN `barcode-labels` GETS BY WITH ONE NUMBER ──────
 *
 * That package built its layout so it needed exactly one width: Helvetica
 * gives every digit the same 556-unit advance, so a sheet of numbers can be
 * centred without a metrics file (`sheet.ts:118-135`). An invoice cannot do
 * that. It right-aligns money in a column, wraps a description to a width, and
 * puts a customer's name next to a label — none of which is possible without
 * knowing how wide `M` is against `l`. So the table is here: 224 entries, the
 * drawable half of WinAnsiEncoding, taken from Adobe's Helvetica AFM.
 *
 * ── AND WHY THE COVERAGE IS `winansi`, NOT `all` ───────────────────────────
 *
 * A base-14 font has no Arabic, no Han, no Cyrillic and no Greek. Embedding a
 * face that did would mean shipping a font file — megabytes, a licence to
 * honour, and a subsetter — inside an add-on whose whole claim is that it
 * fetches nothing and depends on nothing (25 D11). So this writer draws what
 * Helvetica draws and REFUSES the rest, typed, naming the glyphs
 * (`DocumentError.LATIN_ONLY`, 34 D6/O12). HTML has no such limit and renders
 * all eight locales; the refusal is the PDF writer's alone, and the
 * conformance suite asserts exactly that by rendering the same subject to HTML
 * and requiring it to succeed.
 *
 * The document languages this covers, at v1: English, German, French,
 * Spanish, Portuguese and Danish. The one it does not is Japanese, which the
 * surface makes a first-class document language (34 D49) — a `ja` document
 * gets HTML and a browser's own Save-as-PDF, and says so rather than
 * producing a page of blanks.
 */

/**
 * The code points WinAnsiEncoding puts in 0x80..0x9F, where Latin-1 has
 * control characters and Windows put punctuation. Everything else in the
 * encoding is its own Unicode value, which is why only these need a map.
 */
const HIGH_PUNCTUATION: Readonly<Record<string, number>> = {
  '€': 0x80, // €
  '‚': 0x82, // ‚
  'ƒ': 0x83, // ƒ
  '„': 0x84, // „
  '…': 0x85, // …
  '†': 0x86, // †
  '‡': 0x87, // ‡
  'ˆ': 0x88, // ˆ
  '‰': 0x89, // ‰
  'Š': 0x8a, // Š
  '‹': 0x8b, // ‹
  'Œ': 0x8c, // Œ
  'Ž': 0x8e, // Ž
  '‘': 0x91, // '
  '’': 0x92, // '
  '“': 0x93, // "
  '”': 0x94, // "
  '•': 0x95, // •
  '–': 0x96, // –
  '—': 0x97, // —
  '˜': 0x98, // ˜
  '™': 0x99, // ™
  'š': 0x9a, // š
  '›': 0x9b, // ›
  'œ': 0x9c, // œ
  'ž': 0x9e, // ž
  'Ÿ': 0x9f, // Ÿ
};

/**
 * THE ONE SUBSTITUTION TABLE, AND THE RULE THAT KEEPS IT FROM GROWING.
 *
 * A character goes in here ONLY when its replacement is the same character in
 * a different typographic form — same meaning, same reading, a different
 * shape. Nothing that is merely "close enough" is eligible, and there is no
 * catch-all: an unmapped character the encoding cannot draw is still `null`,
 * still refused, still named in `LATIN_ONLY` (34 D6). A table that started
 * accepting approximations would be a silent-drop mechanism wearing a
 * different name.
 *
 * ── WHY IT EXISTS AT ALL ───────────────────────────────────────────────────
 *
 * `formatMoney` writes a negative amount with U+2212 MINUS SIGN, because that
 * is the correct character for arithmetic and it is what the editor shows and
 * the surface stores. U+2212 is not in WinAnsiEncoding. Without this table
 * every invoice carrying a reduction — which is most of them — was refused
 * for PDF with `dropped: ['−']`, while rendering perfectly in HTML. Found by
 * the conformance suite on 2026-09-10, on the first document that had a
 * discount.
 *
 * The alternative was changing `formatMoney`. That function is one of three
 * byte-identical copies held together by `money-fixture.json`, and the fixture
 * pins `"−€204.12"` — so "fixing" it here would have silently changed what the
 * editor and the server print, to work around a limit that belongs to one
 * output format. A rendering limit is the renderer's to solve.
 */
const TYPOGRAPHIC_EQUIVALENTS: Readonly<Record<string, string>> = {
  '\u2212': '-', // MINUS SIGN → HYPHEN-MINUS. Same operator, drawable shape.
  '\u2010': '-', // HYPHEN → HYPHEN-MINUS.
  '\u2011': '-', // NON-BREAKING HYPHEN → HYPHEN-MINUS.
  '\u2044': '/', // FRACTION SLASH → SOLIDUS.
  '\u202f': ' ', // NARROW NO-BREAK SPACE → SPACE. A space is a space.
};

/**
 * The byte WinAnsiEncoding gives a character, or `null` when it draws none.
 *
 * `null` and not a fallback glyph, on purpose. A writer that substituted `?`
 * for `ü` would produce a file every viewer opens and every reader misreads —
 * and the name on an invoice is the one string where that matters most.
 *
 * The typographic table above is consulted LAST, so it can only ever rescue a
 * character the encoding would otherwise refuse. Every caller goes through
 * here — the coverage check, the width measurement and the string writer —
 * which is what stops the three from disagreeing about what is drawable.
 */
export function winAnsiByte(character: string): number | null {
  const code = character.codePointAt(0) ?? 0;
  // 0xA0 is a no-break space and 0xAD a soft hyphen; both are drawable and
  // both are in the printable Latin-1 run.
  if (code >= 0x20 && code <= 0x7e) return code;
  if (code >= 0xa0 && code <= 0xff) return code;
  const mapped = HIGH_PUNCTUATION[character];
  if (mapped !== undefined) return mapped;
  const equivalent = TYPOGRAPHIC_EQUIVALENTS[character];
  return equivalent === undefined ? null : (equivalent.codePointAt(0) ?? null);
}

/** Every character the substitution table rescues, for a suite to enumerate. */
export const SUBSTITUTED_CHARACTERS: readonly string[] = Object.keys(TYPOGRAPHIC_EQUIVALENTS);

/**
 * Every distinct character of `text` this encoding cannot draw, in the order
 * it first appears.
 *
 * Distinct, and in order, because the list goes in front of a person: `['ü']`
 * tells somebody which key to look for, and `['ü','ü','ü']` tells them
 * nothing more. Whitespace is skipped — a tab in a description is not a glyph
 * anybody needs to be told about.
 */
export function undrawnCharacters(text: string): readonly string[] {
  const dropped: string[] = [];
  for (const character of text) {
    if (character === '\n' || character === '\r' || character === '\t') continue;
    if (winAnsiByte(character) !== null) continue;
    if (!dropped.includes(character)) dropped.push(character);
  }
  return dropped;
}

/**
 * Helvetica's advance widths, in 1000ths of an em, by WinAnsi byte.
 *
 * From Adobe's `Helvetica.afm` (the core-14 metrics, which every conforming
 * PDF consumer already has — that is what "base 14" means and why no font
 * file ships here). 224 entries: 0x20..0x7E, the 27 mapped punctuation marks
 * of 0x80..0x9F, and 0xA0..0xFF.
 *
 * WHAT DEPENDS ON THESE BEING RIGHT: every right-aligned figure on the page.
 * A wrong width does not crash anything — it puts the decimal points of a
 * money column slightly out of line, which is the kind of defect that ships.
 * `writer.test.ts` pins the total advance of a known string against a
 * hand-checked number for exactly that reason.
 */
export const HELVETICA_WIDTHS: Readonly<Record<number, number>> = {
  0x20: 278, 0x21: 278, 0x22: 355, 0x23: 556, 0x24: 556, 0x25: 889, 0x26: 667, 0x27: 191,
  0x28: 333, 0x29: 333, 0x2a: 389, 0x2b: 584, 0x2c: 278, 0x2d: 333, 0x2e: 278, 0x2f: 278,
  0x30: 556, 0x31: 556, 0x32: 556, 0x33: 556, 0x34: 556, 0x35: 556, 0x36: 556, 0x37: 556,
  0x38: 556, 0x39: 556, 0x3a: 278, 0x3b: 278, 0x3c: 584, 0x3d: 584, 0x3e: 584, 0x3f: 556,
  0x40: 1015, 0x41: 667, 0x42: 667, 0x43: 722, 0x44: 722, 0x45: 667, 0x46: 611, 0x47: 778,
  0x48: 722, 0x49: 278, 0x4a: 500, 0x4b: 667, 0x4c: 556, 0x4d: 833, 0x4e: 722, 0x4f: 778,
  0x50: 667, 0x51: 778, 0x52: 722, 0x53: 667, 0x54: 611, 0x55: 722, 0x56: 667, 0x57: 944,
  0x58: 667, 0x59: 667, 0x5a: 611, 0x5b: 278, 0x5c: 278, 0x5d: 278, 0x5e: 469, 0x5f: 556,
  0x60: 333, 0x61: 556, 0x62: 556, 0x63: 500, 0x64: 556, 0x65: 556, 0x66: 278, 0x67: 556,
  0x68: 556, 0x69: 222, 0x6a: 222, 0x6b: 500, 0x6c: 222, 0x6d: 833, 0x6e: 556, 0x6f: 556,
  0x70: 556, 0x71: 556, 0x72: 333, 0x73: 500, 0x74: 278, 0x75: 556, 0x76: 500, 0x77: 722,
  0x78: 500, 0x79: 500, 0x7a: 500, 0x7b: 334, 0x7c: 260, 0x7d: 334, 0x7e: 584,
  0x80: 556, 0x82: 222, 0x83: 556, 0x84: 333, 0x85: 1000, 0x86: 556, 0x87: 556, 0x88: 333,
  0x89: 1000, 0x8a: 667, 0x8b: 333, 0x8c: 1000, 0x8e: 611, 0x91: 222, 0x92: 222, 0x93: 333,
  0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x98: 333, 0x99: 1000, 0x9a: 500, 0x9b: 333,
  0x9c: 944, 0x9e: 500, 0x9f: 667,
  0xa0: 278, 0xa1: 333, 0xa2: 556, 0xa3: 556, 0xa4: 556, 0xa5: 556, 0xa6: 260, 0xa7: 556,
  0xa8: 333, 0xa9: 737, 0xaa: 370, 0xab: 556, 0xac: 584, 0xad: 333, 0xae: 737, 0xaf: 333,
  0xb0: 400, 0xb1: 584, 0xb2: 333, 0xb3: 333, 0xb4: 333, 0xb5: 556, 0xb6: 537, 0xb7: 278,
  0xb8: 333, 0xb9: 333, 0xba: 365, 0xbb: 556, 0xbc: 834, 0xbd: 834, 0xbe: 834, 0xbf: 611,
  0xc0: 667, 0xc1: 667, 0xc2: 667, 0xc3: 667, 0xc4: 667, 0xc5: 667, 0xc6: 1000, 0xc7: 722,
  0xc8: 667, 0xc9: 667, 0xca: 667, 0xcb: 667, 0xcc: 278, 0xcd: 278, 0xce: 278, 0xcf: 278,
  0xd0: 722, 0xd1: 722, 0xd2: 778, 0xd3: 778, 0xd4: 778, 0xd5: 778, 0xd6: 778, 0xd7: 584,
  0xd8: 778, 0xd9: 722, 0xda: 722, 0xdb: 722, 0xdc: 722, 0xdd: 667, 0xde: 667, 0xdf: 611,
  0xe0: 556, 0xe1: 556, 0xe2: 556, 0xe3: 556, 0xe4: 556, 0xe5: 556, 0xe6: 889, 0xe7: 500,
  0xe8: 556, 0xe9: 556, 0xea: 556, 0xeb: 556, 0xec: 278, 0xed: 278, 0xee: 278, 0xef: 278,
  0xf0: 556, 0xf1: 556, 0xf2: 556, 0xf3: 556, 0xf4: 556, 0xf5: 556, 0xf6: 556, 0xf7: 584,
  0xf8: 611, 0xf9: 556, 0xfa: 556, 0xfb: 556, 0xfc: 556, 0xfd: 500, 0xfe: 556, 0xff: 500,
};

/** Helvetica-Bold, for the headings and the total. Same encoding, wider stems. */
export const HELVETICA_BOLD_WIDTHS: Readonly<Record<number, number>> = {
  0x20: 278, 0x21: 333, 0x22: 474, 0x23: 556, 0x24: 556, 0x25: 889, 0x26: 722, 0x27: 238,
  0x28: 333, 0x29: 333, 0x2a: 389, 0x2b: 584, 0x2c: 278, 0x2d: 333, 0x2e: 278, 0x2f: 278,
  0x30: 556, 0x31: 556, 0x32: 556, 0x33: 556, 0x34: 556, 0x35: 556, 0x36: 556, 0x37: 556,
  0x38: 556, 0x39: 556, 0x3a: 333, 0x3b: 333, 0x3c: 584, 0x3d: 584, 0x3e: 584, 0x3f: 611,
  0x40: 975, 0x41: 722, 0x42: 722, 0x43: 722, 0x44: 722, 0x45: 667, 0x46: 611, 0x47: 778,
  0x48: 722, 0x49: 278, 0x4a: 556, 0x4b: 722, 0x4c: 611, 0x4d: 833, 0x4e: 722, 0x4f: 778,
  0x50: 667, 0x51: 778, 0x52: 722, 0x53: 667, 0x54: 611, 0x55: 722, 0x56: 667, 0x57: 944,
  0x58: 667, 0x59: 667, 0x5a: 611, 0x5b: 333, 0x5c: 278, 0x5d: 333, 0x5e: 584, 0x5f: 556,
  0x60: 333, 0x61: 556, 0x62: 611, 0x63: 556, 0x64: 611, 0x65: 556, 0x66: 333, 0x67: 611,
  0x68: 611, 0x69: 278, 0x6a: 278, 0x6b: 556, 0x6c: 278, 0x6d: 889, 0x6e: 611, 0x6f: 611,
  0x70: 611, 0x71: 611, 0x72: 389, 0x73: 556, 0x74: 333, 0x75: 611, 0x76: 556, 0x77: 778,
  0x78: 556, 0x79: 556, 0x7a: 500, 0x7b: 389, 0x7c: 280, 0x7d: 389, 0x7e: 584,
  0x80: 556, 0x82: 278, 0x83: 556, 0x84: 500, 0x85: 1000, 0x86: 556, 0x87: 556, 0x88: 333,
  0x89: 1000, 0x8a: 667, 0x8b: 333, 0x8c: 1000, 0x8e: 611, 0x91: 278, 0x92: 278, 0x93: 500,
  0x94: 500, 0x95: 350, 0x96: 556, 0x97: 1000, 0x98: 333, 0x99: 1000, 0x9a: 556, 0x9b: 333,
  0x9c: 944, 0x9e: 500, 0x9f: 667,
  0xa0: 278, 0xa1: 333, 0xa2: 556, 0xa3: 556, 0xa4: 556, 0xa5: 556, 0xa6: 280, 0xa7: 556,
  0xa8: 333, 0xa9: 737, 0xaa: 370, 0xab: 556, 0xac: 584, 0xad: 333, 0xae: 737, 0xaf: 333,
  0xb0: 400, 0xb1: 584, 0xb2: 333, 0xb3: 333, 0xb4: 333, 0xb5: 611, 0xb6: 556, 0xb7: 278,
  0xb8: 333, 0xb9: 333, 0xba: 365, 0xbb: 556, 0xbc: 834, 0xbd: 834, 0xbe: 834, 0xbf: 611,
  0xc0: 722, 0xc1: 722, 0xc2: 722, 0xc3: 722, 0xc4: 722, 0xc5: 722, 0xc6: 1000, 0xc7: 722,
  0xc8: 667, 0xc9: 667, 0xca: 667, 0xcb: 667, 0xcc: 278, 0xcd: 278, 0xce: 278, 0xcf: 278,
  0xd0: 722, 0xd1: 722, 0xd2: 778, 0xd3: 778, 0xd4: 778, 0xd5: 778, 0xd6: 778, 0xd7: 584,
  0xd8: 778, 0xd9: 722, 0xda: 722, 0xdb: 722, 0xdc: 722, 0xdd: 667, 0xde: 667, 0xdf: 611,
  0xe0: 556, 0xe1: 556, 0xe2: 556, 0xe3: 556, 0xe4: 556, 0xe5: 556, 0xe6: 889, 0xe7: 556,
  0xe8: 556, 0xe9: 556, 0xea: 556, 0xeb: 556, 0xec: 278, 0xed: 278, 0xee: 278, 0xef: 278,
  0xf0: 611, 0xf1: 611, 0xf2: 611, 0xf3: 611, 0xf4: 611, 0xf5: 611, 0xf6: 611, 0xf7: 584,
  0xf8: 611, 0xf9: 611, 0xfa: 611, 0xfb: 611, 0xfc: 611, 0xfd: 556, 0xfe: 611, 0xff: 556,
};

export type FontWeight = 'regular' | 'bold';

const WIDTHS: Readonly<Record<FontWeight, Readonly<Record<number, number>>>> = {
  regular: HELVETICA_WIDTHS,
  bold: HELVETICA_BOLD_WIDTHS,
};

/**
 * How wide `text` is at `sizePt`, in points.
 *
 * An undrawable character contributes ZERO rather than a default width, and
 * that is deliberate: by the time anything calls this, `undrawnCharacters` has
 * already been run and the document refused, so a non-zero fallback here could
 * only ever paper over a missing check.
 */
export function widthOf(text: string, sizePt: number, weight: FontWeight = 'regular'): number {
  const table = WIDTHS[weight];
  let units = 0;
  for (const character of text) {
    const byte = winAnsiByte(character);
    if (byte === null) continue;
    units += table[byte] ?? 0;
  }
  return (units * sizePt) / 1000;
}
