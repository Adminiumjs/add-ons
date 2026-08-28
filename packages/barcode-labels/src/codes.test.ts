/**
 * THE MAPPING TABLE AND ITS TWO REFUSALS.
 *
 * The refusals are the reason this file is long. 25 D10 asks an add-on to
 * refuse by a REAL RULE the reader can act on, and a refusal is only worth
 * anything if it is exact in BOTH directions: it has to fire on the thing it is
 * about, and it has to stay quiet on everything that merely resembles it. The
 * second half is where a rule like this normally goes wrong — a duplicate check
 * that refused a row its own number would make the form refuse the state it is
 * already in, and a check-digit rule that corrected silently would hand a shop
 * back a different article number from the one on its own paperwork.
 *
 * So every refusal below has a matching case saying what it does NOT refuse.
 */

import { describe, expect, it } from 'vitest';

import {
  assignCode,
  assignedCodes,
  codeFor,
  codeRefusal,
  forgetCode,
  isDrawable,
  modulesFor,
  readStored,
  REFUSAL_KINDS,
  STORAGE_KEY,
  SYMBOLOGIES,
  writeStored,
  type AssignedCode,
} from './codes.ts';
import { encodeCode128 } from './code128.ts';
import { encodeEan13 } from './ean13.ts';
import { CODE128_MAX_LENGTH } from './geometry.ts';

/** A valid EAN-13 and a second one, used throughout. */
const EAN = '5901234123457';
const OTHER_EAN = '4006381333931';

const table = (...entries: AssignedCode[]): readonly AssignedCode[] => entries;
const values = (codes: readonly AssignedCode[]) => ({ [STORAGE_KEY]: codes });

const ok = (outcome: ReturnType<typeof assignCode>) => {
  if (!outcome.ok) throw new Error(`refused: ${JSON.stringify(outcome.refusal)}`);
  return outcome.codes;
};

describe('what the table is', () => {
  it('stores under one key, which the manifest declares', () => {
    expect(STORAGE_KEY).toBe('codes');
  });

  it('offers exactly the two symbologies this add-on draws', () => {
    expect([...SYMBOLOGIES]).toEqual(['ean13', 'code128']);
  });

  it('is empty for a shop that has connected and given nothing', () => {
    // 24 D6 as a return value: a host merging nothing behaves exactly as it did
    // before the add-on existed.
    expect(readStored(undefined)).toEqual([]);
    expect(readStored({})).toEqual([]);
    expect(codeFor(undefined, 'anything')).toBeUndefined();
    expect(assignedCodes({})).toEqual([]);
  });

  it('comes back sorted by row, so a save does not look like a change', () => {
    const stored = readStored(
      values(table(
        { sku: 'zinc-tray', symbology: 'ean13', code: EAN },
        { sku: 'ash-board', symbology: 'code128', code: 'ASH-01' },
      )),
    );
    expect(stored.map((entry) => entry.sku)).toEqual(['ash-board', 'zinc-tray']);
    expect(writeStored(stored)[STORAGE_KEY]).toEqual(stored);
  });
});

