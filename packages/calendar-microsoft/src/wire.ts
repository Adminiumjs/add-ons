/**
 * WHAT MICROSOFT GRAPH IS TOLD, AND HOW ITS ANSWERS ARE READ.
 *
 * Pure: no call, no clock. `provider.ts` does the talking.
 *
 * ─── "NEVER READS WHAT EVENTS ARE CALLED" IS KEPT BY THREE RULES ────────────
 * Microsoft's permission covers the whole calendar, so the sentence holds only
 * by how this code asks:
 *   1. One busy read: `calendarView` with {@link BUSY_SELECT}, re-read whole.
 *      Never delta, which cannot be told to leave fields out.
 *   2. A subscription never asks for resource data.
 *   3. No single event of a person's calendar is ever fetched.
 *
 * The one delta read is of the calendar Adminium itself made, to find an event
 * someone deleted there. Only its id, times and version are copied from it. A
 * delta also says "removed" of an event that merely lies outside its dates, so
 * each one is looked up by id, asking for the id alone, before it counts.
 */
import type { CalendarError, CalendarProvider, OwnEvent } from '@adminium/add-on-contracts';

export type ReadBusyAnswer = Exclude<Awaited<ReturnType<CalendarProvider['readBusy']>>, CalendarError>;
export type ListOwnEventsAnswer = Exclude<Awaited<ReturnType<CalendarProvider['listOwnEvents']>>, CalendarError>;
export type BusyInterval = ReadBusyAnswer['intervals'][number];

export const MICROSOFT_CALENDAR_KEY = 'calendar-microsoft';
export const GRAPH_ORIGIN = 'https://graph.microsoft.com';
export const GRAPH_API = `${GRAPH_ORIGIN}/v1.0`;

/** The fields of a busy read. Never a subject, a body, a place or an attendee. */
export const BUSY_SELECT = 'start,end,showAs,isAllDay,isCancelled';

/** Times in UTC, and ids that survive a move between folders. */
export const PREFER = 'outlook.timezone="UTC", IdType="ImmutableId"';

/** The key the core gave an event, kept on the event so a retry finds it. */
export const KEY_PROPERTY = 'String {6f1d2c84-3b7a-4e59-9a41-7c2e5d8b1f30} Name adminiumEventKey';

/** Marks the calendar Adminium made, so a person's own calendar of the same name is never taken for it. */
export const OWN_CALENDAR_PROPERTY = 'String {6f1d2c84-3b7a-4e59-9a41-7c2e5d8b1f31} Name adminiumOwnCalendar';
/** Outlook keeps names unique: what the calendar is called when the person already has one of that name. */
export const fallbackName = (name: string): string => `${name} bookings`;

export const PAGE_SIZE = 200;
/** The contract's limit on one busy answer. */
export const MOST_INTERVALS = 5000;
/** Microsoft's longest life for an event subscription is 10,080 minutes. */
export const SUBSCRIPTION_MINUTES = 10_000;
/** How far back and ahead the delta read of Adminium's own calendar looks. */
export const OWN_WINDOW_BACK_DAYS = 31;
export const OWN_WINDOW_AHEAD_DAYS = 800;
/** A delta read keeps the window it began with, so it is begun again before that window goes stale. */
export const OWN_CURSOR_DAYS = 30;

export interface GraphTime {
  dateTime?: string;
  timeZone?: string;
}

export interface GraphEvent {
  id?: string;
  '@odata.etag'?: string;
  '@removed'?: unknown;
  start?: GraphTime;
  end?: GraphTime;
  showAs?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
}

const KINDS: Readonly<Record<string, BusyInterval['kind']>> = {
  free: 'free',
  tentative: 'tentative',
  busy: 'busy',
  oof: 'away',
  workingElsewhere: 'elsewhere',
  // A time Microsoft cannot describe still counts.
  unknown: 'busy',
};

const WALL_CLOCK = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?$/;

/** A UTC wall clock as an instant. Any other zone is refused, because it cannot be read here. */
export function instantOf(time: GraphTime | undefined): string | null {
  if (time?.dateTime === undefined || time.timeZone !== 'UTC') return null;
  const parts = WALL_CLOCK.exec(time.dateTime);
  if (parts === null) return null;
  const at = Date.parse(`${parts[1]!}T${parts[2]!}:${parts[3]!}:${parts[4]!}Z`);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

/**
 * The calendar day an all-day time means. Asked for UTC, Microsoft may give
 * the person's midnight moved into UTC: 08:00 for Pacific time, or 23:00 the
 * evening before for Central Europe. Noon or later is therefore the next day.
 * Only zones of UTC+13 and UTC+14 can read a day early.
 */
export function dayOf(time: GraphTime | undefined): string | null {
  if (time?.dateTime === undefined) return null;
  const parts = WALL_CLOCK.exec(time.dateTime);
  if (parts === null) return null;
  const midnight = Date.parse(`${parts[1]!}T00:00:00Z`);
  if (Number.isNaN(midnight)) return null;
  const shift = Number(parts[2]) >= 12 ? 86_400_000 : 0;
  return new Date(midnight + shift).toISOString().slice(0, 10);
}

/**
 * One event as a busy time: `undefined` when it takes no time (cancelled),
 * `null` when it cannot be read, which fails the whole read rather than
 * quietly opening a slot.
 */
export function busyOf(event: GraphEvent): BusyInterval | null | undefined {
  if (event.isCancelled === true) return undefined;
  const kind = KINDS[event.showAs ?? 'unknown'] ?? 'busy';
  if (event.isAllDay === true) {
    const date = dayOf(event.start);
    const endDate = dayOf(event.end);
    return date === null || endDate === null ? null : { allDay: true, date, endDate, kind };
  }
  const start = instantOf(event.start);
  const end = instantOf(event.end);
  return start === null || end === null ? null : { allDay: false, start, end, kind };
}

/** One entry of the delta read of Adminium's own calendar. */
export function ownEventOf(event: GraphEvent): OwnEvent | null {
  if (event.id === undefined) return null;
  const deleted = event['@removed'] !== undefined;
  return {
    remoteId: event.id,
    key: null,
    start: deleted ? null : instantOf(event.start),
    end: deleted ? null : instantOf(event.end),
    etag: event['@odata.etag'] ?? null,
    deleted,
  };
}

export const graphTime = (instant: string): GraphTime => ({ dateTime: instant.replace(/Z$/, ''), timeZone: 'UTC' });

/** A delta position: the link to read next, and the day its window began. */
export interface OwnCursor {
  day: number;
  link: string;
}

export const packCursor = (cursor: OwnCursor): string => `${String(cursor.day)}:${cursor.link}`;

export function readCursor(cursor: string | null): OwnCursor | null {
  if (cursor === null) return null;
  const at = cursor.indexOf(':');
  if (at <= 0) return null;
  const day = Number(cursor.slice(0, at));
  const link = cursor.slice(at + 1);
  return Number.isInteger(day) && isGraphLink(link) ? { day, link } : null;
}

/** A paging link is followed only to Microsoft Graph. */
export function isGraphLink(link: string): boolean {
  try {
    const url = new URL(link);
    return url.origin === GRAPH_ORIGIN;
  } catch {
    return false;
  }
}

/** A next-page link, always still asking for the busy fields only. */
export function busyLink(link: string): string | null {
  if (!isGraphLink(link)) return null;
  const url = new URL(link);
  url.searchParams.set('$select', BUSY_SELECT);
  return url.toString();
}
