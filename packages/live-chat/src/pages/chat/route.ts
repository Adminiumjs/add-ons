/**
 * WHICH SCREEN AN ADDRESS OPENS.
 *
 * The dashboard hands the page everything after `/add-ons/live-chat/`: the
 * page ref first (`live-chat`), then the page's own path. Empty, it is the
 * add-on's root, which opens the inbox.
 */
import { PAGE, SETTINGS } from '../shared/paths.ts';

export type Route = { screen: 'inbox' } | { screen: 'settings' } | { screen: 'unknown' };

export function routeOf(splat: string): Route {
  const parts = splat.split('/').filter((part) => part !== '');
  if (parts.length === 0) return { screen: 'inbox' };
  const [ref, ...rest] = parts;
  if (ref !== PAGE) return { screen: 'unknown' };
  if (rest.length === 0) return { screen: 'inbox' };
  if (rest.length === 1 && rest[0] === SETTINGS) return { screen: 'settings' };
  return { screen: 'unknown' };
}

/** A conversation's id a link put in the address (`?conversation=<id>`); anything else is nothing. */
export const conversationIdOf = (value: unknown): string | null => {
  const text = typeof value === 'number' ? String(value) : value;
  return typeof text === 'string' && /^\d{1,20}$/.test(text) ? text : null;
};
