/**
 * EAN-13, WRITTEN OUT.
 *
 * ── WHY THIS IS HAND-ROLLED AND NOT A DEPENDENCY ───────────────────────────
 *
 * 25 D11: an add-on takes no runtime dependency the host has not already got.
 * The host has React and nothing else, so a barcode library is not available to
 * this package at any price — and the whole symbology is a lookup table, a
 * weighted sum and a fixed guard pattern. `shipping-dhl` writes a PDF by hand
 * for the same reason and in about the same number of lines.
 *
 * ── THE SHAPE, WHICH IS FIXED AND WORTH KNOWING BEFORE READING THE CODE ────
 *
 * Thirteen digits become ninety-five modules, always:
 *
 *     101                  the start guard, 3 modules
 *     six digits × 7       the left half, 42 modules
 *     01010                the centre guard, 5 modules
 *     six digits × 7       the right half, 42 modules
 *     101                  the end guard, 3 modules
 *
 * That is twelve digits drawn. THE FIRST DIGIT IS NOT DRAWN AT ALL, which is
 * the fact that surprises everybody who meets this symbology for the first
 * time and the reason the tables below are shaped as they are. It is carried by
 * WHICH of two alphabets each of the six left-hand digits is written in: the
 * L set or the G set, in a pattern the first digit selects. A scanner reads the
 * six left digits, notices the pattern of alphabets it had to use to read them,
 * and looks the first digit up from that.
 *
 * A corollary that matters when reading `sheet.ts`: the first digit has nowhere
 * of its own under the bars, so it is printed to the LEFT of the whole symbol,
 * in the quiet zone. That is not decoration — it is where the standard puts it.
 *
 * ── THE THREE ALPHABETS ARE ONE TABLE WITH TWO DERIVATIONS ─────────────────
 *
 * They are written out separately below because a reference prints them
 * separately and a reader checking this package against one should be able to
 * compare line for line. They are not independent, and `ean13.test.ts` asserts
 * both relations rather than trusting the transcription:
 *
 *     R[d] is L[d] with every module flipped
 *     G[d] is R[d] backwards
 *
 * A single mistyped digit in any of the thirty entries breaks at least one of
 * those, which is what turns three hand-copied tables into three checked ones.
 * Every entry also has exactly two bars and two spaces, and every L entry has
 * an odd number of dark modules where every G and R entry has an even number —
 * that parity is the mechanism the paragraph above describes, stated as an
 * assertion.
 */

import type { Modules } from './modules.ts';

/** How many digits an EAN-13 has, drawn or not. */
export const EAN13_LENGTH = 13;

/** The odd-parity alphabet, used for left-hand digits. */
export const L_SET: readonly Modules[] = [
  '0001101',
  '0011001',
  '0010011',
  '0111101',
  '0100011',
  '0110001',
  '0101111',
  '0111011',
  '0110111',
  '0001011',
];

/** The even-parity alphabet, the other one a left-hand digit can be written in. */
export const G_SET: readonly Modules[] = [
  '0100111',
  '0110011',
  '0011011',
  '0100001',
  '0011101',
  '0111001',
  '0000101',
  '0010001',
  '0001001',
  '0010111',
];

/** The right-hand alphabet. Every entry opens with a bar, where L and G open with a space. */
export const R_SET: readonly Modules[] = [
  '1110010',
  '1100110',
  '1101100',
  '1000010',
  '1011100',
  '1001110',
  '1010000',
  '1000100',
  '1001000',
  '1110100',
];

/**
 * WHERE THE FIRST DIGIT ACTUALLY LIVES: the alphabet each of the six left-hand
 * digits is written in, indexed by the first digit.
 *
 * Row zero is all-L, which is why a thirteen-digit number beginning with a zero
 * draws exactly as the twelve-digit symbology it grew out of does. That is not
 * a coincidence in the table — it is the compatibility the extra digit was
 * designed around, and it is the row a reader should check first.
 */
export const FIRST_DIGIT_PARITY: readonly string[] = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
];

export const START_GUARD: Modules = '101';
export const CENTRE_GUARD: Modules = '01010';
export const END_GUARD: Modules = '101';

/** Every character is an ASCII digit, and there are exactly thirteen of them. */
export function isThirteenDigits(code: string): boolean {
  return /^[0-9]{13}$/.test(code);
}

/**
 * THE CHECK DIGIT, from the twelve that come before it.
 *
 * Positions alternate weight one and weight three, starting at one for the
 * leftmost digit; the check digit is whatever takes the weighted sum up to a
 * multiple of ten. Written as `(10 - sum % 10) % 10` rather than as a
 * conditional, because the outer modulo is the whole of the case where the sum
 * is already a multiple of ten — and `10 - 0` is the off-by-one every hand
 * implementation of this makes once.
 *
 * It takes twelve digits and not thirteen ON PURPOSE. Handing it the whole code
 * and having it ignore the last character would make a caller that wanted to
 * ASK for a check digit indistinguishable from one that wanted to CHECK one,
 * and this package does both — see `checkDigitRefusal` in `codes.ts`.
 */
