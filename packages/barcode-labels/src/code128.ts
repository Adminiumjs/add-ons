/**
 * CODE 128, SET B, WRITTEN OUT.
 *
 * ── WHY SET B AND ONLY SET B ───────────────────────────────────────────────
 *
 * Code 128 has three character sets and can switch between them mid-symbol: A
 * carries control characters and upper case, B carries the printable ASCII a
 * keyboard produces, C packs two digits into one symbol character and halves
 * the width of a long run of them. A general encoder chooses between them per
 * character and is a small optimiser.
 *
 * This one does not, and the reason is what an add-on is for rather than
 * laziness. What a shop types into the form in `ui/SettingsPanel.tsx` is a
 * catalogue reference it already uses on its own paperwork — `ADM-4417`,
 * `WAL-COAST-06` — and every character of every such reference is in set B. Set
 * C would save modules only on a code that is all digits, and a code that is
 * all digits and thirteen long is an EAN-13, which this add-on already draws
 * correctly at a size a scanner expects. Set A buys nothing at all: a control
 * character in a catalogue reference is not a thing.
 *
 * So the encoder is one set, no shifts, no switches, and the code is short
 * enough to be read against a published table. THE COST IS STATED WHERE IT IS
 * FELT: a code with a character set B has no symbol for is REFUSED, in words,
 * by `codes.ts`, naming the character. An encoder that silently dropped it
 * would put a barcode on a label that scans as a different reference from the
 * one printed underneath it.
 *
 * ── THE SHAPE ──────────────────────────────────────────────────────────────
 *
 *     start B              11 modules
 *     one per character    11 modules each
 *     checksum             11 modules
 *     stop                 13 modules
 *
 * Every symbol character is eleven modules wide and is written as SIX WIDTHS —
 * bar, space, bar, space, bar, space — summing to eleven. The stop pattern is
 * the exception and carries a seventh element, a final bar two modules wide,
 * which is why it is thirteen.
 *
 * ── THE TABLE IS CHECKED RATHER THAN TRUSTED ───────────────────────────────
 *
 * A hundred and seven six-digit strings is exactly the kind of thing that gets
 * one character wrong in transcription, and a wrong pattern draws a symbol that
 * scans as a different character with no visible sign. `code128.test.ts`
 * therefore asserts three structural facts of the published table, every one of
 * which a typo breaks:
 *
 *   · every pattern is six widths summing to eleven;
 *   · the three BAR widths of every pattern sum to an EVEN number — this is the
 *     self-checking property the symbology is built on, and it holds for all
 *     107 entries and for no accidental value;
 *   · all 107 are distinct, so no two characters draw alike.
 *
 * Those three together will not catch a swap of two whole valid patterns, so
 * the suite also pins a published encoding end to end — see its own header.
 */

import type { Modules } from './modules.ts';

/**
 * The 107 element-width patterns, indexed by symbol value.
 *
 * Six digits per entry, read as bar, space, bar, space, bar, space. Values 0 to
 * 102 are the character set; 103 to 105 are the three start codes; 106 is stop.
 */
export const PATTERNS: readonly string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '233111',
];

/** The symbol value that opens a set B symbol. */
export const START_B = 104;
/** The symbol value that closes any Code 128 symbol. */
export const STOP = 106;

/**
 * THE TERMINATING BAR, and why it is a separate constant.
 *
 * Every other pattern is six elements; the stop is seven, and the seventh is a
 * bar two modules wide that no table prints inside the six-digit column because
 * it does not fit the column. Writing `'2331112'` into the table would have
 * made `PATTERNS[106]` the one entry that fails the "six widths summing to
 * eleven" check the suite runs over all of them, and the honest repair is not
 * to exempt the entry — it is to keep the table uniform and carry the extra
 * element where it belongs.
 */
export const STOP_FINAL_BAR = 2;

/** The lowest and highest character codes set B can draw, inclusive. */
export const SET_B_FIRST = 32;
export const SET_B_LAST = 126;

/** Can set B draw every character of this text? */
export function isSetB(text: string): boolean {
  for (const character of text) {
    const at = character.codePointAt(0)!;
    if (at < SET_B_FIRST || at > SET_B_LAST) return false;
  }
  return true;
}

