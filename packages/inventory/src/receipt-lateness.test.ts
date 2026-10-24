/**
 * WHETHER A DELIVERY CAME LATE.
 *
 * A receipt keeps the day its order said the delivery would come, the day it
 * really came in, and whether that was late: what a supplier's record of
 * on-time deliveries is counted from. "Late" means after the day the order
 * said, never on it. A receipt that cannot say (opening stock, a delivery
 * with no order, one not posted yet, one posted before the add-on kept the
 * day) says nothing: empty, not 0, so it never counts as on time.
 *
 * The formulas are worked out here with the evaluator the engine runs on
 * every write, from the published `@adminiumjs/manifest`.
 */
import { evaluateFormula, type FormulaExpr, validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

interface Column {
  ref: string;
  type: string;
  nullable?: boolean;
  rules?: Record<string, unknown>;
}
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: Column[] }[];
const receipts = tables.find((table) => table.ref === 'receipts')!;
const column = (ref: string): Column | undefined => receipts.columns.find((one) => one.ref === ref);
const formulaOf = (ref: string): FormulaExpr => {
  const formula = column(ref)?.rules?.['formula'];
  if (formula === undefined) throw new Error(`receipts.${ref} has no formula`);
  return formula as FormulaExpr;
};

/** A receipt as a write leaves it: the two days, either of which may be empty. */
const receipt = (expected: string | null, received: string | null) => ({ expected_on: expected, received_on: received });
const late = (expected: string | null, received: string | null) => evaluateFormula(formulaOf('late'), receipt(expected, received), 0);
const daysLate = (expected: string | null, received: string | null) => evaluateFormula(formulaOf('days_late'), receipt(expected, received), 0);

describe('a receipt keeps whether its delivery came late', () => {
  it('has the day it was expected, the day it came in, whether it was late and by how many days', () => {
    expect(['expected_on', 'received_on', 'late', 'days_late'].map((ref) => [ref, column(ref)?.type, column(ref)?.nullable])).toEqual([
      ['expected_on', 'date', true],
      ['received_on', 'date', true],
      ['late', 'int', true],
      ['days_late', 'int', true],
    ]);
  });

  it('takes the expected day from its order when the order is set, and keeps it after', () => {
    // `always`: the order's day, never one typed on the receipt. No `follow`: a day the order is moved to later
    // is not the day this delivery was promised for (and a stamp cannot be followed).
    expect(column('expected_on')?.rules).toMatchObject({ copy: { via: 'po_id', from: 'expected_on', mode: 'always' } });
    expect((column('expected_on')?.rules?.['copy'] as Record<string, unknown>)['follow']).toBeUndefined();
  });

  it('stamps the day it came in when the whole receipt is posted, as it stamps the time', () => {
    expect(column('received_on')?.rules).toMatchObject({ stamp: { set: 'today', on: { column: 'status', values: ['posted'] } } });
    expect((column('received_at')?.rules?.['stamp'] as { on: unknown }).on).toEqual({ column: 'status', values: ['posted'] });
  });

  it('works lateness out from the two days alone', () => {
    expect(column('late')?.rules).toEqual({ formula: formulaOf('late') });
    expect(column('days_late')?.rules).toEqual({ formula: formulaOf('days_late') });
  });

  it.each([
    ['came before the day', '2026-09-12', '2026-09-10', '0', '0'],
    ['came on the day', '2026-09-12', '2026-09-12', '0', '0'],
    ['came a day after', '2026-09-12', '2026-09-13', '1', '1'],
    ['came nine days after, across a month', '2026-09-28', '2026-10-07', '1', '9'],
  ])('a delivery that %s', (_, expected, received, isLate, days) => {
    expect([late(expected, received), daysLate(expected, received)]).toEqual([isLate, days]);
  });

  it.each([
    ['no order (opening stock, a delivery taken without one)', null, '2026-09-12'],
    ['not posted yet, or posted before the day was kept', '2026-09-12', null],
    ['neither day', null, null],
  ])('says nothing, not "on time", for a receipt with %s', (_, expected, received) => {
    expect([late(expected, received), daysLate(expected, received)]).toEqual([null, null]);
  });

  it('reads a day as the database hands it back', () => {
    // A date column reads as `YYYY-MM-DD` text on every engine; a driver's Date is the day it falls on.
    expect(late('2026-09-12', '2026-09-14')).toBe('1');
    expect(evaluateFormula(formulaOf('late'), { expected_on: new Date(2026, 8, 12), received_on: new Date(2026, 8, 12) }, 0)).toBe('0');
  });

  it('lets the clerk read all four, and nobody write them', () => {
    const clerk = (manifest.roles as unknown as { key: string; limits?: Record<string, { readable?: string[]; writable?: string[]; creatable?: string[] }> }[]).find((role) => role.key === 'clerk')!;
    for (const ref of ['expected_on', 'received_on', 'late', 'days_late']) {
      expect(clerk.limits?.['receipts']?.readable, ref).toContain(ref);
      expect(clerk.limits?.['receipts']?.writable, ref).not.toContain(ref);
      expect(clerk.limits?.['receipts']?.creatable, ref).not.toContain(ref);
    }
  });

  it('is a manifest an install accepts', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });
});
