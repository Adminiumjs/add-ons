/**
 * The money law of a document built on a shape, held three ways against one
 * table.
 *
 * `shape-money-fixture.json` is the table: lines in currencies with none, two
 * and three decimals, both kinds of reduction, a stage of a quote, tax rates
 * from 0 to 25 % with up to three places. It is reproduced here
 *
 *   1. by `shape-money.ts`, this package's statement of the law, and
 *   2. by ADMINIUM'S OWN formula evaluator (`@adminiumjs/manifest`) running
 *      the formulas the shape actually declares in `manifest.json`,
 *
 * so a change to either the formulas or the reference that the other does not
 * share turns this red. Adminium's engine tests read the same file, which is
 * the third way: the stored values on three databases.
 *
 * The first seven cases are worked by hand in their names — not by calling
 * the law, because a test that computes its expectation the way the code does
 * asserts only that the code agrees with itself.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { currencyScale, evaluateFormula } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { currencyDigits } from './render/format.ts';
import fixture from './shape-money-fixture.json' with { type: 'json' };
import { documentTotals, lineAmount, type ShapeLine } from './shape-money.ts';

interface FixtureLine {
  qty: string;
  rate: string;
  discountKind?: 'amount' | 'percent';
  discount?: string;
  share?: string;
  expect: string;
}

interface FixtureCase {
  name: string;
  currency: string;
  taxRate: string | null;
  lines: FixtureLine[];
  expect: { subtotal: string; tax: string; total: string };
}

const CASES = fixture.cases as FixtureCase[];

type Formula = Parameters<typeof evaluateFormula>[0];
const invoice = (manifest.addOn as unknown as { shapes: { name: string; parts: Record<string, { columns: { ref: string; rules?: { formula?: Formula } }[] }> }[] }).shapes.find(
  (shape) => shape.name === 'invoice',
)!;
const formula = (part: string, ref: string): Formula => invoice.parts[part]!.columns.find((column) => column.ref === ref)!.rules!.formula!;

const asLine = (line: FixtureLine): ShapeLine => ({
  qty: line.qty,
  rate: line.rate,
  discountKind: line.discountKind ?? 'amount',
  discount: line.discount ?? null,
  share: line.share ?? null,
});

describe('the fixture covers what it says it covers', () => {
  it('has currencies with none, two and three decimals, both reductions, a stage line, and tax up to 25 %', () => {
    const scales = new Set(CASES.map((entry) => currencyScale(entry.currency)));
    expect([...scales].sort()).toEqual([0, 2, 3]);
    const lines = CASES.flatMap((entry) => entry.lines);
    expect(lines.some((line) => line.discountKind === 'amount')).toBe(true);
    expect(lines.some((line) => line.discountKind === 'percent')).toBe(true);
    expect(lines.some((line) => line.share !== undefined)).toBe(true);
    const rates = CASES.map((entry) => Number(entry.taxRate ?? 0));
    expect(Math.min(...rates)).toBe(0);
    expect(Math.max(...rates)).toBeLessThanOrEqual(25);
    expect(CASES.length).toBeGreaterThanOrEqual(60);
  });
});

describe('this package’s reference reproduces the fixture', () => {
  it.each(CASES)('$name', (entry) => {
    const scale = currencyDigits(entry.currency);
    const amounts = entry.lines.map((line) => lineAmount(asLine(line), scale));
    expect(amounts).toEqual(entry.lines.map((line) => line.expect));
    expect(documentTotals(amounts, entry.taxRate, scale)).toEqual(entry.expect);
  });
});

describe('Adminium’s evaluator, running the shape’s own formulas, reproduces the fixture', () => {
  it.each(CASES)('$name', (entry) => {
    const scale = currencyScale(entry.currency);
    const amounts = entry.lines.map((line) =>
      evaluateFormula(
        formula('lines', 'amount'),
        {
          qty: line.qty,
          rate: line.rate,
          discount_kind: line.discountKind ?? 'amount',
          discount: line.discount ?? null,
          quote_id: line.share === undefined ? null : 1,
          share_pct: line.share ?? null,
        },
        scale,
      ),
    );
    expect(amounts).toEqual(entry.lines.map((line) => line.expect));
    const { subtotal } = entry.expect;
    const tax = evaluateFormula(formula('document', 'tax'), { subtotal, tax_rate: entry.taxRate }, scale);
    expect(tax).toBe(entry.expect.tax);
    expect(evaluateFormula(formula('document', 'total'), { subtotal, tax }, scale)).toBe(entry.expect.total);
  });
});

describe('the decimals a document is printed with are the ones its figures are stored with', () => {
  it('agrees with Adminium for every currency the runtime knows', () => {
    const codes = (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf('currency');
    expect(codes.length).toBeGreaterThan(100);
    for (const code of codes) expect(currencyDigits(code), code).toBe(currencyScale(code));
  });
});

describe('the hand-mapped law is left exactly as it was', () => {
  it('keeps money-fixture.json byte for byte — Adminium holds a copy that must stay equal', () => {
    // The digest of the file as it stood before the shapes arrived. A change
    // here breaks Adminium's own check that the two copies agree.
    const bytes = readFileSync(new URL('./money-fixture.json', import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(MONEY_FIXTURE_SHA256);
  });
});

const MONEY_FIXTURE_SHA256 = '62d1ccca4e53639677e07ad85b1e755ed71a86754a254456f3970bb3be0eb51b';
