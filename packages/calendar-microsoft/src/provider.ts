/**
 * `calendar-provider@1` FOR OUTLOOK CALENDAR, over Microsoft Graph.
 *
 * The engine builds one per operation, with a client that adds the bearer
 * header. This file never sees a token. A refusal is returned as data. The
 * rules that keep event titles out are at the top of `wire.ts`.
 *
 * ─── ONE SUBSCRIPTION ───────────────────────────────────────────────────────
 * Microsoft documents `/me/events` as the resource for event changes, and no
 * path for one calendar. A change it does not cover is still found by the
 * 10-minute check.
 */
import type {
  CalendarAnswer,
  CalendarEntry,
  CalendarError,
  CalendarErrorCode,
  CalendarProvider,
  CalendarProviderInput,
  ChannelRef,
  HookAnswer,
  HookDelivery,
  UpsertEventInput,
  WatchInput,
} from '@adminium/add-on-contracts';

import {
  BUSY_SELECT,
  GRAPH_API,
  KEY_PROPERTY,
  MICROSOFT_CALENDAR_KEY,
  MOST_INTERVALS,
  OWN_CURSOR_DAYS,
  OWN_WINDOW_AHEAD_DAYS,
  OWN_WINDOW_BACK_DAYS,
  PAGE_SIZE,
  PREFER,
  SUBSCRIPTION_MINUTES,
  busyLink,
  busyOf,
  graphTime,
  isGraphLink,
  ownEventOf,
  packCursor,
  readCursor,
  type GraphEvent,
  type ListOwnEventsAnswer,
  type ReadBusyAnswer,
} from './wire.ts';

const refuse = (code: CalendarErrorCode, retryAfterMs?: number): CalendarError => (retryAfterMs === undefined ? { calendarError: code } : { calendarError: code, retryAfterMs });
const refused = (value: unknown): value is CalendarError => typeof value === 'object' && value !== null && 'calendarError' in value;

const DAY_MS = 86_400_000;
const MOST_PAGES = 40;
const MOST_NOTICES = 100;

function retryAfter(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  return Math.min(Number(raw.trim()) * 1000, DAY_MS);
}

function failure(response: Response, gone: CalendarErrorCode): CalendarError {
  switch (response.status) {
    case 401:
      return refuse('UNAUTHORIZED');
    case 403:
      return refuse('PERMISSION_MISSING');
    case 404:
    case 410:
      return refuse(gone);
    case 409:
      return refuse('CONFLICT');
    case 429:
      return refuse('RATE_LIMITED', retryAfter(response));
    case 400:
      return refuse('INVALID_REQUEST');
    default:
      return refuse('UNAVAILABLE', retryAfter(response));
  }
}

interface GraphCalendar {
  id?: string;
  name?: string;
  canEdit?: boolean;
  isDefaultCalendar?: boolean;
}

interface GraphPage<T> {
  value?: T[];
  '@odata.nextLink'?: string;
  '@odata.deltaLink'?: string;
}

export interface OutlookProviderInput extends CalendarProviderInput {
  /** The clock, for a subscription's end and the age of a delta read. */
  now?: () => number;
}

