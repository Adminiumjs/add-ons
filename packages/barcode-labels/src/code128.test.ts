/**
 * CODE 128, CHECKED THE SAME WAY EAN-13 IS: from outside.
 *
 * ── THE TABLE IS 107 HAND-COPIED SIX-DIGIT STRINGS ─────────────────────────
 *
 * Which is to say it is the single most likely thing in this package to have a
 * typo in it, and a typo there draws a symbol that scans as a DIFFERENT
 * CHARACTER with nothing visibly wrong. So the table is put through three
 * structural facts of the published one, every one of which a mistyped digit
 * breaks:
 *
 *   SIX WIDTHS SUMMING TO ELEVEN. Every symbol character is eleven modules.
 *
 *   AN EVEN NUMBER OF BAR MODULES. This is the self-checking property the
 *   symbology is built on — every one of the 107 entries has a bar total of
 *   four, six or eight, and a single digit changed anywhere makes one odd. It
 *   is the strongest of the three and it needs no reference to hand.
 *
 *   ALL 107 DISTINCT. Two characters drawing alike would be unreadable.
 *
 * Those three between them cannot catch a swap of two whole valid patterns, so
 * the suite also pins a published encoding end to end — the symbol values and
 * the checksum of the example every account of this symbology uses.
 */

import { describe, expect, it } from 'vitest';

import {
  checksumFor,
  encodeCode128,
  firstUndrawable,
  isSetB,
  moduleCountFor,
  modulesForValue,
  PATTERNS,
  QUIET_MODULES,
  SET_B_FIRST,
  SET_B_LAST,
  START_B,
  STOP,
  STOP_FINAL_BAR,
  symbolSequence,
  symbolValuesOf,
} from './code128.ts';
import { runsOf } from './modules.ts';

const widthsOf = (pattern: string) => [...pattern].map(Number);

describe('the pattern table is the published one', () => {
  it('has 107 entries, six widths each, summing to eleven', () => {
    expect(PATTERNS).toHaveLength(107);
    for (const [value, pattern] of PATTERNS.entries()) {
      expect(pattern.length, `value ${value}`).toBe(6);
      expect(/^[1-4]{6}$/.test(pattern), `value ${value}`).toBe(true);
      expect(
        widthsOf(pattern).reduce((sum, width) => sum + width, 0),
        `value ${value} does not sum to eleven`,
      ).toBe(11);
    }
  });

  it('gives every entry an even number of bar modules, which is the self-check', () => {
    const totals = new Set<number>();
    for (const [value, pattern] of PATTERNS.entries()) {
      const widths = widthsOf(pattern);
      const bars = widths[0]! + widths[2]! + widths[4]!;
      expect(bars % 2, `value ${value} has an odd bar total (${bars})`).toBe(0);
      totals.add(bars);
    }
    // Four, six or eight and nothing else. Stated so that a table which
    // happened to be all-even for the wrong reason still looks wrong here.
    expect([...totals].sort((a, b) => a - b)).toEqual([4, 6, 8]);
  });

  it('draws no two characters alike', () => {
    expect(new Set(PATTERNS).size).toBe(107);
  });

  it('names the start and stop values the standard names', () => {
    expect(START_B).toBe(104);
    expect(STOP).toBe(106);
    expect(PATTERNS[START_B]).toBe('211214');
    expect(PATTERNS[STOP]).toBe('233111');
  });

  it('keeps the stop pattern’s seventh element out of the six-width table', () => {
    // Writing `2331112` into the table would make one entry fail the check
    // above, and exempting it would be a hole in the shape of the entry. The
    // extra bar lives beside the table instead.
    expect(STOP_FINAL_BAR).toBe(2);
    expect(modulesForValue(STOP)).toHaveLength(13);
    expect(modulesForValue(STOP)).toBe('1100011101011');
    expect(modulesForValue(STOP).endsWith('11')).toBe(true);
  });

  it('turns a pattern into modules bar-first, at eleven each', () => {
    for (let value = 0; value < 103; value += 1) {
      const modules = modulesForValue(value);
      expect(modules.length, `value ${value}`).toBe(11);
      expect(modules.startsWith('1'), `value ${value} does not open with a bar`).toBe(true);
      expect(runsOf(modules).length, `value ${value}`).toBe(6);
    }
  });
});