describe('reading a document written by somebody else', () => {
  it('drops an entry that is not an object, or has no row, or has no code', () => {
    const stored = readStored({
      [STORAGE_KEY]: [
        null,
        'nonsense',
        { symbology: 'ean13', code: EAN },
        { sku: '  ', symbology: 'ean13', code: EAN },
        { sku: 'a', symbology: 'ean13' },
        { sku: 'keeps', symbology: 'ean13', code: EAN },
      ],
    });
    expect(stored).toEqual([{ sku: 'keeps', symbology: 'ean13', code: EAN }]);
  });

  it('drops an entry naming a symbology this add-on does not draw', () => {
    expect(readStored({ [STORAGE_KEY]: [{ sku: 'a', symbology: 'qr', code: 'x' }] })).toEqual([]);
  });

  /**
   * THE STRICT ONE, and it is deliberate. Everything downstream assumes a
   * stored code can be encoded — both encoders throw otherwise, on purpose —
   * so admitting an unencodable entry here would move the failure from a quiet
   * drop at the boundary to an exception inside somebody's render.
   */
  it('drops a code the symbology it claims cannot draw', () => {
    const stored = readStored({
      [STORAGE_KEY]: [
        { sku: 'bad-check', symbology: 'ean13', code: '5901234123450' },
        { sku: 'too-short', symbology: 'ean13', code: '590' },
        { sku: 'not-latin', symbology: 'code128', code: 'café' },
        { sku: 'too-long', symbology: 'code128', code: 'x'.repeat(CODE128_MAX_LENGTH + 1) },
      ],
    });
    // The check digit is a RULE and not a shape, so a well-formed thirteen-digit
    // number with the wrong last digit survives reading and is refused only when
    // somebody tries to assign one. Reading is about what can be drawn.
    expect(stored.map((entry) => entry.sku)).toEqual(['bad-check']);
  });

  it('keeps the first of two entries naming one row', () => {
    // A document that names a row twice has an entry that is going to be
    // ignored whatever this does; keeping the first is the only choice stable
    // under re-reading the same document.
    const stored = readStored(
      values(table(
        { sku: 'one', symbology: 'ean13', code: EAN },
        { sku: 'one', symbology: 'ean13', code: OTHER_EAN },
      )),
    );
    expect(stored).toEqual([{ sku: 'one', symbology: 'ean13', code: EAN }]);
  });

  it('answers the same thing twice for the same document', () => {
    const document = values(table({ sku: 'one', symbology: 'code128', code: 'ADM-4417' }));
    expect(readStored(document)).toEqual(readStored(document));
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * REFUSAL ONE: THE CHECK DIGIT
 * ═════════════════════════════════════════════════════════════════════════════
 */
describe('an EAN-13 whose last digit is wrong is refused, and told which digit', () => {
  it('names the digit the first twelve demand', () => {
    const outcome = assignCode([], 'zinc-tray', 'ean13', '5901234123450');
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal).toEqual({ why: 'ean13Check', expected: 7, given: 0 });
  });

  it('is fixable by the one keystroke it names', () => {
    // The whole worth of the refusal: correcting the digit it named clears it.
    const refused = assignCode([], 'zinc-tray', 'ean13', '5901234123450');
    expect(refused.ok).toBe(false);
    const expected = !refused.ok && refused.refusal.why === 'ean13Check' ? refused.refusal.expected : -1;
    const corrected = `${'5901234123450'.slice(0, 12)}${expected}`;
    expect(corrected).toBe(EAN);
    expect(assignCode([], 'zinc-tray', 'ean13', corrected).ok).toBe(true);
  });

  it('never corrects it silently', () => {
    // A number a shop typed is a number a shop believes it owns. Handing back a
    // different one, with no sign, is the one behaviour worse than refusing.
    const codes = ok(assignCode([], 'zinc-tray', 'ean13', EAN));
    expect(codes[0]!.code).toBe(EAN);
    expect(assignCode([], 'zinc-tray', 'ean13', '5901234123450').ok).toBe(false);
  });

  it('separates the shape from the rule, so each says its own thing', () => {
    expect(codeRefusal('ean13', '590123412345')).toEqual({ why: 'ean13Shape', given: 12 });
    expect(codeRefusal('ean13', '5901234123457x')).toEqual({ why: 'ean13Shape', given: 14 });
    expect(codeRefusal('ean13', 'abcdefghijklm')).toEqual({ why: 'ean13Shape', given: 13 });
    expect(codeRefusal('ean13', '')).toEqual({ why: 'empty' });
  });

  it('takes every published number this repository knows about', () => {
    for (const code of [EAN, OTHER_EAN, '9780306406157', '0012345678905']) {
      expect(codeRefusal('ean13', code), code).toBeUndefined();
    }
  });
});

/**
 * ═════════════════════════════════════════════════════════════════════════════
 * REFUSAL TWO: TWO ROWS, ONE NUMBER
 * ═════════════════════════════════════════════════════════════════════════════
 */
describe('a number already on another row is refused, and the row is named', () => {
  const held = table({ sku: 'ash-board', symbology: 'ean13', code: EAN });

  it('names the row that already carries it', () => {
    const outcome = assignCode(held, 'zinc-tray', 'ean13', EAN);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal).toEqual({ why: 'duplicate', heldBy: 'ash-board' });
  });

  /**
   * THE HALF THAT MATTERS MOST. A scanner hands a till a run of characters and
   * does not say which symbology it came off, so the same digits drawn two ways
   * arrive identical. Comparing `(symbology, code)` would have let these two
   * coexist and would have been exactly wrong.
   */
  it('ignores the symbology, because a till does', () => {
    const outcome = assignCode(held, 'zinc-tray', 'code128', EAN);
    expect(outcome.ok).toBe(false);
    expect(!outcome.ok && outcome.refusal.why).toBe('duplicate');
  });

  it('does not refuse a row the number it already has', () => {
    // Re-assigning is how somebody changes the symbology or re-types a number
    // to check it. Refusing here would make the form refuse its own state.
    expect(assignCode(held, 'ash-board', 'ean13', EAN).ok).toBe(true);
    expect(assignCode(held, 'ash-board', 'code128', EAN).ok).toBe(true);
  });

  it('does not refuse a different number on the same row', () => {
    const codes = ok(assignCode(held, 'ash-board', 'ean13', OTHER_EAN));
    expect(codes).toEqual([{ sku: 'ash-board', symbology: 'ean13', code: OTHER_EAN }]);
  });

  it('lets the number be freed by taking it off the row that holds it', () => {
    const freed = forgetCode(held, 'ash-board');
    expect(assignCode(freed, 'zinc-tray', 'ean13', EAN).ok).toBe(true);
  });

  it('clears once the collision is gone, which is what makes it a real fix', () => {
    const both = ok(assignCode(held, 'zinc-tray', 'ean13', OTHER_EAN));
    expect(both).toHaveLength(2);
    expect(assignCode(both, 'zinc-tray', 'ean13', EAN).ok).toBe(false);
    expect(assignCode(forgetCode(both, 'ash-board'), 'zinc-tray', 'ean13', EAN).ok).toBe(true);
  });
});

describe('the Code 128 refusals', () => {
  it('names the first character it cannot draw', () => {
    expect(codeRefusal('code128', 'café')).toEqual({ why: 'code128Character', character: 'é' });
    expect(codeRefusal('code128', '标签')).toEqual({ why: 'code128Character', character: '标' });
  });

  it('says how long the code is and how long the label holds', () => {
    const tooLong = 'x'.repeat(CODE128_MAX_LENGTH + 1);
    expect(codeRefusal('code128', tooLong)).toEqual({
      why: 'code128TooLong',
      given: CODE128_MAX_LENGTH + 1,
      limit: CODE128_MAX_LENGTH,
    });
  });

  it('takes a code of exactly the length it allows', () => {
    // A limit that refused its own boundary would be a limit off by one, and
    // this is the boundary a shop meets.
    expect(codeRefusal('code128', 'x'.repeat(CODE128_MAX_LENGTH))).toBeUndefined();
  });

  it('takes the punctuation a shop reference actually contains', () => {
    for (const code of ['ADM-4417', 'WAL COAST 06', 'A/B.2', 'x_1', '(42)']) {
      expect(codeRefusal('code128', code), code).toBeUndefined();
    }
  });

  it('reports the character rather than the position, because that is what is retyped', () => {
    expect(codeRefusal('code128', 'AB\tCD')).toEqual({ why: 'code128Character', character: '\t' });
  });
});

describe('assigning', () => {
  it('refuses a row that is not named at all', () => {
    expect(assignCode([], '', 'ean13', EAN)).toEqual({ ok: false, refusal: { why: 'noRow' } });
    expect(assignCode([], '   ', 'ean13', EAN)).toEqual({ ok: false, refusal: { why: 'noRow' } });
  });

  it('trims the ends of a pasted number and nothing else', () => {
    expect(ok(assignCode([], 'a', 'ean13', `  ${EAN}\n`))[0]!.code).toBe(EAN);
    // An INNER space is a character set B draws and a shop may well mean, so
    // folding it would be this add-on changing a reference somebody typed.
    expect(ok(assignCode([], 'a', 'code128', 'WAL COAST 06'))[0]!.code).toBe('WAL COAST 06');
  });

  it('replaces rather than accumulating, so pressing twice changes nothing', () => {
    const once = ok(assignCode([], 'a', 'ean13', EAN));
    const twice = ok(assignCode(once, 'a', 'ean13', EAN));
    expect(twice).toEqual(once);
  });

  it('leaves every other row exactly where it was', () => {
    const held = table(
      { sku: 'ash-board', symbology: 'ean13', code: EAN },
      { sku: 'zinc-tray', symbology: 'code128', code: 'ZT-9' },
    );
    const after = ok(assignCode(held, 'zinc-tray', 'code128', 'ZT-10'));
    expect(after.find((entry) => entry.sku === 'ash-board')).toEqual(held[0]);
  });

  it('takes a row off without touching the others', () => {
    const held = table(
      { sku: 'ash-board', symbology: 'ean13', code: EAN },
      { sku: 'zinc-tray', symbology: 'code128', code: 'ZT-9' },
    );
    expect(forgetCode(held, 'ash-board')).toEqual([held[1]]);
    expect(forgetCode(held, 'nobody')).toEqual(held);
  });

  it('covers every refusal this package can produce', () => {
    // The list `REFUSAL_KINDS` names is what `ui/SettingsPanel.tsx` has to have
    // a sentence for. A variant that no case above can produce would mean
    // either dead copy or an untested rule, so it is driven from the list.
    const produced = new Set<string>();
    const attempts: [readonly AssignedCode[], string, 'ean13' | 'code128', string][] = [
      [[], '', 'ean13', EAN],
      [[], 'a', 'ean13', ''],
      [[], 'a', 'ean13', '590'],
      [[], 'a', 'ean13', '5901234123450'],
      [[], 'a', 'code128', 'café'],
      [[], 'a', 'code128', 'x'.repeat(CODE128_MAX_LENGTH + 1)],
      [table({ sku: 'b', symbology: 'ean13', code: EAN }), 'a', 'ean13', EAN],
    ];
    for (const [current, sku, symbology, code] of attempts) {
      const outcome = assignCode(current, sku, symbology, code);
      expect(outcome.ok, `${sku}/${code} was not refused`).toBe(false);
      if (!outcome.ok) produced.add(outcome.refusal.why);
    }
    expect([...produced].sort()).toEqual([...REFUSAL_KINDS].sort());
  });
});

describe('the read surface a host actually calls', () => {
  const document = values(table(
    { sku: 'ash-board', symbology: 'ean13', code: EAN },
    { sku: 'zinc-tray', symbology: 'code128', code: 'ADM-4417' },
  ));

  it('finds a row by the host’s own key', () => {
    expect(codeFor(document, 'zinc-tray')).toEqual({
      sku: 'zinc-tray',
      symbology: 'code128',
      code: 'ADM-4417',
    });
  });

  it('answers undefined for a row nobody has given a number to', () => {
    // `undefined` rather than a `{ found: false }` sentinel: a sentinel lets a
    // caller that forgot the flag carry on holding an object, which is exactly
    // the shape that draws an empty barcode.
    expect(codeFor(document, 'no-such-row')).toBeUndefined();
    expect(codeFor(document, '')).toBeUndefined();
  });

  it('is pure — the same values give the same answer', () => {
    expect(codeFor(document, 'ash-board')).toEqual(codeFor(document, 'ash-board'));
  });

  it('dispatches to the encoder the entry names', () => {
    expect(modulesFor({ sku: 'a', symbology: 'ean13', code: EAN })).toBe(encodeEan13(EAN));
    expect(modulesFor({ sku: 'a', symbology: 'code128', code: 'ADM-4417' })).toBe(
      encodeCode128('ADM-4417'),
    );
  });

  it('agrees with `isDrawable` about what it will draw', () => {
    for (const [symbology, code, drawable] of [
      ['ean13', EAN, true],
      ['ean13', '590', false],
      ['code128', 'ADM-4417', true],
      ['code128', '', false],
      ['code128', 'café', false],
    ] as const) {
      expect(isDrawable(symbology, code), `${symbology} ${code}`).toBe(drawable);
      if (drawable) expect(() => modulesFor({ sku: 'a', symbology, code })).not.toThrow();
    }
  });
});
