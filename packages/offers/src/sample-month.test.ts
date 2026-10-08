/**
 * THE SAMPLE'S MONTH, ADDED UP.
 *
 * The sample's figures are quoted in the docs, drawn on the Overview and
 * asserted by the engine's install test. They are not typed in anywhere: they
 * are what the adjuster answers for September's 312 orders. This suite runs
 * the month and holds every total to the cent — so a change to the order of
 * reductions, to a rounding or to a minimum's base moves a figure here before
 * it moves one in front of an owner.
 */

import type { AdjustOutput } from '@adminium/add-on-contracts';
import { describe, expect, it } from 'vitest';

import { adjust } from './adjust/index.ts';
import { OPEN_DAYS, questionOf, sampleOrders } from './cases/sample-month.ts';

const cents = (text: string): number => Math.round(Number(text) * 100);
const dollars = (value: number): string => (value / 100).toFixed(2);

interface Use {
  order: number;
  source: string;
  amount: number;
}

/** The month, order by order: what was used, what was refused, and what each order had taken off. */
function run(): { uses: Use[]; refused: { order: number; typed: string; reason: string }[]; answers: AdjustOutput[] } {
  const uses: Use[] = [];
  const refused: { order: number; typed: string; reason: string }[] = [];
  const answers: AdjustOutput[] = [];
  let launch = 0;
  for (const order of sampleOrders()) {
    const answer = adjust(questionOf(order, launch));
    answers.push(answer);
    for (const use of answer.uses) {
      const source = use.offer !== null ? `offer ${use.offer}` : use.voucher !== null ? (use.voucher === '1' ? 'thing' : 'leaflet') : `staff ${order.staff?.reason ?? ''}`;
      uses.push({ order: order.number, source, amount: cents(use.amount) });
      if (use.offer === '5') launch += 1;
    }
    for (const one of answer.refused) refused.push({ order: order.number, typed: one.typed, reason: one.reason });
  }
  return { uses, refused, answers };
}

describe('September', () => {
  const month = run();
  const of = (source: string) => month.uses.filter((use) => use.source === source);
  const told = (source: string) => `${String(of(source).length)} / ${dollars(of(source).reduce((total, use) => total + use.amount, 0))}`;

  it('is twenty-six open days of twelve orders', () => {
    expect(OPEN_DAYS).toHaveLength(26);
    expect(month.answers).toHaveLength(312);
  });

  it('three hundred and twelve orders give the sample\'s totals', () => {
    // Uses and what was given, by rule: Welcome 10, Monday mugs, Tote pair, Autumn 5, Launch week, Summer close-out.
    expect([1, 2, 3, 4, 5, 6].map((id) => told(`offer ${String(id)}`))).toEqual(['41 / 117.48', '9 / 22.50', '6 / 90.00', '20 / 100.00', '50 / 280.20', '0 / 0.00']);
    const rules = month.uses.filter((use) => use.source.startsWith('offer'));
    expect(`${String(rules.length)} / ${dollars(rules.reduce((total, use) => total + use.amount, 0))}`).toBe('126 / 610.18');
    // By hand: Damaged, Goodwill, Staff purchase, Manager.
    expect([1, 2, 3, 4].map((id) => told(`staff ${String(id)}`))).toEqual(['4 / 24.10', '3 / 11.40', '5 / 21.98', '0 / 0.00']);
    const staff = month.uses.filter((use) => use.source.startsWith('staff'));
    expect(`${String(staff.length)} / ${dollars(staff.reduce((total, use) => total + use.amount, 0))}`).toBe('12 / 57.48');
    // Vouchers, shown apart.
    expect(told('leaflet')).toBe('23 / 115.00');
    expect(told('thing')).toBe('1 / 18.00');
    expect(`${String(month.uses.length)} / ${dollars(month.uses.reduce((total, use) => total + use.amount, 0))}`).toBe('162 / 800.66');
  });

  it('refuses four codes: two under the minimum, two after the launch code ran out', () => {
    expect(month.refused.map((one) => `${one.typed} ${one.reason}`).sort()).toEqual(['AUTUMN5 needs-minimum', 'AUTUMN5 needs-minimum', 'LAUNCH20 used-up', 'LAUNCH20 used-up']);
    // The launch code took its fiftieth use on Tuesday the fifteenth.
    const fiftieth = of('offer 5')[49]!;
    expect(sampleOrders()[fiftieth.order - 1]!.day).toBe(15);
  });

  it('every cent off an order is a use, and every order\'s lines add up to it', () => {
    month.answers.forEach((answer, at) => {
      const used = month.uses.filter((use) => use.order === at + 1).reduce((total, use) => total + use.amount, 0);
      expect(cents(answer.order.discount), `order ${String(at + 1)}`).toBe(used);
      expect(answer.lines.reduce((total, one) => total + cents(one.discount), 0), `order ${String(at + 1)}`).toBe(used);
      expect(answer.applied.reduce((total, one) => total + cents(one.amount), 0), `order ${String(at + 1)}`).toBe(used);
    });
  });

  it('the one candle voucher was used on order 125, with the launch code beside it', () => {
    const thing = of('thing')[0]!;
    expect(thing.order).toBe(125);
    // A speckled mug and a fig candle, $32.00: the candle by voucher, then twenty percent of the mug.
    expect(month.answers[124]!.applied.map((one) => `${one.kind} ${one.amount}`)).toEqual(['voucher 18.00', 'code 2.80']);
  });
});
