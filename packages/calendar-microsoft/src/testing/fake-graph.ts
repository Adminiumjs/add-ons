/**
 * A STAND-IN FOR MICROSOFT GRAPH, shaped from Microsoft's reference pages. It
 * is not a recording of a real account.
 *
 * It holds what a real calendar holds, subjects and places included, and
 * honours `$select`, so a read that forgets it leaks here too. Like Graph's
 * delta, it ignores `$select` on a delta read.
 */
import type { CalendarConformanceDriver } from '@adminium/add-on-contracts/testing/calendar-provider';

import { KEY_PROPERTY, OWN_CALENDAR_PROPERTY } from '../wire.ts';

export interface FakeEvent {
  id: string;
  '@odata.etag': string;
  subject?: string;
  bodyPreview?: string;
  location?: { displayName: string };
  attendees?: { emailAddress: { address: string } }[];
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  showAs?: string;
  isAllDay?: boolean;
  isCancelled?: boolean;
  key?: string;
  serial: number;
  removed?: boolean;
}

interface FakeCalendar {
  id: string;
  name: string;
  canEdit: boolean;
  isDefaultCalendar: boolean;
  marked?: boolean;
  events: Map<string, FakeEvent>;
}

export interface FakeRequest {
  method: string;
  url: URL;
  body: unknown;
  prefer: string | null;
}

export interface FakeGraph {
  http: (input: string | URL, init?: RequestInit) => Promise<Response>;
  driver: Required<CalendarConformanceDriver>;
  requests: FakeRequest[];
  calendars: Map<string, FakeCalendar>;
  subscriptions: Map<string, Record<string, unknown>>;
  addEvent(calendarId: string, event: Partial<FakeEvent> & Pick<FakeEvent, 'start' | 'end'>): FakeEvent;
  addCalendar(id: string, name: string): void;
  failNext(match: (request: FakeRequest) => boolean, status: number, body?: unknown, headers?: Record<string, string>): void;
  pageSize: number;
  /** Events a delta reports as removed although they exist: they changed outside its dates. */
  outOfWindow: Set<string>;
}

const json = (status: number, body?: unknown, headers: Record<string, string> = {}) =>
  new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
const problem = (status: number, code: string) => json(status, { error: { code, message: code } });

const FIELDS_ALWAYS = ['id', '@odata.etag'];
const PRIMARY = 'AAMk-default';

function selected(event: FakeEvent, select: string | null): Record<string, unknown> {
  const { key: _key, serial: _serial, removed: _removed, ...visible } = event;
  if (select === null) return visible;
  const names = new Set([...FIELDS_ALWAYS, ...select.split(',')]);
  return Object.fromEntries(Object.entries(visible).filter(([name]) => names.has(name)));
}

