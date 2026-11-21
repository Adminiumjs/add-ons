/**
 * WHAT GOOGLE CALENDAR IS TOLD, AND HOW ITS ANSWERS ARE READ.
 *
 * Pure: no call, no clock. `provider.ts` does the talking.
 *
 * ─── THE TWO PERMISSIONS ────────────────────────────────────────────────────
 * `calendar.app.created` makes and edits the one calendar Adminium owns.
 * `calendar.events.freebusy` lists when someone is busy and watches for changes.
 * Neither can list a person's calendars, so a second calendar is typed by its id.
 *
 * ─── NO WORDS, TWICE ────────────────────────────────────────────────────────
 * An event marked "public" may show its details to anyone who can see free and
 * busy times. So a busy read names its fields ({@link BUSY_FIELDS}) and Google
 * sends only those, and {@link busyOf} copies only times and a kind.
 */
import type { CalendarError, CalendarProvider, OwnEvent } from '@adminium/add-on-contracts';

/** The answers of the two reads, as the contract types them. */
export type ReadBusyAnswer = Exclude<Awaited<ReturnType<CalendarProvider['readBusy']>>, CalendarError>;
export type ListOwnEventsAnswer = Exclude<Awaited<ReturnType<CalendarProvider['listOwnEvents']>>, CalendarError>;
export type BusyInterval = ReadBusyAnswer['intervals'][number];

export const GOOGLE_CALENDAR_KEY = 'calendar-google';
export const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export const SCOPE_OWN_CALENDAR = 'https://www.googleapis.com/auth/calendar.app.created';
export const SCOPE_BUSY = 'https://www.googleapis.com/auth/calendar.events.freebusy';

/** The fields of a busy read. Never a title, a place, a description or a guest. */
export const BUSY_FIELDS = 'items(status,transparency,start,end),nextPageToken';
export const OWN_FIELDS = 'items(id,etag,status,start,end),nextPageToken,nextSyncToken';

/** Marks the calendar Adminium made, so it can be told from one the person named the same. */
export const OWN_CALENDAR_MARK = 'Kept by Adminium (adminium-calendar-sync). Its events follow your bookings.';

/** Google's own limit on one page of events. */
export const PAGE_SIZE = 2500;
export const OWN_PAGE_SIZE = 250;
/** The contract's limit on one busy answer. */
export const MOST_INTERVALS = 5000;
/** What a channel's two lists can hold inside the contract's 1,024 characters. */
export const MOST_WATCHED = 8;

const EVENT_ID_PREFIX = 'adm0';

/**
 * The event id for a key. Google lets a client choose it (a–v and 0–9, 5 to
 * 1,024 characters), so a retry of the same key cannot make a second event.
 */
export function eventIdOf(key: string): string {
  const hex = [...new TextEncoder().encode(key)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${EVENT_ID_PREFIX}${hex}`;
}

/** The key an event id was made from; null for an event someone else made. */
export function keyOfEventId(id: string): string | null {
  if (!id.startsWith(EVENT_ID_PREFIX)) return null;
  const hex = id.slice(EVENT_ID_PREFIX.length);
  if (hex.length === 0 || hex.length > 256 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/.test(hex)) return null;
  const bytes = Uint8Array.from(hex.match(/../g) ?? [], (pair) => Number.parseInt(pair, 16));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

export interface GoogleTime {
  dateTime?: string;
  date?: string;
}

export interface GoogleEvent {
  id?: string;
  etag?: string;
  status?: string;
  transparency?: string;
  start?: GoogleTime;
  end?: GoogleTime;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function instantOf(value: string | undefined): string | null {
  if (value === undefined) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/**
 * One event as a busy time: `undefined` when it takes no time (cancelled),
 * `null` when it cannot be read, which fails the whole read rather than
 * quietly opening a slot.
 */
export function busyOf(event: GoogleEvent): BusyInterval | null | undefined {
  if (event.status === 'cancelled') return undefined;
  const kind = event.transparency === 'transparent' ? 'free' : 'busy';
  const startDay = event.start?.date;
  const endDay = event.end?.date;
  if (startDay !== undefined && endDay !== undefined) {
    return DAY.test(startDay) && DAY.test(endDay) ? { allDay: true, date: startDay, endDate: endDay, kind } : null;
  }
  const start = instantOf(event.start?.dateTime);
  const end = instantOf(event.end?.dateTime);
  return start === null || end === null ? null : { allDay: false, start, end, kind };
}

/** One event of the calendar Adminium made. An all-day one a person added there has no instants. */
export function ownEventOf(event: GoogleEvent): OwnEvent | null {
  if (event.id === undefined) return null;
  const deleted = event.status === 'cancelled';
  return {
    remoteId: event.id,
    key: keyOfEventId(event.id),
    start: deleted ? null : instantOf(event.start?.dateTime),
    end: deleted ? null : instantOf(event.end?.dateTime),
    etag: event.etag ?? null,
    deleted,
  };
}

/** A sync position: a page still to read, or the token of the next sync. */
export type OwnCursor = { page: string } | { sync: string } | null;

export function readCursor(cursor: string | null): OwnCursor {
  if (cursor === null) return null;
  if (cursor.startsWith('p:')) return { page: cursor.slice(2) };
  if (cursor.startsWith('s:')) return { sync: cursor.slice(2) };
  return null;
}

export const pageCursor = (token: string): string => `p:${token}`;
export const syncCursor = (token: string): string => `s:${token}`;

/** One watched calendar: Google gives each its own channel. */
export interface WatchedChannel {
  id: string;
  resourceId: string;
}

export const packChannels = (channels: readonly WatchedChannel[]): string => JSON.stringify(channels.map((one) => [one.id, one.resourceId]));

/** The channels a stored reference names. A plain resource id is the one channel of `channelId`. */
export function unpackChannels(channelId: string, stored: string | null): WatchedChannel[] {
  if (stored === null) return [];
  if (!stored.startsWith('[')) return [{ id: channelId, resourceId: stored }];
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((pair: unknown) => (Array.isArray(pair) && typeof pair[0] === 'string' && typeof pair[1] === 'string' ? [{ id: pair[0], resourceId: pair[1] }] : []));
  } catch {
    return [];
  }
}
