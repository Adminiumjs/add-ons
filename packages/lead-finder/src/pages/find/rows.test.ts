import { describe, expect, it } from 'vitest';

import { FOUND } from '../testing/fixtures.ts';
import { hasTickBox, rowState, tickable, websiteOf } from './rows.ts';

describe('what a found company’s row says', () => {
  it('tells added, here, kept by a colleague, no sales contact and sole trader apart', () => {
    expect(FOUND.map((company) => rowState(company, false))).toEqual([null, null, 'here', 'colleague', 'no-sales', 'sole']);
    expect(rowState(FOUND[0]!, true)).toBe('added');
    // A row whose key the reader is not sent is a colleague's, whatever else it says.
    expect(rowState({ ...FOUND[0]!, here: { key: null, keptByColleague: false, by: 'number' } }, false)).toBe('colleague');
  });

  it('gives a tick box to all but the flagged, and lets only the new ones be ticked', () => {
    expect(['added', 'here', 'colleague', 'no-sales', 'sole', null].map((state) => [hasTickBox(state as never), tickable(state as never)])).toEqual([
      [true, false],
      [true, false],
      [true, false],
      [false, false],
      [false, false],
      [true, true],
    ]);
  });

  it('links a website by https only', () => {
    expect(websiteOf({ ...FOUND[0]!, website: 'https://kestrelyard.example/' })).toEqual({ href: 'https://kestrelyard.example/', shown: 'kestrelyard.example' });
    expect(websiteOf({ ...FOUND[0]!, website: 'kestrelyard.example' })).toEqual({ href: 'https://kestrelyard.example', shown: 'kestrelyard.example' });
    expect(websiteOf({ ...FOUND[0]!, website: 'javascript:alert(1)' })).toBeNull();
    expect(websiteOf({ ...FOUND[0]!, website: 'http://kestrelyard.example' })).toBeNull();
  });
});
