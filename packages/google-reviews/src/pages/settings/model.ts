/**
 * WHAT THE SETTINGS SCREEN DECIDES, apart from how it is drawn.
 *
 * One row of `places` per app. The key is a browser key, so it is shown and
 * never treated as a secret. It is restricted to the address the box loads
 * from: the box is a page of this Adminium, framed wherever the app is shown,
 * so that one origin is what Google sees, on a studio's own website too.
 */

export interface Draft {
  place_id: string;
  browser_key: string;
  restricted: boolean;
  on_booking: boolean;
  on_reviews: boolean;
  on_site: boolean;
}

export const NEW_DRAFT: Draft = { place_id: '', browser_key: '', restricted: false, on_booking: true, on_reviews: true, on_site: false };

const yes = (value: unknown): boolean => value === true || value === 1 || value === '1' || value === 't';

/** A stored row as the form holds it. */
export function draftOf(row: Readonly<Record<string, unknown>> | null | undefined): Draft {
  if (row === null || row === undefined) return { ...NEW_DRAFT };
  return {
    place_id: typeof row['place_id'] === 'string' ? row['place_id'] : '',
    browser_key: typeof row['browser_key'] === 'string' ? row['browser_key'] : '',
    restricted: yes(row['restricted']),
    on_booking: yes(row['on_booking']),
    on_reviews: yes(row['on_reviews']),
    on_site: yes(row['on_site']),
  };
}

export const isPlaceId = (value: string): boolean => /^[A-Za-z0-9_-]{10,300}$/.test(value.trim());
export const isBrowserKey = (value: string): boolean => /^[A-Za-z0-9_-]{20,120}$/.test(value.trim());

/** Saved and tested only with both values, and the key restricted: an open key can be used by anybody, on the owner's bill. */
export const canUse = (draft: Draft): boolean => draft.restricted && isPlaceId(draft.place_id) && isBrowserKey(draft.browser_key);

/** A new key or a new place has not been restricted yet, whatever was ticked for the old one. */
export function edited(draft: Draft, change: Partial<Draft>): Draft {
  const next = { ...draft, ...change };
  return change.browser_key !== undefined && change.browser_key !== draft.browser_key ? { ...next, restricted: false } : next;
}

/** The website restrictions the key needs, exactly: the address the box is served from. */
export const keyChips = (origin: string): string[] => [`${origin}/*`];

/** The apps this add-on is on, from the add-ons list's own reply. */
export function appsOf(reply: unknown): string[] {
  const list = (reply as { addOns?: { key?: unknown; attachments?: { attachedTo?: unknown; enabled?: unknown }[] }[] } | null)?.addOns ?? [];
  const mine = list.find((one) => one.key === 'google-reviews');
  return [...new Set((mine?.attachments ?? []).filter((one) => one.enabled !== false && typeof one.attachedTo === 'string' && one.attachedTo !== '@dashboard').map((one) => one.attachedTo as string))];
}
