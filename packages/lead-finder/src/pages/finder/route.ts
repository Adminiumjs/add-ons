/**
 * WHICH SCREEN AN ADDRESS OPENS.
 *
 * The dashboard hands the page everything after `/add-ons/lead-finder/`: the
 * page ref first (`lead-finder`), then the page's own path. Empty, it is the
 * add-on's root, which opens Find companies.
 */
import { PAGE } from '../shared/paths.ts';

export type Route = { screen: 'find' } | { screen: 'people' } | { screen: 'sources' } | { screen: 'people-settings' } | { screen: 'mail' } | { screen: 'unknown' };

export function routeOf(splat: string): Route {
  const parts = splat.split('/').filter((part) => part !== '');
  if (parts.length === 0) return { screen: 'find' };
  const [ref, ...rest] = parts;
  if (ref !== PAGE) return { screen: 'unknown' };
  const path = rest.join('/');
  switch (path) {
    case '':
      return { screen: 'find' };
    case 'people':
      return { screen: 'people' };
    case 'settings':
    case 'settings/sources':
      return { screen: 'sources' };
    case 'settings/people':
      return { screen: 'people-settings' };
    case 'settings/people/mail':
      return { screen: 'mail' };
    default:
      return { screen: 'unknown' };
  }
}
