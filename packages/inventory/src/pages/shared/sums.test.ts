import { describe, expect, it } from 'vitest';

import { against, times, wholeTimes } from './sums.ts';

describe('what the screen works out while somebody types', () => {
  it('multiplies packs by their size exactly, as text', () => {
    expect(times('4', '50')).toBe('200');
    expect(times('3', '0.25')).toBe('0.75');
    expect(times('0.1', '0.2')).toBe('0.02');
    expect(times('12345678901234567890', '10')).toBe('123456789012345678900');
    expect(times('', '50')).toBeNull();
    expect(times('four', '50')).toBeNull();
    expect(times('-1', '50')).toBeNull();
  });

  it('says what is still to come, what is over, and when it is even', () => {
    expect(against('200', '150')).toEqual({ side: 'short', by: '50' });
    expect(against('200', '220')).toEqual({ side: 'over', by: '20' });
    expect(against('200.000', '200')).toEqual({ side: 'even', by: '0' });
    expect(against('0.3', '0.1')).toEqual({ side: 'short', by: '0.2' });
    expect(against('', '1')).toBeNull();
  });

  it('counts in packs only where none is broken', () => {
    expect(wholeTimes('50', '50')).toBe('1');
    expect(wholeTimes('20', '50')).toBeNull();
    expect(wholeTimes('0.75', '0.25')).toBe('3');
    expect(wholeTimes('5', '0')).toBeNull();
  });
});
