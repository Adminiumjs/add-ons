import { describe, expect, it } from 'vitest';

import { routeOf } from './route.ts';

describe('which screen an address opens', () => {
  it('opens Find companies at the root, and each screen at its own path', () => {
    expect(routeOf('')).toEqual({ screen: 'find' });
    expect(routeOf('lead-finder')).toEqual({ screen: 'find' });
    expect(routeOf('lead-finder/people')).toEqual({ screen: 'people' });
    expect(routeOf('lead-finder/settings')).toEqual({ screen: 'sources' });
    expect(routeOf('lead-finder/settings/sources')).toEqual({ screen: 'sources' });
    expect(routeOf('lead-finder/settings/people/')).toEqual({ screen: 'people-settings' });
    expect(routeOf('lead-finder/settings/people/mail')).toEqual({ screen: 'mail' });
  });

  it('opens nothing for another page or a path it does not know', () => {
    expect(routeOf('forms')).toEqual({ screen: 'unknown' });
    expect(routeOf('lead-finder/people/7')).toEqual({ screen: 'unknown' });
  });
});
