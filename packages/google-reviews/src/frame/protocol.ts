/**
 * WHAT THE APP'S PAGE AND THE SANDBOXED BOX SAY TO EACH OTHER.
 *
 * The box has no origin, so neither side can name the other by address. Each
 * checks that a message comes from the one window it expects (`event.source`)
 * and holds exactly this shape. The app sends the place and the key once, after
 * the box says it is ready. The box answers only its height, and that it failed.
 */

export const CHANNEL = 'adminium-google-reviews';
/** The most a box asks to be, so nothing inside it can stretch the page around it. */
export const HEIGHT_MOST = 2400;

export interface ShowMessage {
  channel: typeof CHANNEL;
  event: 'show';
  placeId: string;
  browserKey: string;
  language: string;
  /** The business's own "Review us on Google" link, when it has one. */
  reviewLink?: string;
  dark?: boolean;
}

export type BoxMessage =
  | { channel: typeof CHANNEL; event: 'ready' }
  | { channel: typeof CHANNEL; event: 'height'; px: number }
  | { channel: typeof CHANNEL; event: 'failed' };

const PLACE = /^[A-Za-z0-9_-]{10,300}$/;
const KEY = /^[A-Za-z0-9_-]{20,120}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** An https link to Google, or nothing: a link the box draws is never another site's. */
export function googleLink(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 500) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const google = ['g.page', 'g.co', 'maps.app.goo.gl', 'google.com'].includes(host) || host.endsWith('.google.com');
    return url.protocol === 'https:' && url.username === '' && url.password === '' && google ? url.href : null;
  } catch {
    return null;
  }
}

/** The app's message, when it is exactly one. */
export function readShow(data: unknown): ShowMessage | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m['channel'] !== CHANNEL || m['event'] !== 'show') return null;
  const { placeId, browserKey, language } = m;
  if (typeof placeId !== 'string' || !PLACE.test(placeId)) return null;
  if (typeof browserKey !== 'string' || !KEY.test(browserKey)) return null;
  if (typeof language !== 'string' || !LANGUAGE.test(language)) return null;
  const reviewLink = googleLink(m['reviewLink']);
  return { channel: CHANNEL, event: 'show', placeId, browserKey, language, ...(reviewLink === null ? {} : { reviewLink }), ...(m['dark'] === true ? { dark: true } : {}) };
}

/** A height the page around the box can trust, or null. */
export function readHeight(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null;
  const m = data as Record<string, unknown>;
  if (m['channel'] !== CHANNEL || m['event'] !== 'height' || typeof m['px'] !== 'number' || !Number.isFinite(m['px'])) return null;
  return Math.min(HEIGHT_MOST, Math.max(0, Math.ceil(m['px'])));
}
