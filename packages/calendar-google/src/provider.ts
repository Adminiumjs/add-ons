/**
 * `calendar-provider@1` FOR GOOGLE CALENDAR.
 *
 * The engine builds one per operation, with a client that adds the bearer
 * header. This file never sees a token. A refusal is returned as data.
 *
 * ─── A CALENDAR WHOSE ID WAS LOST ───────────────────────────────────────────
 * Google's list of a person's calendars is outside the two permissions on its
 * reference page, so it is asked once and a 403 is expected: the calendar is
 * then made new. If Google does answer, the marked one is reused.
 *
 * ─── A CHANNEL PER CALENDAR ─────────────────────────────────────────────────
 * The engine holds one channel per target, and Google watches one calendar per
 * channel. So a target of several calendars opens several channels to the same
 * address with the same token, packed into the reference the engine keeps.
 * Google cannot extend a channel, so `renew` refuses and the engine opens a new
 * one before stopping the old.
 */
import type {
  CalendarAnswer,
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
  BUSY_FIELDS,
  CALENDAR_API,
  GOOGLE_CALENDAR_KEY,
  MOST_INTERVALS,
  MOST_WATCHED,
  OWN_CALENDAR_MARK,
  OWN_FIELDS,
  OWN_PAGE_SIZE,
  PAGE_SIZE,
  busyOf,
  eventIdOf,
  ownEventOf,
  packChannels,
  pageCursor,
  readCursor,
  syncCursor,
  unpackChannels,
  type GoogleEvent,
  type ListOwnEventsAnswer,
  type ReadBusyAnswer,
  type WatchedChannel,
} from './wire.ts';

const refuse = (code: CalendarErrorCode, retryAfterMs?: number): CalendarError => (retryAfterMs === undefined ? { calendarError: code } : { calendarError: code, retryAfterMs });
const refused = (value: unknown): value is CalendarError => typeof value === 'object' && value !== null && 'calendarError' in value;

const RATE_REASONS = new Set(['rateLimitExceeded', 'userRateLimitExceeded', 'dailyLimitExceeded', 'quotaExceeded']);
const DAY_MS = 86_400_000;
const MOST_PAGES = 40;

function retryAfter(response: Response): number | undefined {
  const raw = response.headers.get('retry-after');
  if (raw === null || !/^\d+$/.test(raw.trim())) return undefined;
  return Math.min(Number(raw.trim()) * 1000, DAY_MS);
}

async function reasonOf(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { errors?: { reason?: unknown }[] } };
    const reason = body.error?.errors?.[0]?.reason;
    return typeof reason === 'string' ? reason : null;
  } catch {
    return null;
  }
}

/** What a failed answer means. A 404 or 410 means what the call says it means. */
async function failure(response: Response, gone: CalendarErrorCode): Promise<CalendarError> {
  switch (response.status) {
    case 401:
      return refuse('UNAUTHORIZED');
    case 403: {
      const reason = await reasonOf(response);
      return reason !== null && RATE_REASONS.has(reason) ? refuse('RATE_LIMITED', retryAfter(response)) : refuse('PERMISSION_MISSING');
    }
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
      return refuse('UNAVAILABLE');
  }
}

