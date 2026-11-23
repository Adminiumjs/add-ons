/**
 * WHAT THE KIT CANNOT SAY ABOUT GOOGLE: the no-words read, all-day and free
 * events, paging, refusals, the push channels and a lost calendar.
 */
import { describe, expect, it } from 'vitest';

import { createCalendarProvider } from './provider.ts';
import { createFakeGoogle } from './testing/fake-google.ts';
import { BUSY_FIELDS, OWN_CALENDAR_MARK, eventIdOf, keyOfEventId, unpackChannels } from './wire.ts';

const FROM = '2030-01-07T00:00:00.000Z';
const TO = '2030-01-14T00:00:00.000Z';

function setup() {
  const google = createFakeGoogle();
  return { google, provider: createCalendarProvider({ http: google.http }) };
}

const visit = (calendarId: string, key = 'key-1') => ({ calendarId, key, remoteId: null, start: '2030-01-08T09:00:00.000Z', end: '2030-01-08T10:00:00.000Z', zone: 'America/Los_Angeles', title: 'Facial, Dana R.' });

describe('a busy read', () => {
  it('asks Google for times only and passes on no words, even from a public event', async () => {
    const { google, provider } = setup();
    google.addEvent('primary', { summary: 'Secret title', description: 'Secret notes', location: 'Secret place', attendees: [{ email: 'guest@example.test' }], visibility: 'public', start: { dateTime: '2030-01-08T09:00:00-08:00' }, end: { dateTime: '2030-01-08T10:00:00-08:00' } });
    const answer = await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO });
    expect(answer).toEqual({ intervals: [{ allDay: false, start: '2030-01-08T17:00:00.000Z', end: '2030-01-08T18:00:00.000Z', kind: 'busy' }] });
    const reads = google.requests.filter((one) => one.url.pathname.endsWith('/events'));
    expect(reads.length).toBe(1);
    expect(reads[0]!.url.searchParams.get('fields')).toBe(BUSY_FIELDS);
    expect(BUSY_FIELDS).not.toMatch(/summary|description|location|attendees|creator|organizer/);
    expect(reads[0]!.url.searchParams.get('singleEvents')).toBe('true');
  });

  it('reads free as free, an all-day event as dates, and skips a cancelled one', async () => {
    const { google, provider } = setup();
    google.addEvent('primary', { transparency: 'transparent', start: { dateTime: '2030-01-08T09:00:00Z' }, end: { dateTime: '2030-01-08T10:00:00Z' } });
    google.addEvent('primary', { start: { date: '2030-01-09' }, end: { date: '2030-01-10' } });
    google.addEvent('primary', { status: 'cancelled', start: { dateTime: '2030-01-08T11:00:00Z' }, end: { dateTime: '2030-01-08T12:00:00Z' } });
    const answer = await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO });
    expect(answer).toEqual({
      intervals: [
        { allDay: false, start: '2030-01-08T09:00:00.000Z', end: '2030-01-08T10:00:00.000Z', kind: 'free' },
        { allDay: true, date: '2030-01-09', endDate: '2030-01-10', kind: 'busy' },
      ],
    });
  });

  it('follows every page, and a page that fails fails the whole read', async () => {
    const { google, provider } = setup();
    google.pageSize = 2;
    for (let day = 1; day <= 5; day += 1) google.addEvent('primary', { start: { dateTime: `2030-01-0${String(day + 7 > 9 ? 9 : 8)}T0${String(day)}:00:00Z` }, end: { dateTime: `2030-01-0${String(day + 7 > 9 ? 9 : 8)}T0${String(day)}:30:00Z` } });
    const whole = await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO });
    expect('intervals' in whole && whole.intervals.length).toBe(5);
    google.failNext((one) => one.url.searchParams.get('pageToken') === '2', 503);
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
  });

  it('refuses an event it cannot read rather than opening its slot', async () => {
    const http = () => Promise.resolve(new Response(JSON.stringify({ items: [{ start: { dateTime: 'nonsense' }, end: { dateTime: 'x' } }] }), { status: 200 }));
    expect(await createCalendarProvider({ http }).readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
  });
});

