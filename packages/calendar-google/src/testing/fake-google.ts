/**
 * A STAND-IN FOR GOOGLE CALENDAR, shaped from Google's reference pages and the
 * owner's probe of 2026-11-21 (`calendar.events.freebusy` on a real account).
 * It is not a recording of a real account's whole traffic.
 *
 * It holds what a real calendar holds, titles, places and guests included, and
 * honours the `fields` mask, so a read that forgets the mask leaks here too.
 * Its calendar list answers 403 by default, as Google's reference page says for
 * these permissions.
 */
import type { CalendarConformanceDriver } from '@adminium/add-on-contracts/testing/calendar-provider';

export interface FakeEvent {
  id: string;
  etag: string;
  status: 'confirmed' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  attendees?: { email: string }[];
  visibility?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  serial: number;
}

interface FakeCalendar {
  id: string;
  summary: string;
  description?: string;
  events: Map<string, FakeEvent>;
}

export interface FakeRequest {
  method: string;
  url: URL;
  body: unknown;
}

export interface FakeGoogle {
  http: (input: string | URL, init?: RequestInit) => Promise<Response>;
  driver: Required<CalendarConformanceDriver>;
  requests: FakeRequest[];
  calendars: Map<string, FakeCalendar>;
  channels: Map<string, { resourceId: string; calendarId: string; token: string; address: string }>;
  addEvent(calendarId: string, event: Partial<FakeEvent>): FakeEvent;
  addCalendar(id: string, summary: string): void;
  /** Answer the next matching request with this instead. */
  failNext(match: (request: FakeRequest) => boolean, status: number, body?: unknown, headers?: Record<string, string>): void;
  /** Whether the calendar list answers, which a real walk has to settle. */
  listAllowed: boolean;
  /** Page size of event lists. */
  pageSize: number;
}

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const problem = (status: number, reason: string) => json(status, { error: { code: status, errors: [{ reason }] } });

/** Keeps the listed fields of one object, the way Google's partial responses do. */
function masked(event: FakeEvent, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.flatMap((name) => (name in event ? [[name, (event as unknown as Record<string, unknown>)[name]]] : [])));
}

function itemFields(mask: string | null): string[] | null {
  if (mask === null) return null;
  const inner = /items\(([^)]*)\)/.exec(mask)?.[1];
  return inner === undefined ? [] : inner.split(',');
}