/** The first character set B has no symbol for, or `undefined` if it has them all. */
export function firstUndrawable(text: string): string | undefined {
  for (const character of text) {
    const at = character.codePointAt(0)!;
    if (at < SET_B_FIRST || at > SET_B_LAST) return character;
  }
  return undefined;
}

/** A set B character's symbol value: its ASCII code, less the space's 32. */
export function symbolValuesOf(text: string): readonly number[] {
  return [...text].map((character) => character.codePointAt(0)! - SET_B_FIRST);
}

/**
 * THE CHECKSUM, WHICH IS A WEIGHTED SUM MODULO 103.
 *
 * The start code counts once; each data character counts once for every place
 * it sits from the start, beginning at one. The result is a symbol value like
 * any other and is drawn from the same table, which is why a wrong checksum
 * produces a symbol that looks completely ordinary and scans as nothing.
 *
 * 103 rather than 107, and a reader should stop at that. The modulus is the
 * size of the CHARACTER SET, not of the table: values 103 to 106 are the starts
 * and the stop, and a checksum can never be one of them because they are not
 * things a symbol carries in the middle. Using 107 would be the kind of mistake
 * that works for most inputs.
 */
export function checksumFor(values: readonly number[]): number {
  let sum = START_B;
  values.forEach((value, place) => {
    sum += value * (place + 1);
  });
  return sum % 103;
}

/** One symbol value's eleven (or thirteen) modules, bar first. */
export function modulesForValue(value: number): Modules {
  const widths = value === STOP ? `${PATTERNS[STOP]!}${STOP_FINAL_BAR}` : PATTERNS[value]!;
  let out = '';
  let dark = true;
  for (const width of widths) {
    out += (dark ? '1' : '0').repeat(Number(width));
    dark = !dark;
  }
  return out;
}

/**
 * The whole symbol-value sequence, start and checksum and stop included.
 *
 * Exported beside `encodeCode128` because it is the form a published example is
 * written in — "Wikipedia" is `104 55 73 75 73 80 69 68 73 65 88 106` in every
 * account of this symbology — so a suite can pin the sequence and the modules
 * separately and say which of the two is wrong when one moves.
 */
export function symbolSequence(text: string): readonly number[] {
  const values = symbolValuesOf(text);
  return [START_B, ...values, checksumFor(values), STOP];
}

/**
 * Text to modules.
 *
 * THROWS on a character set B cannot draw, for the reason `encodeEan13` gives:
 * every code reaching here has been through the refusal in `codes.ts`, so the
 * only way to arrive with something else is a defect in this package, and a
 * silently-dropped character is a label whose bars and whose printed text
 * disagree.
 */
export function encodeCode128(text: string): Modules {
  const undrawable = firstUndrawable(text);
  if (text.length === 0 || undrawable !== undefined) {
    throw new Error(`Code 128 set B cannot draw ${JSON.stringify(text)}`);
  }
  return symbolSequence(text)
    .map((value) => modulesForValue(value))
    .join('');
}

/**
 * The clear margin either side, in modules.
 *
 * Code 128 asks for ten modules or 6.4 mm, whichever is greater. Ten is what is
 * carried here because the millimetre floor is a fact about paper, and
 * `sheet.ts` — which is the only thing that knows how wide a module is going to
 * be — is where a size in millimetres can honestly be checked.
 */
export const QUIET_MODULES = 10;

/**
 * How many modules a code of `length` characters comes to, quiet zones and all.
 *
 * Wanted by `codes.ts`, which caps the length, and by `sheet.ts`, which works
 * out how wide a module can be — and both would otherwise carry the same
 * arithmetic, disagree by eleven one day, and produce a length the form accepts
 * and the label cannot hold.
 */
export function moduleCountFor(length: number): number {
  // start + data + checksum, at eleven each; the stop at thirteen; a ten-module
  // quiet zone each side, which is the minimum this symbology asks for.
  return 11 * (length + 2) + 11 + STOP_FINAL_BAR + QUIET_MODULES * 2;
}