describe('the calendar it keeps', () => {
  it('marks what it makes, and asks the list once, expecting a refusal', async () => {
    const { google, provider } = setup();
    const made = await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null });
    expect('calendarId' in made).toBe(true);
    const id = (made as { calendarId: string }).calendarId;
    expect(google.calendars.get(id)?.description).toBe(OWN_CALENDAR_MARK);
    expect(google.requests.filter((one) => one.url.pathname.endsWith('/calendarList')).length).toBe(1);
  });

  it('with the id lost and the list refused, it makes one new calendar and does not fail', async () => {
    const { provider, google } = setup();
    const first = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    const second = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    expect(second.calendarId).not.toBe(first.calendarId);
    expect(google.calendars.size).toBe(3);
  });

  it('reuses the marked calendar when Google does answer the list, and never one the person named the same', async () => {
    const { google, provider } = setup();
    google.listAllowed = true;
    google.addCalendar('persons-own', 'Lumen Studio');
    const first = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    expect(first.calendarId).not.toBe('persons-own');
    const again = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    expect(again.calendarId).toBe(first.calendarId);
  });

  it('does not make a second calendar while the list is merely down', async () => {
    const { google, provider } = setup();
    google.failNext((one) => one.url.pathname.endsWith('/calendarList'), 503);
    expect(await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })).toEqual({ calendarError: 'UNAVAILABLE' });
    expect(google.calendars.size).toBe(1);
  });

  it('renames in place, and makes a new one when the known one is gone', async () => {
    const { google, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Old name', knownId: null })) as { calendarId: string };
    await provider.ensureCalendar({ name: 'New name', knownId: calendarId });
    expect(google.calendars.get(calendarId)?.summary).toBe('New name');
    await google.driver.deleteCalendarOutside(calendarId);
    const remade = (await provider.ensureCalendar({ name: 'New name', knownId: calendarId })) as { calendarId: string };
    expect(remade.calendarId).not.toBe(calendarId);
  });

  it('writes no guest, place, description or reminder', async () => {
    const { google, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    await provider.upsertEvent(visit(calendarId));
    const body = google.requests.find((one) => one.method === 'POST' && one.url.pathname.endsWith('/events'))!.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['end', 'id', 'reminders', 'start', 'summary', 'transparency']);
    expect(body['reminders']).toEqual({ useDefault: false });
  });

  it('a key whose event was deleted is spent, so the core mints the next', async () => {
    const { provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    const made = (await provider.upsertEvent(visit(calendarId))) as { remoteId: string };
    await provider.deleteEvent({ calendarId, remoteId: made.remoteId });
    expect(await provider.upsertEvent(visit(calendarId))).toEqual({ calendarError: 'CONFLICT' });
  });

  it('turns any key into an id Google accepts, and back', () => {
    for (const key of ['conformance-12', 'a'.repeat(128), 'Ünï-çødé']) {
      const id = eventIdOf(key);
      expect(id).toMatch(/^[a-v0-9]{5,1024}$/);
      expect(keyOfEventId(id)).toBe(key);
    }
    expect(keyOfEventId('person12')).toBeNull();
  });

  it('reads an expired sync position as CURSOR_GONE', async () => {
    const { provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    expect(await provider.listOwnEvents({ calendarId, cursor: 's:expired' })).toEqual({ calendarError: 'CURSOR_GONE' });
  });
});

describe('refusals', () => {
  it.each([
    [401, undefined, 'UNAUTHORIZED'],
    [403, { error: { errors: [{ reason: 'forbidden' }] } }, 'PERMISSION_MISSING'],
    [403, { error: { errors: [{ reason: 'rateLimitExceeded' }] } }, 'RATE_LIMITED'],
    [403, { error: { errors: [{ reason: 'userRateLimitExceeded' }] } }, 'RATE_LIMITED'],
    [429, undefined, 'RATE_LIMITED'],
    [500, undefined, 'UNAVAILABLE'],
  ])('reads %i %j as %s', async (status, body, code) => {
    const { google, provider } = setup();
    google.failNext(() => true, status, body);
    const answer = await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO });
    expect(answer).toMatchObject({ calendarError: code });
  });

  it('keeps how long Google asked to be left alone', async () => {
    const { google, provider } = setup();
    google.failNext(() => true, 429, undefined, { 'retry-after': '30' });
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'RATE_LIMITED', retryAfterMs: 30_000 });
  });

  it('a failed connection is a refusal, never a throw', async () => {
    const provider = createCalendarProvider({ http: () => Promise.reject(new Error('socket hang up')) });
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
  });

  it('cannot list calendars under these permissions', async () => {
    const { google, provider } = setup();
    expect(await provider.listCalendars()).toEqual({ calendarError: 'PERMISSION_MISSING' });
    expect(google.requests).toEqual([]);
    expect(provider.traits).toEqual({ listsCalendars: false, allDayKnown: true, busyPush: true });
  });
});