export function checkDigitFor(first12: string): number {
  let sum = 0;
  for (let at = 0; at < 12; at += 1) {
    sum += Number(first12[at]) * (at % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

/** Does a thirteen-digit code end in the digit its first twelve demand? */
export function hasCorrectCheckDigit(code: string): boolean {
  return isThirteenDigits(code) && Number(code[12]) === checkDigitFor(code.slice(0, 12));
}

/**
 * Thirteen digits to ninety-five modules.
 *
 * THROWS on anything that is not thirteen digits, and that is deliberate in a
 * package where nothing else does. A refusal a person can act on is a value —
 * `codes.ts` returns one, in words, and no code reaches storage without going
 * through it. By the time a code is being DRAWN it has already been checked,
 * and the only way to arrive here with something else is a defect in this
 * package. Returning `''` for that case would put a blank rectangle on a label
 * sheet where a barcode should be, which is the failure mode this whole add-on
 * exists to avoid: something that looks like a barcode and is not one.
 */
export function encodeEan13(code: string): Modules {
  if (!isThirteenDigits(code)) {
    throw new Error(`EAN-13 needs thirteen digits, not ${JSON.stringify(code)}`);
  }
  const digits = [...code].map(Number);
  const parity = FIRST_DIGIT_PARITY[digits[0]!]!;

  let out = START_GUARD;
  for (let at = 0; at < 6; at += 1) {
    const alphabet = parity[at] === 'L' ? L_SET : G_SET;
    out += alphabet[digits[at + 1]!]!;
  }
  out += CENTRE_GUARD;
  for (let at = 0; at < 6; at += 1) {
    out += R_SET[digits[at + 7]!]!;
  }
  return out + END_GUARD;
}

/**
 * WHICH MODULES BELONG TO A GUARD, so the renderer can draw those bars longer.
 *
 * The three guard patterns descend past the bottom of every other bar, into the
 * band the human-readable digits sit in. That is what visually splits the
 * symbol into its two halves and marks its two ends, and a reader who has seen
 * a barcode has seen it whether or not they could have named it.
 *
 * It is stated as MODULE OFFSETS rather than re-derived inside `sheet.ts`,
 * because the offsets are a fact about the symbology and the renderer's job is
 * paper. They are constants — the layout is fixed at ninety-five modules — but
 * they are written as arithmetic over the guard widths so that a reader can see
 * where each comes from instead of checking three magic numbers.
 */
export const GUARD_SPANS: readonly { readonly from: number; readonly to: number }[] = [
  { from: 0, to: START_GUARD.length },
  { from: 3 + 42, to: 3 + 42 + CENTRE_GUARD.length },
  { from: 95 - END_GUARD.length, to: 95 },
];

/**
 * THE QUIET ZONES, IN MODULES, and they are not the same on both sides.
 *
 * A scanner needs a clear margin either side of the symbol or it cannot tell
 * where the code begins. EAN-13's are eleven modules on the left and seven on
 * the right; the left one is wider because the undrawn first digit is printed
 * in it. A label that crops them is a label that reads intermittently, which is
 * worse than one that does not read at all — an intermittent failure at a till
 * gets blamed on the scanner.
 */
export const QUIET_LEFT = 11;
export const QUIET_RIGHT = 7;

/**
 * The nominal module width the standard defines, in millimetres.
 *
 * EAN-13 has a SIZE, which Code 128 does not, and this is the whole of why the
 * two are drawn differently in `sheet.ts`: this symbology is scaled by choosing
 * a magnification between 80% and 200% of a fixed nominal, and stretching it to
 * fill whatever label it landed on would put it outside that range without
 * anybody noticing. So it is drawn at 100% and centred, and if it ever stops
 * fitting the answer is a bigger label rather than a narrower module.
 */
export const NOMINAL_MODULE_MM = 0.33;

/**
 * How the thirteen digits are grouped under the symbol: one outside on the
 * left, then six, then six.
 *
 * Here rather than in the renderer for the same reason `GUARD_SPANS` is: the
 * grouping is a fact about EAN-13, and the renderer only decides where on the
 * paper each group lands.
 */
export function humanReadableGroups(code: string): {
  readonly lead: string;
  readonly left: string;
  readonly right: string;
} {
  return { lead: code.slice(0, 1), left: code.slice(1, 7), right: code.slice(7, 13) };
}