export function createFakeGoogle(): FakeGoogle {
  const calendars = new Map<string, FakeCalendar>([['primary', { id: 'primary', summary: 'owner@example.test', events: new Map() }]]);
  const channels: FakeGoogle['channels'] = new Map();
  const requests: FakeRequest[] = [];
  const failures: { match: (request: FakeRequest) => boolean; status: number; body?: unknown; headers?: Record<string, string> }[] = [];
  let serial = 0;
  let made = 0;
  const syncs = new Map<string, { calendarId: string; at: number }>();

  const tag = () => `"${String(++serial)}"`;
  const fake: FakeGoogle = {
    http,
    requests,
    calendars,
    channels,
    listAllowed: false,
    pageSize: 1000,
    addCalendar(id, summary) {
      calendars.set(id, { id, summary, events: new Map() });
    },
    addEvent(calendarId, event) {
      const calendar = calendars.get(calendarId);
      if (calendar === undefined) throw new Error(`no calendar ${calendarId}`);
      const etag = tag();
      const whole: FakeEvent = { id: `person${String(serial)}`, status: 'confirmed', ...event, etag, serial };
      calendar.events.set(whole.id, whole);
      return whole;
    },
    failNext(match, status, body, headers) {
      failures.push({ match, status, ...(body === undefined ? {} : { body }), ...(headers === undefined ? {} : { headers }) });
    },
    driver: {
      async addBusy({ calendarId, start, end }) {
        fake.addEvent(calendarId, { summary: 'Private dentist visit', description: 'Do not share', location: '12 Hidden Lane', attendees: [{ email: 'friend@example.test' }], visibility: 'public', start: { dateTime: start }, end: { dateTime: end } });
      },
      async deleteEventOutside(remoteId) {
        for (const calendar of calendars.values()) {
          const event = calendar.events.get(remoteId);
          if (event !== undefined) Object.assign(event, { status: 'cancelled', etag: tag(), serial });
        }
      },
      async deleteCalendarOutside(calendarId) {
        calendars.delete(calendarId);
      },
      deliveryFor({ channelId, secret }) {
        return { headers: { 'X-Goog-Channel-ID': channelId, 'X-Goog-Channel-Token': secret, 'X-Goog-Resource-State': 'exists', 'X-Goog-Message-Number': '7' }, query: {}, rawBody: '' };
      },
    },
  };

  async function http(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const request = { method, url, body };
    requests.push(request);
    const failing = failures.findIndex((one) => one.match(request));
    if (failing >= 0) {
      const [one] = failures.splice(failing, 1);
      return json(one!.status, one!.body, one!.headers);
    }
    if (url.hostname !== 'www.googleapis.com' || !url.pathname.startsWith('/calendar/v3/')) return problem(404, 'notFound');
    const path = url.pathname.slice('/calendar/v3'.length).split('/').filter(Boolean).map(decodeURIComponent);
    return route(path, method, url, body as Record<string, unknown> | undefined);
  }

  function route(path: string[], method: string, url: URL, body: Record<string, unknown> | undefined): Response {
    if (path[0] === 'users' && path[1] === 'me' && path[2] === 'calendarList') {
      if (!fake.listAllowed) return problem(403, 'insufficientPermissions');
      return json(200, { items: [...calendars.values()].map((one) => ({ id: one.id, summary: one.summary, description: one.description })) });
    }
    if (path[0] === 'channels' && path[1] === 'stop') {
      const id = String(body?.['id']);
      const channel = channels.get(id);
      if (channel === undefined || channel.resourceId !== body?.['resourceId']) return problem(404, 'notFound');
      channels.delete(id);
      return new Response(null, { status: 204 });
    }
    if (path[0] !== 'calendars') return problem(404, 'notFound');
    if (path.length === 1 && method === 'POST') {
      const id = `made${String(++made)}@group.calendar.google.com`;
      calendars.set(id, { id, summary: String(body?.['summary']), ...(typeof body?.['description'] === 'string' ? { description: body['description'] } : {}), events: new Map() });
      return json(200, { id });
    }
    const calendar = calendars.get(path[1] ?? '');
    if (calendar === undefined) return problem(404, 'notFound');
    if (path.length === 2) {
      if (method === 'PATCH') calendar.summary = String(body?.['summary']);
      return json(200, { id: calendar.id, summary: calendar.summary });
    }
    if (path[2] !== 'events') return problem(404, 'notFound');
    if (path[3] === 'watch') {
      const id = String(body?.['id']);
      const resourceId = `res-${id}`;
      channels.set(id, { resourceId, calendarId: calendar.id, token: String(body?.['token']), address: String(body?.['address']) });
      return json(200, { kind: 'api#channel', id, resourceId, expiration: String(Date.UTC(2030, 0, 14)) });
    }
    if (path.length === 3 && method === 'GET') return listEvents(calendar, url);
    if (path.length === 3 && method === 'POST') {
      const id = String(body?.['id']);
      if (!/^[a-v0-9]{5,1024}$/.test(id)) return problem(400, 'invalid');
      if (calendar.events.has(id)) return problem(409, 'duplicate');
      const etag = tag();
      const event: FakeEvent = { ...(body as unknown as FakeEvent), id, status: 'confirmed', etag, serial };
      calendar.events.set(id, event);
      return json(200, { id, etag });
    }
    const event = calendar.events.get(path[3] ?? '');
    if (event === undefined) return problem(404, 'notFound');
    if (method === 'GET') return json(200, masked(event, ['id', 'etag', 'status']));
    if (method === 'DELETE') {
      if (event.status === 'cancelled') return problem(410, 'deleted');
      Object.assign(event, { status: 'cancelled', etag: tag(), serial });
      return new Response(null, { status: 204 });
    }
    if (method === 'PATCH') {
      Object.assign(event, body, { etag: tag(), serial });
      return json(200, { id: event.id, etag: event.etag });
    }
    return problem(405, 'notAllowed');
  }

  function listEvents(calendar: FakeCalendar, url: URL): Response {
    const query = url.searchParams;
    const syncToken = query.get('syncToken');
    if (syncToken !== null && !syncs.has(syncToken)) return problem(410, 'fullSyncRequired');
    const since = syncToken === null ? 0 : syncs.get(syncToken)!.at;
    const showDeleted = query.get('showDeleted') === 'true' || syncToken !== null;
    const timeMin = query.get('timeMin');
    const timeMax = query.get('timeMax');
    const all = [...calendar.events.values()]
      .filter((event) => event.serial > since && (showDeleted || event.status !== 'cancelled'))
      .filter((event) => {
        if (timeMin === null || timeMax === null) return true;
        const start = Date.parse(event.start?.dateTime ?? `${event.start?.date ?? ''}T00:00:00Z`);
        const end = Date.parse(event.end?.dateTime ?? `${event.end?.date ?? ''}T00:00:00Z`);
        return start < Date.parse(timeMax) && end > Date.parse(timeMin);
      })
      .sort((a, b) => a.serial - b.serial);
    const offset = Number(query.get('pageToken') ?? 0);
    const size = Math.min(fake.pageSize, Number(query.get('maxResults') ?? 250));
    const page = all.slice(offset, offset + size);
    const fields = itemFields(query.get('fields'));
    const items = page.map((event) => (fields === null ? event : masked(event, fields)));
    if (offset + size < all.length) return json(200, { items, nextPageToken: String(offset + size) });
    const token = `sync${String(++made)}`;
    syncs.set(token, { calendarId: calendar.id, at: serial });
    return json(200, { items, nextSyncToken: token });
  }

  return fake;
}