describe('push', () => {
  const input = { target: 'busy' as const, channelId: 'chn_1', secret: 's3cret', address: 'https://admin.example.test/api/v1/calendars/hook/calendar-google/chn_1' };

  it('opens one channel per calendar to the same address, and stops them all', async () => {
    const { google, provider } = setup();
    google.addCalendar('second', 'Second');
    const answer = (await provider.watch({ ...input, calendarIds: ['primary', 'second'] })) as { resourceId: string; expiresAt: string };
    expect([...google.channels.keys()].sort()).toEqual(['chn_1', 'chn_1-1']);
    for (const channel of google.channels.values()) expect(channel).toMatchObject({ token: 's3cret', address: input.address });
    expect(answer.expiresAt).toBe('2030-01-14T00:00:00.000Z');
    expect(answer.resourceId.length).toBeLessThanOrEqual(1024);
    const stopped = await provider.unwatch({ channelId: 'chn_1', remoteChannelId: 'chn_1', resourceId: answer.resourceId, address: input.address, secret: input.secret });
    expect(stopped).toEqual({ stopped: true });
    expect(google.channels.size).toBe(0);
  });

  it('stays inside the limit of the reference the engine keeps', async () => {
    const { google, provider } = setup();
    const ids = Array.from({ length: 12 }, (_, index) => `calendar-${String(index)}`);
    for (const id of ids) google.addCalendar(id, id);
    const answer = (await provider.watch({ ...input, calendarIds: ids })) as { resourceId: string };
    expect(google.channels.size).toBe(8);
    expect(answer.resourceId.length).toBeLessThanOrEqual(1024);
  });

  it('leaves no channel behind when a later calendar refuses', async () => {
    const { google, provider } = setup();
    expect(await provider.watch({ ...input, calendarIds: ['primary', 'missing'] })).toEqual({ calendarError: 'CALENDAR_MISSING' });
    expect(google.channels.size).toBe(0);
  });

  it('treats a channel Google has forgotten as stopped', async () => {
    const { provider } = setup();
    expect(await provider.unwatch({ channelId: 'gone', remoteChannelId: 'gone', resourceId: 'res-gone', address: input.address, secret: input.secret })).toEqual({ stopped: true });
  });

  it('cannot renew in place, so the engine opens a new channel first', async () => {
    const { provider } = setup();
    expect(await provider.renew({ channelId: 'x', remoteChannelId: 'x', resourceId: 'y', address: input.address, secret: input.secret })).toEqual({ calendarError: 'INVALID_REQUEST' });
  });

  it('reads a delivery in any header case, and believes nothing', () => {
    const { provider } = setup();
    expect(provider.readHook({ headers: { 'x-goog-resource-state': 'sync', 'x-goog-channel-token': 's3cret' }, query: {}, rawBody: '' })).toEqual({ handshake: null, notices: [{ secret: 's3cret', kind: 'sync' }] });
    expect(provider.readHook({ headers: { 'X-Goog-Resource-State': 'exists' }, query: {}, rawBody: '' })).toEqual({ handshake: null, notices: [{ secret: null, kind: 'changed' }] });
    expect(provider.readHook({ headers: {}, query: {}, rawBody: '' })).toEqual({ handshake: null, notices: [] });
  });

  it('reads a plain stored resource id as its one channel', () => {
    expect(unpackChannels('chn', 'res')).toEqual([{ id: 'chn', resourceId: 'res' }]);
    expect(unpackChannels('chn', null)).toEqual([]);
    expect(unpackChannels('chn', '[broken')).toEqual([]);
  });
});
