/**
 * Figures as whole numbers: read exactly, rounded once, written with the
 * places their column keeps.
 */
import { describe, expect, it } from 'vitest';

import { COST, divFloor, divRound, mul, QTY, read, readOr0, shown, text, whole } from './decimal.ts';

describe('a figure read', () => {
  it('is exact from text and from a number, and nothing from nothing', () => {
    expect(read('12.5', QTY)).toBe(12500n);
    expect(read(12.5, QTY)).toBe(12500n);
    expect(read('0.1', QTY)! + read('0.2', QTY)!).toBe(300n);
    expect(read(0.1, QTY)! + read(0.2, QTY)!).toBe(300n);
    expect(read('-3', QTY)).toBe(-3000n);
    expect(read('1.1000', COST)).toBe(11000n);
    expect(read(null, QTY)).toBeNull();
    expect(read('', QTY)).toBeNull();
    expect(readOr0(undefined, QTY)).toBe(0n);
  });

  it('rounds what is past its places half away from zero', () => {
    expect(read('1.2345', QTY)).toBe(1235n);
    expect(read('1.2344', QTY)).toBe(1234n);
    expect(read('-1.2345', QTY)).toBe(-1235n);
    expect(read('1.21718', COST)).toBe(12172n);
  });

  it('refuses what is not a figure', () => {
    expect(() => read('twelve', QTY)).toThrow();
    expect(() => read('1e3', QTY)).toThrow();
    expect(() => read(true, QTY)).toThrow();
  });
});

describe('a figure written', () => {
  it('carries exactly its column\'s places', () => {
    expect(text(12500n, QTY)).toBe('12.500');
    expect(text(-3000n, QTY)).toBe('-3.000');
    expect(text(5n, QTY)).toBe('0.005');
    expect(text(0n, COST)).toBe('0.0000');
    expect(text(12172n, COST)).toBe('1.2172');
    expect(text(14n, 0)).toBe('14');
  });

  it('is shown in an item\'s own places, rounded down', () => {
    expect(shown(4000n, 0)).toBe('4');
    expect(shown(4999n, 0)).toBe('4');
    expect(shown(1250n, 2)).toBe('1.25');
    expect(shown(1259n, 2)).toBe('1.25');
    expect(shown(1259n, 3)).toBe('1.259');
  });
});

describe('arithmetic', () => {
  it('multiplies two figures into the places asked for, rounding once', () => {
    // 2.000 × 1.500 = 3.000
    expect(mul(2000n, QTY, 1500n, QTY, QTY)).toBe(3000n);
    // 0.333 × 0.333 = 0.110889 → 0.111
    expect(mul(333n, QTY, 333n, QTY, QTY)).toBe(111n);
    // 14 × 1.1000 in ten-thousandths
    expect(mul(14000n, QTY, 11000n, COST, COST)).toBe(154000n);
  });

  it('divides half away from zero, or down', () => {
    expect(divRound(7n, 2n)).toBe(4n);
    expect(divRound(-7n, 2n)).toBe(-4n);
    expect(divRound(5n, 3n)).toBe(2n);
    expect(divFloor(7n, 2n)).toBe(3n);
    expect(() => divRound(1n, 0n)).toThrow();
  });

  it('works the average a receipt moves: (14 × 1.10 + 50 × 1.25) ÷ 64 = 1.2172', () => {
    const value = mul(14000n, QTY, 11000n, COST, COST + QTY) + mul(50000n, QTY, 12500n, COST, COST + QTY);
    expect(text(divRound(value, 64000n), COST)).toBe('1.2172');
  });

  it('takes a whole multiplier', () => {
    expect(whole(2, QTY)).toBe(2000n);
    expect(whole(1.5, QTY)).toBe(1500n);
  });
});
