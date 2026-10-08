// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

import { money } from './host.ts';

describe('a sum of money on a screen', () => {
  it('reads with two places whichever database stored it, and is never worked out again', () => {
    // SQLite hands a number, Postgres text with its places: both read the same.
    expect(money(18, 'en-US')).toBe('18.00');
    expect(money('18.00', 'en-US')).toBe('18.00');
    expect(money('7490.43', 'en-US')).toBe('7,490.43');
    expect(money(-0.95, 'en-US')).toBe('\u22120.95');
    expect(money('1490.6', 'de-DE')).toBe('1.490,60');
    // Text, not a float: a figure too long for one keeps every digit.
    expect(money('12345678901234567.89', 'en-US')).toBe('12,345,678,901,234,567.89');
    expect(money(null, 'en-US')).toBe('');
    expect(money('n/a', 'en-US')).toBe('n/a');
  });

  it('carries the sign of the database\'s currency where the reader\'s language puts it, and none when there is none', () => {
    expect(money('7490.43', 'en-US', 'USD')).toBe('$7,490.43');
    expect(money('-18', 'en-US', 'usd')).toBe('\u2212$18.00');
    expect(money('1490.6', 'de-DE', 'EUR')).toBe('1.490,60\u00a0€');
    expect(money('12345678901234567.89', 'en-US', 'USD')).toBe('$12,345,678,901,234,567.89');
    expect(money('18', 'en-US', null)).toBe('18.00');
    expect(money('18', 'en-US', 'not a code')).toBe('18.00');
  });
});
