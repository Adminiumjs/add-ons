/**
 * EAN-13, CHECKED AGAINST THINGS FROM OUTSIDE THIS REPOSITORY.
 *
 * ── WHY A SUITE OVER AN ENCODER NEEDS OUTSIDE ANCHORS ──────────────────────
 *
 * Because everything else it could assert is circular. "The encoder returns
 * what the tables say" tests nothing if the tables are wrong, and a wrong table
 * entry is the likeliest defect in a file whose bulk is thirty hand-copied bit
 * strings. A barcode that does not scan fails the way a wrong holiday date
 * fails: silently, on somebody else's premises, weeks later.
 *
 * So this suite is built from three kinds of check, and only the first two are
 * worth much on their own:
 *
 *   THE ANCHORS. Whole module strings and check digits for real, published
 *   barcodes. `5901234123457` and `4006381333931` are the two examples every
 *   account of this symbology uses; `9780306406157` and `0012345678905` are a
 *   book's number and the twelve-digit case written as thirteen. Their check
 *   digits are facts about arithmetic a reader can redo by hand, and the module
 *   strings can be compared character for character against any reference.
 *
 *   THE TABLE RELATIONS. The three alphabets are not independent: R is L
 *   flipped and G is R backwards. A single mistyped module breaks at least one
 *   of those, which is what turns three hand-copied tables into three checked
 *   ones — and it is the check that would still have caught a typo if nobody
 *   had had a published example to hand.
 *
 *   THE SHAPE. Ninety-five modules, guards where the standard puts them, and a
 *   throw rather than a blank on anything that is not thirteen digits.
 */

import { describe, expect, it } from 'vitest';

import {
  CENTRE_GUARD,
  checkDigitFor,
  encodeEan13,
  END_GUARD,
  FIRST_DIGIT_PARITY,
  G_SET,
  GUARD_SPANS,
  hasCorrectCheckDigit,
  humanReadableGroups,
  isThirteenDigits,
  L_SET,
  NOMINAL_MODULE_MM,
  QUIET_LEFT,
  QUIET_RIGHT,
  R_SET,
  START_GUARD,
} from './ean13.ts';
import { runsOf } from './modules.ts';

const flip = (modules: string) => [...modules].map((m) => (m === '1' ? '0' : '1')).join('');
const reverse = (modules: string) => [...modules].reverse().join('');
const darkCount = (modules: string) => [...modules].filter((m) => m === '1').length;

describe('the three alphabets are the published ones', () => {
  it('has ten entries of seven modules in each', () => {
    for (const [name, set] of [
      ['L', L_SET],
      ['G', G_SET],
      ['R', R_SET],
    ] as const) {
      expect(set.length, name).toBe(10);
      for (const [digit, modules] of set.entries()) {
        expect(modules.length, `${name}${digit}`).toBe(7);
        expect(/^[01]+$/.test(modules), `${name}${digit}`).toBe(true);
      }
    }
  });

  it('derives R from L and G from R, which no typo survives', () => {
    for (let digit = 0; digit < 10; digit += 1) {
      expect(R_SET[digit], `R${digit} is not L${digit} flipped`).toBe(flip(L_SET[digit]!));
      expect(G_SET[digit], `G${digit} is not R${digit} reversed`).toBe(reverse(R_SET[digit]!));
    }
  });

  it('gives L an odd number of dark modules and G and R an even one', () => {
    // This parity IS the mechanism that carries the undrawn first digit: a
    // scanner reads which alphabet each left-hand digit needed and looks the
    // first digit up from the pattern. A table that broke it would encode a
    // number that reads back as a different one.
    for (let digit = 0; digit < 10; digit += 1) {
      expect(darkCount(L_SET[digit]!) % 2, `L${digit}`).toBe(1);
      expect(darkCount(G_SET[digit]!) % 2, `G${digit}`).toBe(0);
      expect(darkCount(R_SET[digit]!) % 2, `R${digit}`).toBe(0);
    }
  });

  it('draws every digit as two bars and two spaces', () => {
    for (const set of [L_SET, G_SET, R_SET]) {
      for (const modules of set) expect(runsOf(modules).length).toBe(4);
    }
  });

  it('opens the left alphabets with a space and the right one with a bar', () => {
    for (let digit = 0; digit < 10; digit += 1) {
      expect(`${L_SET[digit]![0]}${L_SET[digit]!.at(-1)}`, `L${digit}`).toBe('01');
      expect(`${G_SET[digit]![0]}${G_SET[digit]!.at(-1)}`, `G${digit}`).toBe('01');
      expect(`${R_SET[digit]![0]}${R_SET[digit]!.at(-1)}`, `R${digit}`).toBe('10');
    }
  });

  it('selects an alphabet per left digit from the first digit, all-L for zero', () => {
    expect(FIRST_DIGIT_PARITY).toHaveLength(10);
    // All-L for a leading zero is the compatibility with the twelve-digit
    // symbology this one extends, and is the row to check first.
    expect(FIRST_DIGIT_PARITY[0]).toBe('LLLLLL');
    expect(new Set(FIRST_DIGIT_PARITY).size, 'two first digits share a pattern').toBe(10);
    for (const row of FIRST_DIGIT_PARITY) expect(/^[LG]{6}$/.test(row)).toBe(true);
  });
});