describe('set B is the printable ASCII range and nothing else', () => {
  it('runs from space to tilde', () => {
    expect(SET_B_FIRST).toBe(32);
    expect(SET_B_LAST).toBe(126);
    expect(isSetB(' !"#$%&\'()*+,-./0123456789:;<=>?')).toBe(true);
    expect(isSetB('ABCXYZabcxyz{|}~')).toBe(true);
  });

  it('reports the first character it cannot draw, so the refusal can name it', () => {
    expect(firstUndrawable('WAL-COAST-06')).toBeUndefined();
    expect(firstUndrawable('café')).toBe('é');
    expect(firstUndrawable('a\tb')).toBe('\t');
    expect(firstUndrawable('標籤')).toBe('標');
    expect(isSetB('café')).toBe(false);
  });

  it('values a character as its ASCII code less the space', () => {
    expect(symbolValuesOf(' ')).toEqual([0]);
    expect(symbolValuesOf('A')).toEqual([33]);
    expect(symbolValuesOf('a')).toEqual([65]);
    expect(symbolValuesOf('~')).toEqual([94]);
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * THE ANCHOR — the published encoding of "Wikipedia"
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * The example every account of this symbology works through. Its symbol values
 * and its checksum of 88 are stated in all of them, and both can be redone by
 * hand from the two rules in `code128.ts`: a character's value is its ASCII code
 * less 32, and the checksum is the start code plus each value times its place,
 * modulo 103.
 *
 * The word itself is the example's, not this add-on's copy — it renders in no
 * screen and reaches no bundle, which `dist.test.ts` is what actually keeps
 * true.
 */
describe('the anchor: the published encoding of a nine-character word', () => {
  const EXAMPLE = 'Wikipedia';

  it('values its characters the way every account of this symbology does', () => {
    expect(symbolValuesOf(EXAMPLE)).toEqual([55, 73, 75, 73, 80, 69, 68, 73, 65]);
  });

  it('checksums to 88', () => {
    expect(checksumFor(symbolValuesOf(EXAMPLE))).toBe(88);
  });

  it('sequences start, the nine characters, the checksum and stop', () => {
    expect(symbolSequence(EXAMPLE)).toEqual([104, 55, 73, 75, 73, 80, 69, 68, 73, 65, 88, 106]);
  });

  it('draws the element widths the table says', () => {
    // The published example is usually printed as this run of width patterns
    // rather than as modules, so it is pinned in that form too — a reader with
    // a reference open compares these twelve groups directly.
    expect(symbolSequence(EXAMPLE).map((value) => PATTERNS[value])).toEqual([
      '211214',
      '311321',
      '142112',
      '241211',
      '142112',
      '111242',
      '112214',
      '141221',
      '142112',
      '121124',
      '421211',
      '233111',
    ]);
  });

  it('encodes to 134 modules, opening and closing where it should', () => {
    const modules = encodeCode128(EXAMPLE);
    expect(modules).toHaveLength(134);
    // eleven each for start, nine characters and the checksum, then thirteen.
    expect(11 * 11 + 13).toBe(134);
    expect(modules.startsWith('11010010000')).toBe(true);
    expect(modules.endsWith('1100011101011')).toBe(true);
  });
});

describe('the checksum is a weighted sum modulo 103', () => {
  it('counts the start code once and each character by its place', () => {
    // Worked by hand: start 104, then 33 in place one and 34 in place two.
    expect(checksumFor([33, 34])).toBe((104 + 33 * 1 + 34 * 2) % 103);
  });

  it('moves when two characters swap, which a plain sum would not', () => {
    // The whole reason the sum is weighted: `AB` and `BA` must not check alike.
    expect(checksumFor(symbolValuesOf('AB'))).not.toBe(checksumFor(symbolValuesOf('BA')));
  });

  it('never lands on a start or stop value', () => {
    // The modulus is the size of the character set, not of the table. Using 107
    // would be the kind of mistake that works for most inputs, so it is checked
    // across a wide sweep rather than on one.
    for (let length = 1; length <= 20; length += 1) {
      for (let value = 0; value < 95; value += 5) {
        const checksum = checksumFor(Array.from({ length }, () => value));
        expect(checksum).toBeGreaterThanOrEqual(0);
        expect(checksum).toBeLessThan(103);
      }
    }
  });
});

describe('the module count, which the label geometry is derived from', () => {
  it('counts start, data, checksum, stop and both quiet zones', () => {
    expect(QUIET_MODULES).toBe(10);
    for (const length of [1, 5, 9, 22]) {
      expect(moduleCountFor(length), `length ${length}`).toBe(11 * length + 55);
    }
  });

  it('agrees with what the encoder actually produces, quiet zones aside', () => {
    // The formula and the encoder are two statements of one fact, and
    // `geometry.ts` caps a code's length using the formula alone — so if they
    // ever disagreed, the form would accept a code the label cannot hold.
    for (const code of ['A', 'ADM-4417', 'WAL-COAST-06', 'x'.repeat(22)]) {
      expect(encodeCode128(code).length + QUIET_MODULES * 2, code).toBe(
        moduleCountFor(code.length),
      );
    }
  });
});

describe('the encoder is total over set B and refuses everything else', () => {
  it('encodes a shop reference to the same modules twice', () => {
    expect(encodeCode128('ADM-4417')).toBe(encodeCode128('ADM-4417'));
  });

  it('gives two references two encodings', () => {
    expect(encodeCode128('ADM-4417')).not.toBe(encodeCode128('ADM-4418'));
  });

  it('draws a space, which set B carries and a shop reference may contain', () => {
    expect(() => encodeCode128('WAL COAST 06')).not.toThrow();
  });

  it('throws rather than dropping a character it cannot draw', () => {
    // A dropped character is a label whose bars and whose printed text disagree,
    // which is worse than no label at all.
    expect(() => encodeCode128('café')).toThrow();
    expect(() => encodeCode128('')).toThrow();
  });
});
