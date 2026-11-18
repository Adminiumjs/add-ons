/**
 * DAYS, AS COUNTS ARE KEPT: in the business's zone, both ends included.
 */
import { describe, expect, it } from 'vitest';

import { addDays, dayIn, rangeOf, rangeWords, startsInside } from './days.ts';

describe('the ranges', () => {
  it('cover this month, last month, the last 7 and 30 days and the last 12 months, up to today', () => {
    const today = '2026-07-28';
    expect(rangeOf('this-month', today)).toEqual({ from: '2026-07-01', to: '2026-07-28' });
    expect(rangeOf('last-month', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(rangeOf('last-7', today)).toEqual({ from: '2026-07-22', to: '2026-07-28' });
    expect(rangeOf('last-30', today)).toEqual({ from: '2026-06-29', to: '2026-07-28' });
    expect(rangeOf('last-12-months', today)).toEqual({ from: '2025-08-01', to: '2026-07-28' });
  });

  it('turn the year in January, and know a short February', () => {
    expect(rangeOf('last-month', '2026-01-05')).toEqual({ from: '2025-12-01', to: '2025-12-31' });
    expect(rangeOf('last-month', '2024-03-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(rangeOf('last-12-months', '2026-12-31')).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('never ask more than the views route takes (400 days)', () => {
    const { from, to } = rangeOf('last-12-months', '2026-07-28');
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBeLessThan(400);
  });
});

describe('a day', () => {
  it('is the day in the business’s zone, not the reader’s', () => {
    const at = Date.parse('2026-07-31T23:30:00Z');
    expect(dayIn(at, 'Europe/Prague')).toBe('2026-08-01');
    expect(dayIn(at, 'America/New_York')).toBe('2026-07-31');
  });

  it('falls back to the reader’s zone when the zone is not one', () => {
    expect(dayIn(Date.parse('2026-07-15T12:00:00Z'), 'Not/AZone')).toBe('2026-07-15');
  });

  it('is said in the reader’s words, a range as one', () => {
    // The spaces around the dash are the narrow ones the locale writes.
    expect(rangeWords({ from: '2026-07-01', to: '2026-07-28' }, 'en-GB').replace(/\s/g, ' ')).toBe('1 – 28 Jul 2026');
    expect(rangeWords({ from: '2026-07-14', to: '2026-07-14' }, 'en-GB')).toBe('14 Jul 2026');
  });

  it('starts inside a range only after its first day', () => {
    const range = { from: '2026-07-01', to: '2026-07-28' };
    expect(startsInside('2026-07-14', range)).toBe(true);
    expect(startsInside('2026-07-01', range)).toBe(false);
    expect(startsInside('2026-06-14', range)).toBe(false);
    expect(startsInside('2026-08-01', range)).toBe(false);
    expect(startsInside(null, range)).toBe(false);
  });
});
