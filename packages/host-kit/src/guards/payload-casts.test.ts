/**
 * The AST ban, driven over the mutant it was written for.
 *
 * Both directions matter and for different reasons. A rule that reports nothing
 * is indistinguishable from a rule that is switched off — and this one closes a
 * defect that leaves `tsc -b` clean and every suite green, so there is nothing
 * else in either repository that would notice its absence. A rule that reports
 * the app's own working code gets an exemption list, and an exemption list is
 * where nine of wave 4b's holes came from.
 */

import { describe, expect, it } from 'vitest';

import { mountCount, payloadCasts } from './payload-casts.ts';

describe('a cast inside a slot payload', () => {
  it('reports the verifier’s mutant', () => {
    // Verbatim: this exact line left `tsc -b` clean in one host and made a
    // picture disappear in the other.
    const mutant = `
      const x = (
        <AddOnSlot
          slot="cart.line.preview"
          payload={{ line: { id: "x", name: "x" } as never }}
        />
      );
    `;
    const found = payloadCasts('mutant.tsx', mutant);
    expect(found).toHaveLength(1);
    expect(found[0]?.text).toContain('as never');
  });

  it('follows a payload built one line above the mount', () => {
    // Moving the object up two lines is the obvious way to put a cast back out
    // of reach, so the rule follows a bare identifier one hop.
    const throughAVariable = `
      const payload = { line: undefined as never };
      const x = <AddOnSlot slot="cart.line.preview" payload={payload} />;
    `;
    expect(payloadCasts('hop.tsx', throughAVariable)).toHaveLength(1);
  });

  it('reads `!` as the same promise to the compiler, with fewer letters', () => {
    expect(
      payloadCasts('bang.tsx', 'const x = <AddOnSlot slot="s" payload={{ line: maybe! }} />;'),
    ).toHaveLength(1);
  });

  it('records that the angle-bracket spelling cannot be written here at all', () => {
    /*
     * `<never>value` is the older way to write an assertion and it does NOT
     * exist in a `.tsx` file: TypeScript gives the angle brackets to JSX, so
     * the parser reads an element and the walker's `isTypeAssertionExpression`
     * branch cannot fire. Recorded rather than deleted, because the walker is
     * exported and a reader may point it at a `.ts` source one day — and
     * because a branch nobody can explain is a branch somebody removes and then
     * re-adds after a bug.
     */
    expect(
      payloadCasts('old.tsx', 'const x = <AddOnSlot slot="s" payload={<never>value} />;'),
    ).toEqual([]);
  });

  it('forgives the message-key idiom these apps use ninety times', () => {
    /*
     * A message key built at run time cannot be a member of a union derived
     * from the English bundle, so the cast is unavoidable and carries no
     * payload data at all. Reporting it would fire on working code on the first
     * run in every host.
     */
    const honest = `
      const x = (
        <AddOnSlot
          slot="cart.line.preview"
          payload={{ line: orderItem(waiting, t(\`data.product.\${k}.name\` as never)) }}
        />
      );
    `;
    expect(payloadCasts('honest.tsx', honest)).toEqual([]);
  });

  it('says nothing about a cast that is not in a payload', () => {
    // The scope is the thing that makes the rule livable: a cast anywhere else
    // in a screen is the screen's own business.
    const elsewhere = `
      const key = ("shop.title" as never);
      const x = <AddOnSlot slot="s" payload={{ order }} />;
    `;
    expect(payloadCasts('elsewhere.tsx', elsewhere)).toEqual([]);
  });

  it('says nothing about a cast in a DIFFERENT component’s payload prop', () => {
    // `payload` is not a reserved word. Only `<AddOnSlot>`'s is in scope.
    const other = 'const x = <SomethingElse payload={{ a: b as never }} />;';
    expect(payloadCasts('other.tsx', other)).toEqual([]);
  });

  it('reports the line, so a reader is sent to the right one', () => {
    const source = ['const a = 1;', '', 'const x = <AddOnSlot slot="s" payload={{ a: b! }} />;'].join(
      '\n',
    );
    expect(payloadCasts('lines.tsx', source).map((f) => f.line)).toEqual([3]);
  });
});

describe('the guard on the guard', () => {
  it('counts mounts in both JSX spellings', () => {
    expect(mountCount('a.tsx', '<AddOnSlot slot="s" payload={{}} />')).toBe(1);
    expect(mountCount('b.tsx', '<AddOnSlot slot="s" payload={{}}><p>x</p></AddOnSlot>')).toBe(1);
    expect(mountCount('c.tsx', '<div><AddOnSlot slot="a" /><AddOnSlot slot="b" /></div>')).toBe(2);
  });

  it('sees nothing where there is nothing, which is what the grep is compared with', () => {
    /*
     * The pairing this replaces a threshold with: a file that MENTIONS the
     * component in code must produce at least one mount. A threshold ("more
     * than five") is a number fitted to whichever app its author had open, and
     * the same number is a pass in a host with nine slots and a red suite on a
     * faultless host with three.
     */
    expect(mountCount('d.tsx', 'export const X = () => <p>no slots here</p>;')).toBe(0);
    // And a mount inside a JSX comment is not a mount — which is exactly the
    // disagreement the guard's own case is looking for.
    expect(mountCount('e.tsx', 'const x = <div>{/* <AddOnSlot slot="s" /> */}</div>;')).toBe(0);
  });
});