export function createFakeGraph(): FakeGraph {
  const calendars = new Map<string, FakeCalendar>([[PRIMARY, { id: PRIMARY, name: 'Calendar', canEdit: true, isDefaultCalendar: true, events: new Map() }]]);
  const subscriptions: FakeGraph['subscriptions'] = new Map();
  const requests: FakeRequest[] = [];
  const failures: { match: (request: FakeRequest) => boolean; status: number; body?: unknown; headers?: Record<string, string> }[] = [];
  let serial = 0;
  let made = 0;
  const deltas = new Map<string, { calendarId: string; at: number }>();
  const tag = () => `W/"${String(++serial)}"`;

  const fake: FakeGraph = {
    http,
    requests,
    calendars,
    subscriptions,
    pageSize: 1000,
    outOfWindow: new Set(),
    addCalendar(id, name) {
      calendars.set(id, { id, name, canEdit: true, isDefaultCalendar: false, events: new Map() });
    },
    addEvent(calendarId, event) {
      const calendar = calendars.get(calendarId === 'primary' ? PRIMARY : calendarId);
      if (calendar === undefined) throw new Error(`no calendar ${calendarId}`);
      const etag = tag();
      const whole: FakeEvent = { id: `AAMk-person-${String(serial)}`, showAs: 'busy', isAllDay: false, isCancelled: false, ...event, '@odata.etag': etag, serial };
      calendar.events.set(whole.id, whole);
      return whole;
    },
    failNext(match, status, body, headers) {
      failures.push({ match, status, ...(body === undefined ? {} : { body }), ...(headers === undefined ? {} : { headers }) });
    },
    driver: {
      async addBusy({ calendarId, start, end }) {
        const utc = (at: string) => ({ dateTime: `${at.replace(/Z$/, '')}0000`, timeZone: 'UTC' });
        fake.addEvent(calendarId, { subject: 'Private dentist visit', bodyPreview: 'Do not share', location: { displayName: '12 Hidden Lane' }, attendees: [{ emailAddress: { address: 'friend@example.test' } }], start: utc(start), end: utc(end) });
      },
      async deleteEventOutside(remoteId) {
        for (const calendar of calendars.values()) {
          const event = calendar.events.get(remoteId);
          if (event !== undefined) Object.assign(event, { removed: true, serial: ++serial });
        }
      },
      async deleteCalendarOutside(calendarId) {
        calendars.delete(calendarId);
      },
      deliveryFor({ secret }) {
        return { headers: {}, query: {}, rawBody: JSON.stringify({ value: [{ subscriptionId: 'sub-1', changeType: 'updated', clientState: secret, resource: 'Users/1/Events/2' }] }) };
      },
    },
  };

  async function http(input: string | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(input);
    const method = init?.method ?? 'GET';
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    const prefer = new Headers(init?.headers).get('prefer');
    const request = { method, url, body, prefer };
    requests.push(request);
    const failing = failures.findIndex((one) => one.match(request));
    if (failing >= 0) {
      const [one] = failures.splice(failing, 1);
      return json(one!.status, one!.body, one!.headers);
    }
    if (url.hostname !== 'graph.microsoft.com' || !url.pathname.startsWith('/v1.0/')) return problem(404, 'NotFound');
    const path = url.pathname.slice('/v1.0'.length).split('/').filter(Boolean).map(decodeURIComponent);
    return route(path, method, url, body as Record<string, unknown> | undefined);
  }

  function route(path: string[], method: string, url: URL, body: Record<string, unknown> | undefined): Response {
    if (path[0] === 'subscriptions') return subscription(path, method, body);
    if (path[0] !== 'me') return problem(404, 'NotFound');
    if (path[1] === 'calendar' && path[2] === 'calendarView') return view(calendars.get(PRIMARY)!, url);
    if (path[1] !== 'calendars') return problem(404, 'NotFound');
    if (path.length === 2) {
      if (method === 'POST') {
        const name = String(body?.['name']);
        if ([...calendars.values()].some((one) => one.name.toLowerCase() === name.toLowerCase())) return problem(409, 'ErrorFolderExists');
        const id = `AAMk-made-${String(++made)}`;
        const marked = (body?.['singleValueExtendedProperties'] as { id: string; value: string }[] | undefined)?.some((one) => one.id === OWN_CALENDAR_PROPERTY && one.value === '1') === true;
        calendars.set(id, { id, name, canEdit: true, isDefaultCalendar: false, marked, events: new Map() });
        return json(201, { id, name });
      }
      const onlyMarked = (url.searchParams.get('$filter') ?? '').includes(OWN_CALENDAR_PROPERTY);
      return json(200, { value: [...calendars.values()].filter((one) => !onlyMarked || one.marked === true).map(({ id, name, canEdit, isDefaultCalendar }) => ({ id, name, canEdit, isDefaultCalendar })) });
    }
    const calendar = calendars.get(path[2] ?? '');
    if (calendar === undefined) return problem(404, 'ErrorItemNotFound');
    if (path.length === 3) {
      if (method === 'PATCH') calendar.name = String(body?.['name']);
      return json(200, { id: calendar.id, name: calendar.name });
    }
    if (path[3] === 'calendarView' && path[4] === 'delta') return delta(calendar, url);
    if (path[3] === 'calendarView') return view(calendar, url);
    if (path[3] !== 'events') return problem(404, 'NotFound');
    if (path.length === 4 && method === 'GET') {
      const wanted = /ep\/value eq '([^']*)'/.exec(url.searchParams.get('$filter') ?? '')?.[1];
      const found = [...calendar.events.values()].filter((one) => !one.removed && one.key === wanted);
      return json(200, { value: found.map((one) => selected(one, url.searchParams.get('$select'))) });
    }
    if (path.length === 4 && method === 'POST') {
      const property = (body?.['singleValueExtendedProperties'] as { id: string; value: string }[] | undefined)?.find((one) => one.id === KEY_PROPERTY);
      const etag = tag();
      const id = `AAMk-event-${String(++made)}`;
      const event = { ...(body as unknown as FakeEvent), id, '@odata.etag': etag, serial, ...(property === undefined ? {} : { key: property.value }) };
      calendar.events.set(id, event);
      return json(201, { id, '@odata.etag': etag });
    }
    const event = calendar.events.get(path[4] ?? '');
    if (event === undefined || event.removed === true) return problem(404, 'ErrorItemNotFound');
    if (method === 'GET') return json(200, selected(event, url.searchParams.get('$select')));
    if (method === 'DELETE') {
      Object.assign(event, { removed: true, serial: ++serial });
      return new Response(null, { status: 204 });
    }
    if (method === 'PATCH') {
      Object.assign(event, body, { '@odata.etag': tag(), serial });
      return json(200, { id: event.id, '@odata.etag': event['@odata.etag'] });
    }
    return problem(405, 'MethodNotAllowed');
  }

  function view(calendar: FakeCalendar, url: URL): Response {
    const from = Date.parse(url.searchParams.get('startDateTime') ?? '');
    const to = Date.parse(url.searchParams.get('endDateTime') ?? '');
    const all = [...calendar.events.values()]
      .filter((one) => !one.removed && Date.parse(`${one.start.dateTime.slice(0, 19)}Z`) < to && Date.parse(`${one.end.dateTime.slice(0, 19)}Z`) > from)
      .sort((a, b) => a.serial - b.serial);
    const skip = Number(url.searchParams.get('$skip') ?? 0);
    const size = Math.min(fake.pageSize, Number(url.searchParams.get('$top') ?? 10));
    const value = all.slice(skip, skip + size).map((one) => selected(one, url.searchParams.get('$select')));
    if (skip + size >= all.length) return json(200, { value });
    const next = new URL(url);
    next.searchParams.set('$skip', String(skip + size));
    // Graph's link is taken as it comes: the provider must keep the select itself.
    next.searchParams.delete('$select');
    return json(200, { value, '@odata.nextLink': next.toString() });
  }

  function delta(calendar: FakeCalendar, url: URL): Response {
    const token = url.searchParams.get('$deltatoken');
    if (token !== null && !deltas.has(token)) return problem(410, 'syncStateNotFound');
    const since = token === null ? 0 : deltas.get(token)!.at;
    const value = [...calendar.events.values()]
      .filter((one) => one.serial > since && (token !== null || !one.removed))
      .map((one) => (one.removed || fake.outOfWindow.has(one.id) ? { id: one.id, '@removed': { reason: 'deleted' } } : selected(one, null)));
    const next = `dt${String(++made)}`;
    deltas.set(next, { calendarId: calendar.id, at: serial });
    const link = new URL(url);
    link.searchParams.set('$deltatoken', next);
    return json(200, { value, '@odata.deltaLink': link.toString() });
  }

  function subscription(path: string[], method: string, body: Record<string, unknown> | undefined): Response {
    if (path.length === 1 && method === 'POST') {
      const id = `sub-${String(++made)}`;
      subscriptions.set(id, { id, ...body });
      return json(201, { id, expirationDateTime: body?.['expirationDateTime'] });
    }
    const held = subscriptions.get(path[1] ?? '');
    if (held === undefined) return problem(404, 'ResourceNotFound');
    if (method === 'DELETE') {
      subscriptions.delete(path[1]!);
      return new Response(null, { status: 204 });
    }
    Object.assign(held, body);
    return json(200, { id: held['id'], expirationDateTime: held['expirationDateTime'] });
  }

  return fake;
}
