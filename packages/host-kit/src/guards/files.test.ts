/**
 * The reader every text guard sits on — driven at the places it has been beaten.
 *
 * `withoutComments` is the single point of failure for four guards at once: if
 * it eats a line, `brand`, `label-pairing`, `payload-casts` and `vendored` all
 * go blind together and all four report green. So it is checked against the
 * fixture that actually beat its two-regex ancestor, not only against ordinary
 * code.
 */

import { describe, expect, it } from 'vitest';

import { shippedFiles, walk, withoutComments } from './files.ts';
import { syntheticHost } from './synthetic-host.ts';

/*
 * The comment tokens, assembled rather than typed. A file that spelled them
 * would be a file whose own parsing this suite depends on, which is the joke
 * that writes itself and also a real hazard.
 */
const OPEN = `${'/'}${'*'}`;
const CLOSE = `${'*'}${'/'}`;

describe('the comment stripper', () => {
  it('is not blinded by two string literals carrying the comment tokens', () => {
    /*
     * THE WORST OF THEM, because it defeated every static net at once: the
     * opener inside the first string began a comment that ran to the closer
     * inside the third, and the harness deleted the import before any scanner
     * ran. Measured end to end in the host it was planted in — the suite stayed
     * green and the module was bundled.
     */
    const source = [
      `const openTok = "x ${OPEN}";`,
      'import { track } from "some-analytics-sdk";',
      `const closeTok = "z ${CLOSE}";`,
    ].join('\n');
    expect(withoutComments(source)).toContain('some-analytics-sdk');
  });

  it('still removes a real comment, in both spellings', () => {
    expect(withoutComments('const a = 1; // a note about DHL')).not.toContain('DHL');
    expect(withoutComments(`${OPEN} names Stripe ${CLOSE}\nconst a = 1;`)).not.toContain('Stripe');
    // …and a line comment ends at its line rather than eating the rest.
    expect(withoutComments('// gone\nconst kept = 1;')).toContain('kept');
  });

  it('keeps the line count, so a reported line number is the right one', () => {
    const source = [`${OPEN}`, ' * two', ' * lines', ` ${CLOSE}`, 'const onLineFive = 1;'].join(
      '\n',
    );
    const lines = withoutComments(source).split('\n');
    expect(lines).toHaveLength(5);
    expect(lines[4]).toContain('onLineFive');
  });

  it('does not read a URL inside a string as a comment', () => {
    // The half its two-regex ancestor already knew about, kept honest.
    const source = 'const a = "https://api.example.test/x"; const b = 2;';
    expect(withoutComments(source)).toContain('https://api.example.test/x');
    expect(withoutComments(source)).toContain('const b = 2');
  });

  it('does not desynchronise on a regular expression holding quotes', () => {
    // A pattern that matched `'…'` would read the rest of the file as one
    // string and every downstream gate would find nothing in it.
    const source = 'const re = /["\'`]/g;\nconst after = "kept";';
    expect(withoutComments(source)).toContain('after');
    expect(withoutComments(source)).toContain('kept');
  });

  it('lexes a template’s substitution as the code it is', () => {
    const source = 'const t = `a ${ { x: "nested" }.x } b`;\nconst after = 1;';
    const out = withoutComments(source);
    expect(out).toContain('nested');
    expect(out).toContain('after');
  });

  it('ends an unterminated literal at its line rather than blanking the file', () => {
    const source = 'const oops = "no closing quote\nconst after = 1;';
    expect(withoutComments(source)).toContain('after');
  });
});

describe('the file walk', () => {
  it('answers an absent directory with nothing rather than throwing', () => {
    // A host may genuinely have no vendor tree yet. Every caller that could be
    // fooled by this asserts it found something — the two halves together are
    // what make the quiet return honest.
    expect(walk('/definitely/not/a/directory/anywhere')).toEqual([]);
  });

  it('leaves the suites and the guard half out of what ships', () => {
    const host = syntheticHost({
      files: {
        'src/testing/kit/guards/lexicon.ts': 'export const SUBSTRING_BANNED = ["free"];\n',
        'src/screens/Shop.test.tsx': 'it("x", () => {});\n',
      },
    });
    try {
      const shipped = shippedFiles(host.config);
      expect(shipped.some((file) => file.includes('testing/kit'))).toBe(false);
      expect(shipped.some((file) => file.includes('.test.'))).toBe(false);
      // …and the vendored halves ARE shipped: they compile into this bundle.
      expect(shipped.some((file) => file.includes('add-ons/vendor'))).toBe(true);
    } finally {
      host.dispose();
    }
  });
});
