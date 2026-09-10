/**
 * The money law against the shared fixture (34-invoices-add-on.md 34-T54), on
 * the ADD-ON's copy of `money.ts` — the third of three.
 *
 * The other two are the dashboard's `model/money.test.ts` and the server's
 * `test/invoice-money.test.ts`, and all three read the same JSON table.
 * `scripts/check-invoice-money-fixture.mjs` in the Adminium repo holds the
 * three copies of that table byte-identical; each tree's test holds its copy
 * of the LAW to its copy of the table. Both halves are needed: without the
 * gate a tree could edit its fixture and stay green on a law nobody else has;
 * without this test the gate would only prove three identical files nobody
 * asserts anything against.
 *
 * WHY THIS TREE MATTERS MOST. The dashboard's number is what somebody sees
 * while typing and the server's is what gets stored — but this one is what
 * gets PRINTED, emailed, and filed. A drift here is the copy that leaves the
 * building.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import {
  formatMoney,
  formatPercent,
  fxMinor,
  lineMinor,
  parseBasisPoints,
  parseDecimal,
  parseMinor,
  percentOf,
  taxBreakdown,
  totalsOf,
} from './money.ts';

interface Fixture {
  cases: {
    name: string;
    items: { qty: string; rate: string }[];
    discountRate: string;
    taxRate: string;
    expect: {
      lines: number[];
      subtotal: number;
      discount: number;
      taxBase: number;
      tax: number;
      total: number;
    };
  }[];
  breakdown: { taxBase: number; lines: { label: string; rate: string }[]; expect: number[] };
  fx: { totalMinor: number; rates: { rate: string; expect: number }[] };
  format: { minor: number; currency: string; cents: boolean; expect: string }[];
}

const fixture = JSON.parse(
  readFileSync(new URL('./money-fixture.json', import.meta.url), 'utf8'),
) as Fixture;

describe('the money law (34 D20 / O25) — the renderer copy', () => {
  for (const scenario of fixture.cases) {
    it(scenario.name, () => {
      const totals = totalsOf({
        items: scenario.items.map((item, at) => ({ id: String(at), desc: '', ...item })),
        discountRate: scenario.discountRate,
        taxRate: scenario.taxRate,
      });
      expect(totals).toEqual(scenario.expect);
    });
  }

  it('puts every tax-breakdown component on the ladder’s own base', () => {
    // O25's correction. The comp computed these on the UNDISCOUNTED subtotal
    // (1709), which made a discounted document's components add up to more tax
    // than the ladder charged.
    expect(
      taxBreakdown(fixture.breakdown.taxBase, fixture.breakdown.lines).map((line) => line.amount),
    ).toEqual(fixture.breakdown.expect);
  });

  it('multiplies the total by the typed rate for a second currency', () => {
    for (const row of fixture.fx.rates) {
      expect(fxMinor(fixture.fx.totalMinor, row.rate)).toBe(row.expect);
    }
  });

  it('formats a figure the way the printed document must', () => {
    for (const row of fixture.format) {
      expect(formatMoney(row.minor, row.currency, row.cents)).toBe(row.expect);
    }
  });
});

describe('the parsing the law rests on', () => {
  it('goes from decimal text to minor units without touching a float', () => {
    // `0.1 * 100` is 10.000000000000002 in binary floating point. Every one of
    // these would be one minor unit out if the law went through a multiply.
    expect(parseMinor('0.1')).toBe(10);
    expect(parseMinor('0.10')).toBe(10);
    expect(parseMinor('.5')).toBe(50);
    expect(parseMinor('1234')).toBe(123400);
    expect(parseMinor('-0.005')).toBe(-1);
  });

  it('accepts the comma decimal mark and the typographic minus the sheet prints', () => {
    expect(parseMinor('12,50')).toBe(1250);
    expect(parseDecimal('−5')).toBe(-5);
    expect(parseBasisPoints('7,5')).toBe(750);
  });

  it('reads unparseable text as zero rather than NaN', () => {
    // A NaN would propagate silently through every total on the page and print
    // as "NaN" on a document somebody sends a customer.
    expect(parseMinor('two')).toBe(0);
    expect(parseDecimal('$5')).toBe(0);
    expect(parseBasisPoints('')).toBe(0);
    expect(lineMinor({ qty: 'x', rate: 'y' })).toBe(0);
  });

  it('rounds a percentage half away from zero, in both directions', () => {
    expect(percentOf(75, '10')).toBe(8);
    expect(percentOf(-75, '10')).toBe(-8);
  });

  it('renders a percentage the way the comp does', () => {
    expect(formatPercent('8')).toBe('8%');
    expect(formatPercent('7.5')).toBe('7.5%');
    expect(formatPercent('abc')).toBe('0%');
  });
});