describe('the check digit, against published numbers', () => {
  it.each([
    ['5901234123457', 7],
    ['4006381333931', 1],
    ['9780306406157', 7],
    ['0012345678905', 5],
  ])('%s ends in %i', (code, expected) => {
    expect(checkDigitFor(code.slice(0, 12))).toBe(expected);
    expect(hasCorrectCheckDigit(code)).toBe(true);
  });

  it('answers zero rather than ten when the weighted sum is already a round number', () => {
    // `10 - sum % 10` is the off-by-one every hand implementation of this makes
    // once, and it only shows on the one input in ten where it matters.
    const sum = (first12: string) =>
      [...first12].reduce((total, digit, at) => total + Number(digit) * (at % 2 === 0 ? 1 : 3), 0);
    const roundOne = '000000000000';
    expect(sum(roundOne) % 10).toBe(0);
    expect(checkDigitFor(roundOne)).toBe(0);
  });

  it('reports a wrong last digit for every other value it could have had', () => {
    const correct = '5901234123457';
    for (let digit = 0; digit < 10; digit += 1) {
      const candidate = `${correct.slice(0, 12)}${digit}`;
      expect(hasCorrectCheckDigit(candidate), candidate).toBe(digit === 7);
    }
  });

  it('takes thirteen digits and nothing else as the shape', () => {
    expect(isThirteenDigits('5901234123457')).toBe(true);
    expect(isThirteenDigits('590123412345')).toBe(false);
    expect(isThirteenDigits('59012341234567')).toBe(false);
    expect(isThirteenDigits('590123412345x')).toBe(false);
    expect(isThirteenDigits('5901234 123457')).toBe(false);
    // A full-width digit is a digit to a person and not to `/[0-9]/`, which is
    // the point of asserting it: a paste from a spreadsheet can carry one.
    expect(isThirteenDigits('５901234123457')).toBe(false);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE ANCHORS — whole encodings, pinned
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * Both strings below can be compared, character for character, against any
 * published encoding of the same number. They are what makes the difference
 * between "the encoder agrees with the tables" and "the encoder is right".
 */
describe('the anchors: encodings a reader can check against a reference', () => {
  const FIVE_NINE_ZERO =
    '10100010110100111011001100100110111101001110101010110011011011001000010101110010011101000100101';
  const FOUR_ZERO_ZERO =
    '10100011010100111010111101111010001001011001101010100001010000101000010111010010000101100110101';

  it('encodes 5901234123457', () => {
    expect(encodeEan13('5901234123457')).toBe(FIVE_NINE_ZERO);
  });

  it('encodes 4006381333931', () => {
    expect(encodeEan13('4006381333931')).toBe(FOUR_ZERO_ZERO);
  });

  it('puts the guards and the halves exactly where the standard does', () => {
    const modules = encodeEan13('5901234123457');
    expect(modules.length).toBe(95);
    expect(modules.slice(0, 3)).toBe(START_GUARD);
    expect(modules.slice(45, 50)).toBe(CENTRE_GUARD);
    expect(modules.slice(92)).toBe(END_GUARD);
  });

  it('writes each left digit in the alphabet the first digit chose', () => {
    // The check that says the parity TABLE is being applied rather than merely
    // present: the leading 5 selects LGGLLG, and every one of those six slices
    // has to come out of the alphabet that row names.
    const modules = encodeEan13('5901234123457');
    const digits = [9, 0, 1, 2, 3, 4];
    const parity = FIRST_DIGIT_PARITY[5]!;
    expect(parity).toBe('LGGLLG');
    for (let at = 0; at < 6; at += 1) {
      const slice = modules.slice(3 + at * 7, 3 + (at + 1) * 7);
      const alphabet = parity[at] === 'L' ? L_SET : G_SET;
      expect(slice, `left digit ${at}`).toBe(alphabet[digits[at]!]);
    }
  });

  it('writes every right digit in the R alphabet', () => {
    const modules = encodeEan13('5901234123457');
    const digits = [1, 2, 3, 4, 5, 7];
    for (let at = 0; at < 6; at += 1) {
      const slice = modules.slice(50 + at * 7, 50 + (at + 1) * 7);
      expect(slice, `right digit ${at}`).toBe(R_SET[digits[at]!]);
    }
  });

  it('gives two different numbers two different encodings', () => {
    // A guard against an encoder that returns a constant, which every check
    // above but the two anchors would happily accept.
    expect(encodeEan13('5901234123457')).not.toBe(encodeEan13('5901234123464'));
  });

  it('encodes the same number the same way twice', () => {
    expect(encodeEan13('4006381333931')).toBe(encodeEan13('4006381333931'));
  });

  it('throws rather than drawing something that is not a barcode', () => {
    // A blank rectangle where a barcode should be is the exact failure this
    // add-on exists to prevent, so the encoder refuses loudly. Nothing reaches
    // it without going through `codes.ts` first.
    expect(() => encodeEan13('590123412345')).toThrow();
    expect(() => encodeEan13('')).toThrow();
    expect(() => encodeEan13('abcdefghijklm')).toThrow();
  });
});

describe('the facts about paper that belong to the symbology', () => {
  it('names the three guard spans, by where they actually are', () => {
    expect(GUARD_SPANS).toEqual([
      { from: 0, to: 3 },
      { from: 45, to: 50 },
      { from: 92, to: 95 },
    ]);
    // And they really are guards in a real encoding, or the spans are three
    // numbers that agree with nothing.
    const modules = encodeEan13('5901234123457');
    expect(modules.slice(0, 3)).toBe('101');
    expect(modules.slice(45, 50)).toBe('01010');
    expect(modules.slice(92, 95)).toBe('101');
  });

  it('asks for an uneven quiet zone, wider on the side the first digit sits in', () => {
    expect(QUIET_LEFT).toBe(11);
    expect(QUIET_RIGHT).toBe(7);
    expect(QUIET_LEFT).toBeGreaterThan(QUIET_RIGHT);
  });

  it('carries the nominal module width its standard fixes', () => {
    expect(NOMINAL_MODULE_MM).toBe(0.33);
    // 95 modules plus both quiet zones at 100% magnification. If this ever
    // stops fitting a label, the answer is a bigger label — see `sheet.ts`.
    expect((95 + QUIET_LEFT + QUIET_RIGHT) * NOMINAL_MODULE_MM).toBeCloseTo(37.29, 2);
  });

  it('groups the printed digits one, six and six', () => {
    expect(humanReadableGroups('5901234123457')).toEqual({
      lead: '5',
      left: '901234',
      right: '123457',
    });
  });
});
