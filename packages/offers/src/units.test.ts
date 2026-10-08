/**
 * MONEY, TO THE UNIT.
 *
 * Every amount in an answer is a whole number of cents inside the file that
 * decides. These are the three things that can go wrong with that: reading a
 * figure, taking a percent of it, and sharing one amount over several lines.
 */

import { describe, expect, it } from 'vitest';

import { proportion, split } from './adjust/split.ts';
import { fromUnits, percentOf, toUnits } from './units.ts';

describe('reading and writing an amount', () => {
  it('reads text digit by digit, and a number through its own text', () => {
    expect(toUnits('18.60', 2)).toBe(1860n);
    expect(toUnits('18.6', 2)).toBe(1860n);
    expect(toUnits('18', 2)).toBe(1800n);
    expect(toUnits(18.6, 2)).toBe(1860n);
    expect(toUnits('0.1', 2)! + toUnits('0.2', 2)!).toBe(30n);
    expect(toUnits('-3.50', 2)).toBe(-350n);
    expect(toUnits('5', 0)).toBe(5n);
  });

  it('rounds a figure finer than the order keeps, half away from nothing', () => {
    expect(toUnits('6.225', 2)).toBe(623n);
    expect(toUnits('6.224', 2)).toBe(622n);
    expect(toUnits('-6.225', 2)).toBe(-623n);
  });

  it('reads nothing, and what is no figure, as nothing', () => {
    for (const value of [null, undefined, '', 'abc', '1,50', true, {}]) expect(toUnits(value, 2), String(value)).toBeNull();
  });

  it('writes an amount with exactly the decimals asked', () => {
    expect(fromUnits(1860n, 2)).toBe('18.60');
    expect(fromUnits(5n, 2)).toBe('0.05');
    expect(fromUnits(0n, 2)).toBe('0.00');
    expect(fromUnits(-350n, 2)).toBe('-3.50');
    expect(fromUnits(1860n, 0)).toBe('1860');
    expect(fromUnits(1234567n, 3)).toBe('1234.567');
  });
});

describe('a percent', () => {
  it('is rounded once, half up', () => {
    expect(percentOf(4950n, '10')).toBe(495n);
    // 15 % of $28.00 is $4.20: the Monday mugs.
    expect(percentOf(2800n, '15')).toBe(420n);
    // 12.5 % of $49.80 is $6.225: six twenty-three, never six twenty-two.
    expect(percentOf(4980n, '12.5')).toBe(623n);
    expect(percentOf(4980n, 12.5)).toBe(623n);
    expect(percentOf(1n, '49')).toBe(0n);
    expect(percentOf(1n, '50')).toBe(1n);
    expect(percentOf(5360n, '100')).toBe(5360n);
  });

  it('of nothing, or no percent at all, is nothing', () => {
    expect(percentOf(0n, '10')).toBe(0n);
    expect(percentOf(4950n, null)).toBe(0n);
    expect(percentOf(4950n, '0')).toBe(0n);
    expect(percentOf(4950n, '-5')).toBe(0n);
  });
});

describe('one amount over several lines', () => {
  it('splits five dollars over three lines to the cent', () => {
    // $28.00 / $15.00 / $6.50: rounding each share to the nearest cent would give away $5.01.
    expect(split(500n, [2800n, 1500n, 650n])).toEqual([283n, 151n, 66n]);
    expect(split(495n, [2800n, 1500n, 650n])).toEqual([280n, 150n, 65n]);
  });

  it('gives the cents left over to the largest remainders, the earlier line on a tie', () => {
    expect(split(100n, [1n, 1n, 1n])).toEqual([1n, 1n, 1n]);
    expect(split(2n, [100n, 100n, 100n])).toEqual([1n, 1n, 0n]);
    expect(split(1n, [100n, 100n])).toEqual([1n, 0n]);
    expect(proportion(10n, [1n, 1n, 1n])).toEqual([4n, 3n, 3n]);
  });

  it('never takes more than there is, and nothing from a line that has nothing', () => {
    expect(split(4000n, [2520n, 0n])).toEqual([2520n, 0n]);
    expect(split(500n, [0n, 0n])).toEqual([0n, 0n]);
    expect(split(0n, [2800n, 1500n])).toEqual([0n, 0n]);
    expect(split(-5n, [2800n])).toEqual([0n]);
  });

  it('always adds up to the amount shared', () => {
    for (const total of [1n, 7n, 99n, 333n, 4999n]) {
      for (const left of [[2800n, 1500n, 650n], [1n, 2n, 3n, 4n, 5n], [999n, 1n], [5000n]]) {
        const shares = split(total, left);
        const whole = left.reduce((sum, one) => sum + one, 0n);
        expect(shares.reduce((sum, one) => sum + one, 0n), `${String(total)} over ${String(left)}`).toBe(total < whole ? total : whole);
        shares.forEach((share, at) => expect(share <= left[at]!, `${String(total)} over ${String(left)}`).toBe(true));
      }
    }
  });
});
