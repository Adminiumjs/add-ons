/**
 * WHICH SCREEN AN ADDRESS OPENS.
 *
 * The dashboard hands the page everything after `/add-ons/pages/`: the page
 * ref first (`pages`), then the page's own path (`shared/paths.ts`). Empty, it
 * is the add-on's root, which opens the list.
 */
import { EDIT, FUNNELS, NEW, PAGE } from '../shared/paths.ts';

export type Route =
  | { screen: 'list'; tab: 'pages' | 'funnels' }
  | { screen: 'new'; milo: boolean }
  | { screen: 'editor'; key: string }
  | { screen: 'funnel'; key: string }
  | { screen: 'unknown' };

/** A row's key as an address names it: digits only. */
export const rowKeyOf = (value: unknown): string | null => {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && /^\d{1,20}$/.test(text) ? text : null;
};

export function routeOf(splat: string, search: Readonly<Record<string, unknown>> = {}): Route {
  const parts = splat.split('/').filter((part) => part !== '');
  if (parts.length === 0) return { screen: 'list', tab: 'pages' };
  const [ref, ...rest] = parts;
  if (ref !== PAGE) return { screen: 'unknown' };
  if (rest.length === 0) return { screen: 'list', tab: 'pages' };
  if (rest.length === 1 && rest[0] === FUNNELS) return { screen: 'list', tab: 'funnels' };
  if (rest.length === 1 && rest[0] === NEW) return { screen: 'new', milo: search['milo'] === '1' || search['milo'] === 1 || search['milo'] === true };
  const key = rest.length === 2 ? rowKeyOf(decodeURIComponent(rest[1] ?? '')) : null;
  if (key !== null && rest[0] === EDIT) return { screen: 'editor', key };
  if (key !== null && rest[0] === FUNNELS) return { screen: 'funnel', key };
  return { screen: 'unknown' };
}