export function createCalendarProvider({ http }: CalendarProviderInput): CalendarProvider {
  const calendarPath = (id: string) => `${CALENDAR_API}/calendars/${encodeURIComponent(id)}`;
  const eventPath = (calendarId: string, eventId: string) => `${calendarPath(calendarId)}/events/${encodeURIComponent(eventId)}`;

  async function send(url: string, method = 'GET', body?: unknown): Promise<Response | CalendarError> {
    try {
      return await http(url, {
        method,
        headers: { accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
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

  /** An event was not found: either it is gone, or its whole calendar is. */
  async function missing(calendarId: string): Promise<CalendarError> {
    const response = await send(`${calendarPath(calendarId)}?fields=id`);
    if (refused(response)) return response;
    if (response.ok) return refuse('EVENT_MISSING');
    return failure(response, 'CALENDAR_MISSING');
  }

  const eventBody = (input: UpsertEventInput) => ({
    summary: input.title,
    start: { dateTime: input.start, timeZone: input.zone },
    end: { dateTime: input.end, timeZone: input.zone },
    transparency: 'opaque',
    reminders: { useDefault: false },
  });

  async function patchEvent(input: UpsertEventInput, eventId: string): Promise<CalendarAnswer<{ remoteId: string; etag: string | null }>> {
    const response = await send(`${eventPath(input.calendarId, eventId)}?fields=id,etag`, 'PATCH', eventBody(input));
    if (refused(response)) return response;
    if (response.status === 404) return missing(input.calendarId);
    if (!response.ok) return failure(response, 'EVENT_MISSING');
    const made = await json<GoogleEvent>(response);
    if (refused(made)) return made;
    return made.id === undefined ? refuse('UNAVAILABLE') : { remoteId: made.id, etag: made.etag ?? null };
  }

  /** The state of an event by id: live, cancelled (deleted but remembered), or an error. */
  async function statusOf(calendarId: string, eventId: string): Promise<'live' | 'cancelled' | CalendarError> {
    const response = await send(`${eventPath(calendarId, eventId)}?fields=status`);
    if (refused(response)) return response;
    if (response.status === 404) return missing(calendarId);
    if (!response.ok) return failure(response, 'EVENT_MISSING');
    const event = await json<GoogleEvent>(response);
    if (refused(event)) return event;
    return event.status === 'cancelled' ? 'cancelled' : 'live';
  }

  async function findMarked(name: string): Promise<CalendarAnswer<string | null>> {
    let pageToken: string | null = null;
    for (let page = 0; page < MOST_PAGES; page += 1) {
      const query = new URLSearchParams({ minAccessRole: 'owner', fields: 'items(id,summary,description),nextPageToken', maxResults: '250' });
      if (pageToken !== null) query.set('pageToken', pageToken);
      const response = await send(`${CALENDAR_API}/users/me/calendarList?${query.toString()}`);
      if (refused(response)) return response;
      // Expected under these two permissions: nothing can be found, and the caller makes one.
      if (response.status === 403) {
        const failed = await failure(response, 'UNAVAILABLE');
        return failed.calendarError === 'PERMISSION_MISSING' ? null : failed;
      }
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const list = await json<{ items?: { id?: string; summary?: string; description?: string }[]; nextPageToken?: string }>(response);
      if (refused(list)) return list;
      const found = list.items?.find((one) => one.id !== undefined && one.summary === name && one.description === OWN_CALENDAR_MARK);
      if (found?.id !== undefined) return found.id;
      if (list.nextPageToken === undefined) return null;
      pageToken = list.nextPageToken;
    }
    return refuse('UNAVAILABLE');
  }

  async function stopChannel(channel: WatchedChannel): Promise<CalendarError | null> {
    const response = await send(`${CALENDAR_API}/channels/stop`, 'POST', { id: channel.id, resourceId: channel.resourceId });
    if (refused(response)) return response;
    // A channel Google no longer knows is already stopped.
    if (response.ok || response.status === 404) return null;
    return failure(response, 'UNAVAILABLE');
  }

  return {
    key: GOOGLE_CALENDAR_KEY,
    // A person's calendars cannot be listed under these permissions: the main one, plus ids typed by hand.
    traits: { listsCalendars: false, allDayKnown: true, busyPush: true },

    // Who connected comes from the sign-in's ID token, which the engine reads.
    identify: () => Promise.resolve({ label: null, scopes: null }),

    listCalendars: () => Promise.resolve(refuse('PERMISSION_MISSING')),

    async ensureCalendar({ name, knownId }) {
      if (knownId !== null) {
        const response = await send(`${calendarPath(knownId)}?fields=id,summary`);
        if (refused(response)) return response;
        if (response.ok) {
          const known = await json<{ summary?: string }>(response);
          if (refused(known)) return known;
          if (known.summary === name) return { calendarId: knownId };
          const renamed = await send(`${calendarPath(knownId)}?fields=id`, 'PATCH', { summary: name });
          if (refused(renamed)) return renamed;
          return renamed.ok ? { calendarId: knownId } : failure(renamed, 'CALENDAR_MISSING');
        }
        if (response.status !== 404) return failure(response, 'UNAVAILABLE');
      }
      const found = await findMarked(name);
      if (refused(found)) return found;
      if (found !== null) return { calendarId: found };
      const response = await send(`${CALENDAR_API}/calendars?fields=id`, 'POST', { summary: name, description: OWN_CALENDAR_MARK });
      if (refused(response)) return response;
      if (!response.ok) return failure(response, 'UNAVAILABLE');
      const made = await json<{ id?: string }>(response);
      if (refused(made)) return made;
      return made.id === undefined ? refuse('UNAVAILABLE') : { calendarId: made.id };
    },

    async upsertEvent(input) {
      if (input.remoteId !== null) {
        const status = await statusOf(input.calendarId, input.remoteId);
        if (refused(status)) return status;
        if (status === 'cancelled') return refuse('EVENT_MISSING');
        return patchEvent(input, input.remoteId);
      }
      const id = eventIdOf(input.key);
      const response = await send(`${calendarPath(input.calendarId)}/events?fields=id,etag`, 'POST', { id, ...eventBody(input) });
      if (refused(response)) return response;
      if (response.status === 409) {
        // The key was used before. A retry finds its event; a deleted one keeps its id, so the key is spent.
        const status = await statusOf(input.calendarId, id);
        if (refused(status)) return status.calendarError === 'EVENT_MISSING' ? refuse('CONFLICT') : status;
        return status === 'cancelled' ? refuse('CONFLICT') : patchEvent(input, id);
      }
      if (!response.ok) return failure(response, 'CALENDAR_MISSING');
      const made = await json<GoogleEvent>(response);
      if (refused(made)) return made;
      return made.id === undefined ? refuse('UNAVAILABLE') : { remoteId: made.id, etag: made.etag ?? null };
    },

    async deleteEvent({ calendarId, remoteId }) {
      const response = await send(eventPath(calendarId, remoteId), 'DELETE');
      if (refused(response)) return response;
      if (response.ok) return { deleted: true as const };
      if (response.status === 410) return refuse('EVENT_MISSING');
      if (response.status === 404) return missing(calendarId);
      return failure(response, 'EVENT_MISSING');
    },

    async listOwnEvents({ calendarId, cursor }): Promise<CalendarAnswer<ListOwnEventsAnswer>> {
      const position = readCursor(cursor);
      const query = new URLSearchParams({ showDeleted: 'true', singleEvents: 'true', maxResults: String(OWN_PAGE_SIZE), fields: OWN_FIELDS });
      if (position !== null && 'page' in position) query.set('pageToken', position.page);
      if (position !== null && 'sync' in position) query.set('syncToken', position.sync);
      const response = await send(`${calendarPath(calendarId)}/events?${query.toString()}`);
      if (refused(response)) return response;
      if (response.status === 410) return refuse('CURSOR_GONE');
      if (!response.ok) return failure(response, 'CALENDAR_MISSING');
      const page = await json<{ items?: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>(response);
      if (refused(page)) return page;
      const events = (page.items ?? []).flatMap((event) => {
        const own = ownEventOf(event);
        return own === null ? [] : [own];
      });
      if (page.nextPageToken !== undefined) return { events, cursor: pageCursor(page.nextPageToken), more: true };
      return page.nextSyncToken === undefined ? refuse('UNAVAILABLE') : { events, cursor: syncCursor(page.nextSyncToken), more: false };
    },

    async readBusy({ calendarIds, from, to }): Promise<CalendarAnswer<ReadBusyAnswer>> {
      const intervals: ReadBusyAnswer['intervals'] = [];
      for (const calendarId of new Set(calendarIds)) {
        let pageToken: string | null = null;
        let finished = false;
        for (let page = 0; page < MOST_PAGES; page += 1) {
          const query = new URLSearchParams({ singleEvents: 'true', timeMin: from, timeMax: to, maxResults: String(PAGE_SIZE), fields: BUSY_FIELDS });
          if (pageToken !== null) query.set('pageToken', pageToken);
          const response = await send(`${calendarPath(calendarId)}/events?${query.toString()}`);
          if (refused(response)) return response;
          if (!response.ok) return failure(response, 'CALENDAR_MISSING');
          const body = await json<{ items?: GoogleEvent[]; nextPageToken?: string }>(response);
          if (refused(body)) return body;
          for (const event of body.items ?? []) {
            const busy = busyOf(event);
            if (busy === null) return refuse('UNAVAILABLE');
            if (busy !== undefined) intervals.push(busy);
          }
          // More than one answer can hold: a part of it would open slots that are taken.
          if (intervals.length > MOST_INTERVALS) return refuse('UNAVAILABLE');
          if (body.nextPageToken === undefined) {
            finished = true;
            break;
          }
          pageToken = body.nextPageToken;
        }
        if (!finished) return refuse('UNAVAILABLE');
      }
      return { intervals };
    },

    async watch({ calendarIds, channelId, secret, address }: WatchInput) {
      const watched: WatchedChannel[] = [];
      let endsAt = Number.POSITIVE_INFINITY;
      const undo = async () => {
        for (const channel of watched) await stopChannel(channel);
      };
      // Past the limit, a calendar is still read on the 10-minute check.
      for (const [index, calendarId] of [...new Set(calendarIds)].slice(0, MOST_WATCHED).entries()) {
        const id = index === 0 ? channelId : `${channelId}-${String(index)}`;
        const response = await send(`${calendarPath(calendarId)}/events/watch`, 'POST', { id, type: 'web_hook', address, token: secret });
        if (refused(response)) {
          await undo();
          return response;
        }
        if (!response.ok) {
          await undo();
          return failure(response, 'CALENDAR_MISSING');
        }
        const body = await json<{ resourceId?: string; expiration?: string }>(response);
        const expiry = refused(body) ? Number.NaN : Number(body.expiration);
        if (refused(body) || body.resourceId === undefined || !Number.isFinite(expiry)) {
          await undo();
          return refuse('UNAVAILABLE');
        }
        watched.push({ id, resourceId: body.resourceId });
        endsAt = Math.min(endsAt, expiry);
      }
      if (watched.length === 0) return refuse('INVALID_REQUEST');
      return { remoteChannelId: channelId, resourceId: packChannels(watched), expiresAt: new Date(endsAt).toISOString() };
    },

    renew: () => Promise.resolve(refuse('INVALID_REQUEST')),

    async unwatch({ channelId, resourceId }: ChannelRef) {
      let failed: CalendarError | null = null;
      for (const channel of unpackChannels(channelId, resourceId)) failed = (await stopChannel(channel)) ?? failed;
      return failed ?? { stopped: true as const };
    },

    readHook({ headers }: HookDelivery): CalendarAnswer<HookAnswer> {
      const header = (name: string): string | undefined => {
        const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
        return found?.[1];
      };
      const state = header('x-goog-resource-state');
      if (state === undefined) return { handshake: null, notices: [] };
      const token = header('x-goog-channel-token');
      const secret = token === undefined || token === '' || token.length > 512 ? null : token;
      return { handshake: null, notices: [{ secret, kind: state === 'sync' ? 'sync' : 'changed' }] };
    },
  };
}
