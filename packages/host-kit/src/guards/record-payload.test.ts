/**
 * The record.actions payload guard, caught failing (34 §5.3; 34-T28).
 *
 * The mount in every fixture is §6.1 step 2's, verbatim in shape — the one the
 * plan writes for `Complete.tsx:94`.
 */
import { describe, expect, it } from 'vitest';

import { recordPayloadFindings } from './record-payload.ts';

const GOOD = `
export function Complete({ sale }: { sale: Sale }) {
  return (
    <AddOnSlot
      slot="record.actions"
      payload={{
        entity: 'sale',
        recordId: String(sale.number),
        record: subjectFieldsOf(sale),
        now: shopClock(sale.at),
      }}
    />
  );
}
`;

describe('a record.actions mount hands over an entity and a record', () => {
  it('says nothing about the mount §6.1 step 2 describes', () => {
    expect(recordPayloadFindings('Complete.tsx', GOOD, ['sale'])).toEqual([]);
  });

  it('reports a mount with no record to draw from', () => {
    // Without one the fill can only refuse, and the refusal arrives on a
    // customer's screen rather than in a test.
    const source = GOOD.replace('record: subjectFieldsOf(sale),', '');
    expect(recordPayloadFindings('Complete.tsx', source, ['sale']).map((f) => f.code)).toEqual([
      'missing:record',
    ]);
  });

  it('reports a mount with no entity', () => {
    const source = GOOD.replace("entity: 'sale',", '');
    expect(recordPayloadFindings('Complete.tsx', source, []).map((f) => f.code)).toEqual([
      'missing:entity',
    ]);
  });

  it('accepts a shorthand member, because `{record}` is still a record', () => {
    const source = GOOD.replace('record: subjectFieldsOf(sale),', 'record,');
    expect(recordPayloadFindings('Complete.tsx', source, ['sale'])).toEqual([]);
  });
});

describe('the record is a projection, not a mount-site literal', () => {
  it('reports slot ids typed out at the mount site', () => {
    /*
     * This compiles, renders and draws a correct document today. What it does
     * is put ONE add-on's slot ids inside a host screen — so the day a slot is
     * renamed, or a second kind arrives, this literal is the copy nobody
     * remembers. §5.3's whole inversion is that the host projects through a
     * named function and the add-on validates the result.
     */
    const source = GOOD.replace(
      'record: subjectFieldsOf(sale),',
      "record: { customerName: sale.customer, total: sale.total },",
    );
    const codes = recordPayloadFindings('Complete.tsx', source, ['sale']).map((f) => f.code);
    expect(codes).toContain('inline-record');
  });

  it('says nothing when the whole payload is built elsewhere and passed by name', () => {
    // A host may compute the payload; following an identifier would make this
    // guard a type checker, and tsc already holds the payload TYPE.
    const source = GOOD.replace(/payload=\{\{[\s\S]*?\}\}/, 'payload={receiptPayload(sale)}');
    expect(recordPayloadFindings('Complete.tsx', source, ['sale'])).toEqual([]);
  });
});

describe('the entity is one the host serves', () => {
  it('reports a mount for a record type the served list does not name', () => {
    const source = GOOD.replace("entity: 'sale',", "entity: 'refund',");
    expect(recordPayloadFindings('Complete.tsx', source, ['sale']).map((f) => f.code)).toEqual([
      'entity-not-served:refund',
    ]);
  });

  it('skips the question when the host declares no list', () => {
    const source = GOOD.replace("entity: 'sale',", "entity: 'refund',");
    expect(recordPayloadFindings('Complete.tsx', source, [])).toEqual([]);
  });
});

describe('what it does not mistake for a mount', () => {
  it('ignores a mount for a different slot', () => {
    const source = GOOD.replace('slot="record.actions"', 'slot="order.dispatch.actions"');
    expect(recordPayloadFindings('Complete.tsx', source, ['sale'])).toEqual([]);
  });

  it('ignores another component that happens to take a payload', () => {
    const source = GOOD.replace(/AddOnSlot/g, 'SomeOtherThing');
    expect(recordPayloadFindings('Complete.tsx', source, ['sale'])).toEqual([]);
  });

  it('reads a mount written as an open/close pair, not only a self-closing one', () => {
    const source = GOOD.replace('/>', '>{null}</AddOnSlot>').replace(
      'record: subjectFieldsOf(sale),',
      '',
    );
    expect(recordPayloadFindings('Complete.tsx', source, ['sale']).map((f) => f.code)).toEqual([
      'missing:record',
    ]);
  });
});