export function createOutlookProvider({ http, now = () => Date.now() }: OutlookProviderInput): CalendarProvider {
  const calendarPath = (id: string) => `${GRAPH_API}/me/calendars/${encodeURIComponent(id)}`;
  const viewPath = (id: string) => (id === 'primary' ? `${GRAPH_API}/me/calendar/calendarView` : `${calendarPath(id)}/calendarView`);
  const eventPath = (calendarId: string, eventId: string) => `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`;

  async function send(url: string, method = 'GET', body?: unknown): Promise<Response | CalendarError> {
    try {
      return await http(url, {
        method,
        headers: { accept: 'application/json', prefer: PREFER, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return refuse('UNAVAILABLE');
    }
  }

  async function json<T>(response: Response): Promise<T | CalendarError> {
    try {
      return (await response.json()) as T;
    } catch {
      return refuse('UNAVAILABLE');
    }
  }

  /** Something in a calendar was not found: either that thing is gone, or the calendar is. */
  async function missing(calendarId: string, ifThere: CalendarErrorCode): Promise<CalendarError> {
    const response = await send(`${calendarPath(calendarId)}?$select=id`);
    if (refused(response)) return response;
    if (response.ok) return refuse(ifThere);
    return failure(response, 'CALENDAR_MISSING');
  }

  async function allCalendars(): Promise<CalendarAnswer<GraphCalendar[]>> {
    const out: GraphCalendar[] = [];
    let url: string | null = `${GRAPH_API}/me/calendars?$select=id,name,canEdit,isDefaultCalendar&$top=100`;
    for (let page = 0; page < MOST_PAGES && url !== null; page += 1) {
      const response: Response | CalendarError = await send(url);
      if (refused(response)) return response;
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const body: GraphPage<GraphCalendar> | CalendarError = await json<GraphPage<GraphCalendar>>(response);
      if (refused(body)) return body;
      out.push(...(body.value ?? []));
      const next: string | undefined = body['@odata.nextLink'];
      if (next === undefined) return out;
      if (!isGraphLink(next)) return refuse('UNAVAILABLE');
      url = next;
    }
    return refuse('UNAVAILABLE');
  }

  async function findByName(name: string): Promise<CalendarAnswer<string | null>> {
    const calendars = await allCalendars();
    if (refused(calendars)) return calendars;
    const wanted = name.toLowerCase();
    const found = calendars.find((one) => one.id !== undefined && one.name?.toLowerCase() === wanted && one.canEdit !== false && one.isDefaultCalendar !== true);
    return found?.id ?? null;
  }

  const eventBody = (input: UpsertEventInput) => ({
    subject: input.title,
    // Sent in UTC: always the right moment, and Outlook shows it in the person's own zone.
    start: graphTime(input.start),
    end: graphTime(input.end),
    showAs: 'busy',
    isReminderOn: false,
    responseRequested: false,
  });

  async function patchEvent(input: UpsertEventInput, eventId: string): Promise<CalendarAnswer<{ remoteId: string; etag: string | null }>> {
    const response = await send(`${eventPath(input.calendarId, eventId)}?$select=id`, 'PATCH', eventBody(input));
    if (refused(response)) return response;
    if (response.status === 404) return missing(input.calendarId, 'EVENT_MISSING');
    if (!response.ok) return failure(response, 'EVENT_MISSING');
    const made = await json<GraphEvent>(response);
    if (refused(made)) return made;
    return made.id === undefined ? refuse('UNAVAILABLE') : { remoteId: made.id, etag: made['@odata.etag'] ?? null };
  }

  /** The event this key already made, so a retry cannot make a second one. */
  async function findByKey(calendarId: string, key: string): Promise<CalendarAnswer<string | null>> {
    const filter = `singleValueExtendedProperties/Any(ep: ep/id eq '${KEY_PROPERTY}' and ep/value eq '${key.replaceAll("'", "''")}')`;
    const query = new URLSearchParams({ $filter: filter, $select: 'id', $top: '1' });
    const response = await send(`${calendarPath(calendarId)}/events?${query.toString()}`);
    if (refused(response)) return response;
    if (response.status === 404) return refuse('CALENDAR_MISSING');
    if (!response.ok) return failure(response, 'UNAVAILABLE');
    const body = await json<GraphPage<GraphEvent>>(response);
    if (refused(body)) return body;
    return body.value?.[0]?.id ?? null;
  }

  return {
    key: MICROSOFT_CALENDAR_KEY,
    traits: { listsCalendars: true, allDayKnown: true, busyPush: true },

    // Who connected comes from the sign-in's ID token, which the engine reads.
    identify: () => Promise.resolve({ label: null, scopes: null }),

    async listCalendars() {
      const calendars = await allCalendars();
      if (refused(calendars)) return calendars;
      const entries: CalendarEntry[] = calendars.flatMap((one) =>
        one.id === undefined || one.id.length > 512 ? [] : [{ id: one.id, name: (one.name ?? one.id).slice(0, 256) || one.id.slice(0, 256), primary: one.isDefaultCalendar === true, writable: one.canEdit !== false }],
      );
      return { calendars: entries.slice(0, 250) };
    },

    async ensureCalendar({ name, knownId }) {
      if (knownId !== null) {
        const response = await send(`${calendarPath(knownId)}?$select=id,name`);
        if (refused(response)) return response;
        if (response.ok) {
          const known = await json<GraphCalendar>(response);
          if (refused(known)) return known;
          if (known.name === name) return { calendarId: knownId };
          const renamed = await send(`${calendarPath(knownId)}?$select=id`, 'PATCH', { name });
          if (refused(renamed)) return renamed;
          return renamed.ok ? { calendarId: knownId } : failure(renamed, 'CALENDAR_MISSING');
        }
        if (response.status !== 404) return failure(response, 'UNAVAILABLE');
      }
      const found = await findByName(name);
      if (refused(found)) return found;
      if (found !== null) return { calendarId: found };
      const response = await send(`${GRAPH_API}/me/calendars?$select=id`, 'POST', { name });
      if (refused(response)) return response;
      // Outlook keeps names unique: another job made it a moment ago.
      if (response.status === 409) {
        const raced = await findByName(name);
        if (refused(raced)) return raced;
        return raced === null ? refuse('CONFLICT') : { calendarId: raced };
      }
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const made = await json<GraphCalendar>(response);
      if (refused(made)) return made;
      return made.id === undefined ? refuse('UNAVAILABLE') : { calendarId: made.id };
    },

    async upsertEvent(input) {
      if (input.remoteId !== null) return patchEvent(input, input.remoteId);
      const existing = await findByKey(input.calendarId, input.key);
      if (refused(existing)) return existing;
      if (existing !== null) return patchEvent(input, existing);
      const body = { ...eventBody(input), singleValueExtendedProperties: [{ id: KEY_PROPERTY, value: input.key }] };
      const response = await send(`${calendarPath(input.calendarId)}/events?$select=id`, 'POST', body);
      if (refused(response)) return response;
      if (!response.ok) return failure(response, 'CALENDAR_MISSING');
      const made = await json<GraphEvent>(response);
      if (refused(made)) return made;
      return made.id === undefined ? refuse('UNAVAILABLE') : { remoteId: made.id, etag: made['@odata.etag'] ?? null };
    },

    async deleteEvent({ calendarId, remoteId }) {
      const response = await send(eventPath(calendarId, remoteId), 'DELETE');
      if (refused(response)) return response;
      if (response.ok) return { deleted: true as const };
      if (response.status === 404) return missing(calendarId, 'EVENT_MISSING');
      return failure(response, 'EVENT_MISSING');
    },

    async listOwnEvents({ calendarId, cursor }): Promise<CalendarAnswer<ListOwnEventsAnswer>> {
      const today = Math.floor(now() / DAY_MS);
      const position = readCursor(cursor);
      if (cursor !== null && (position === null || today - position.day >= OWN_CURSOR_DAYS)) return refuse('CURSOR_GONE');
      const day = position?.day ?? today;
      let url = position?.link;
      if (url === undefined) {
        const query = new URLSearchParams({
          startDateTime: new Date(now() - OWN_WINDOW_BACK_DAYS * DAY_MS).toISOString(),
          endDateTime: new Date(now() + OWN_WINDOW_AHEAD_DAYS * DAY_MS).toISOString(),
        });
        url = `${calendarPath(calendarId)}/calendarView/delta?${query.toString()}`;
      }
      const response = await send(url);
      if (refused(response)) return response;
      if (response.status === 410) return refuse('CURSOR_GONE');
      // A 404 alone must not read as "the person deleted the calendar": that would make a new one.
      if (response.status === 404) return missing(calendarId, 'UNAVAILABLE');
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const page = await json<GraphPage<GraphEvent>>(response);
      if (refused(page)) return page;
      const events = (page.value ?? []).flatMap((event) => {
        const own = ownEventOf(event);
        return own === null ? [] : [own];
      });
      const next = page['@odata.nextLink'];
      if (next !== undefined) return isGraphLink(next) ? { events, cursor: packCursor({ day, link: next }), more: true } : refuse('UNAVAILABLE');
      const delta = page['@odata.deltaLink'];
      return delta !== undefined && isGraphLink(delta) ? { events, cursor: packCursor({ day, link: delta }), more: false } : refuse('UNAVAILABLE');
    },

    async readBusy({ calendarIds, from, to }): Promise<CalendarAnswer<ReadBusyAnswer>> {
      const intervals: ReadBusyAnswer['intervals'] = [];
      for (const calendarId of new Set(calendarIds)) {
        const query = new URLSearchParams({ startDateTime: from, endDateTime: to, $select: BUSY_SELECT, $top: String(PAGE_SIZE) });
        let url: string | null = `${viewPath(calendarId)}?${query.toString()}`;
        let finished = false;
        for (let page = 0; page < MOST_PAGES && url !== null; page += 1) {
          const response: Response | CalendarError = await send(url);
          if (refused(response)) return response;
          if (!response.ok) return failure(response, 'CALENDAR_MISSING');
          const body: GraphPage<GraphEvent> | CalendarError = await json<GraphPage<GraphEvent>>(response);
          if (refused(body)) return body;
          for (const event of body.value ?? []) {
            const busy = busyOf(event);
            if (busy === null) return refuse('UNAVAILABLE');
            if (busy !== undefined) intervals.push(busy);
          }
          // More than one answer can hold: a part of it would open slots that are taken.
          if (intervals.length > MOST_INTERVALS) return refuse('UNAVAILABLE');
          const next: string | undefined = body['@odata.nextLink'];
          if (next === undefined) {
            finished = true;
            break;
          }
          url = busyLink(next);
          if (url === null) return refuse('UNAVAILABLE');
        }
        if (!finished) return refuse('UNAVAILABLE');
      }
      return { intervals };
    },

    async watch({ secret, address }: WatchInput) {
      const response = await send(`${GRAPH_API}/subscriptions`, 'POST', {
        changeType: 'created,updated,deleted',
        notificationUrl: address,
        lifecycleNotificationUrl: address,
        resource: '/me/events',
        expirationDateTime: new Date(now() + SUBSCRIPTION_MINUTES * 60_000).toISOString(),
        clientState: secret,
      });
      if (refused(response)) return response;
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const made = await json<{ id?: string; expirationDateTime?: string }>(response);
      if (refused(made)) return made;
      if (made.id === undefined || made.expirationDateTime === undefined || Number.isNaN(Date.parse(made.expirationDateTime))) return refuse('UNAVAILABLE');
      return { remoteChannelId: made.id, resourceId: null, expiresAt: new Date(made.expirationDateTime).toISOString() };
    },

    async renew({ remoteChannelId }: ChannelRef) {
      if (remoteChannelId === null) return refuse('INVALID_REQUEST');
      const response = await send(`${GRAPH_API}/subscriptions/${encodeURIComponent(remoteChannelId)}`, 'PATCH', {
        expirationDateTime: new Date(now() + SUBSCRIPTION_MINUTES * 60_000).toISOString(),
      });
      if (refused(response)) return response;
      // Gone at Microsoft: the engine opens a new one.
      if (!response.ok) return failure(response, 'INVALID_REQUEST');
      const body = await json<{ expirationDateTime?: string }>(response);
      if (refused(body)) return body;
      if (body.expirationDateTime === undefined || Number.isNaN(Date.parse(body.expirationDateTime))) return refuse('UNAVAILABLE');
      return { expiresAt: new Date(body.expirationDateTime).toISOString() };
    },

    async unwatch({ remoteChannelId }: ChannelRef) {
      if (remoteChannelId === null) return { stopped: true as const };
      const response = await send(`${GRAPH_API}/subscriptions/${encodeURIComponent(remoteChannelId)}`, 'DELETE');
      if (refused(response)) return response;
      return response.ok || response.status === 404 ? { stopped: true as const } : failure(response, 'UNAVAILABLE');
    },

    readHook({ query, rawBody }: HookDelivery): CalendarAnswer<HookAnswer> {
      const token = query['validationToken'];
      if (token !== undefined) return { handshake: token, notices: [] };
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return { handshake: null, notices: [] };
      }
      const value = (parsed as { value?: unknown } | null)?.value;
      if (!Array.isArray(value)) return { handshake: null, notices: [] };
      const notices = value.slice(0, MOST_NOTICES).map((entry: unknown) => {
        const one = (entry ?? {}) as { clientState?: unknown; lifecycleEvent?: unknown };
        const secret = typeof one.clientState === 'string' && one.clientState.length > 0 && one.clientState.length <= 512 ? one.clientState : null;
        const kind = one.lifecycleEvent === 'reauthorizationRequired' ? ('reauthorize' as const) : one.lifecycleEvent === 'subscriptionRemoved' ? ('removed' as const) : one.lifecycleEvent === 'missed' ? ('missed' as const) : ('changed' as const);
        return { secret, kind };
      });
      return { handshake: null, notices };
    },
  };
}

/** What the engine calls, once per operation. */
export const createCalendarProvider = (input: CalendarProviderInput): CalendarProvider => createOutlookProvider(input);
