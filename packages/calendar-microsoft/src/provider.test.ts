/**
 * WHAT THE KIT CANNOT SAY ABOUT MICROSOFT: the three rules that keep titles out,
 * all-day days, paging, refusals, the subscription and its handshake.
 */
import { describe, expect, it } from 'vitest';

import { createCalendarProvider, createOutlookProvider } from './provider.ts';
import { createFakeGraph } from './testing/fake-graph.ts';
import { BUSY_SELECT, OWN_CURSOR_DAYS, SUBSCRIPTION_MINUTES, dayOf, packCursor } from './wire.ts';

const FROM = '2030-01-07T00:00:00.000Z';
const TO = '2030-01-14T00:00:00.000Z';
const NOW = Date.UTC(2030, 0, 7, 12);
const utc = (at: string) => ({ dateTime: `${at}.0000000`, timeZone: 'UTC' });

function setup() {
  const graph = createFakeGraph();
  return { graph, provider: createOutlookProvider({ http: graph.http, now: () => NOW }) };
}

const visit = (calendarId: string, key = 'key-1') => ({ calendarId, key, remoteId: null, start: '2030-01-08T09:00:00.000Z', end: '2030-01-08T10:00:00.000Z', zone: 'America/Los_Angeles', title: 'Facial, Dana R.' });

describe('the three rules that keep titles out', () => {
  it('rule 1: every busy read, on every page, is calendarView with the select, never delta', async () => {
    const { graph, provider } = setup();
    graph.pageSize = 2;
    graph.addCalendar('second', 'Second');
    for (let hour = 10; hour < 15; hour += 1) graph.addEvent('primary', { subject: 'Secret title', start: utc(`2030-01-08T${String(hour)}:00:00`), end: utc(`2030-01-08T${String(hour)}:30:00`) });
    graph.addEvent('second', { subject: 'Secret title', start: utc('2030-01-09T10:00:00'), end: utc('2030-01-09T11:00:00') });
    const answer = await provider.readBusy({ calendarIds: ['primary', 'second'], from: FROM, to: TO });
    expect('intervals' in answer && answer.intervals.length).toBe(6);
    expect(JSON.stringify(answer)).not.toContain('Secret');
    expect(graph.requests.length).toBeGreaterThanOrEqual(4);
    for (const request of graph.requests) {
      expect(request.url.pathname).toMatch(/\/calendarView$/);
      expect(request.url.searchParams.get('$select')).toBe(BUSY_SELECT);
    }
    expect(BUSY_SELECT).not.toMatch(/subject|body|location|attendees|organizer/i);
  });

  it('rule 2: a subscription never asks for resource data', async () => {
    const { graph, provider } = setup();
    await provider.watch({ target: 'busy', calendarIds: ['primary'], channelId: 'chn_1', secret: 's3cret', address: 'https://admin.example.test/hook' });
    const held = [...graph.subscriptions.values()][0]!;
    expect(held['includeResourceData']).toBeUndefined();
    expect(held['resource']).toBe('/me/events');
  });

  it('rule 3: a delivery fetches nothing', () => {
    const { graph, provider } = setup();
    provider.readHook({ headers: {}, query: {}, rawBody: JSON.stringify({ value: [{ clientState: 'x', resource: 'Users/1/Events/2', resourceData: { id: '2' } }] }) });
    expect(graph.requests).toEqual([]);
  });

  it('copies no words from the one delta read, of its own calendar', async () => {
    const { graph, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    graph.addEvent(calendarId, { subject: 'Something the person typed here', start: utc('2030-01-08T10:00:00'), end: utc('2030-01-08T11:00:00') });
    const answer = await provider.listOwnEvents({ calendarId, cursor: null });
    expect(JSON.stringify(answer)).not.toContain('typed here');
  });
});

describe('a busy read', () => {
  it('reads each Outlook state', async () => {
    const { graph, provider } = setup();
    for (const [index, showAs] of ['free', 'tentative', 'busy', 'oof', 'workingElsewhere', 'unknown'].entries()) {
      graph.addEvent('primary', { showAs, start: utc(`2030-01-08T1${String(index)}:00:00`), end: utc(`2030-01-08T1${String(index)}:30:00`) });
    }
    const answer = (await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })) as { intervals: { kind: string }[] };
    expect(answer.intervals.map((one) => one.kind)).toEqual(['free', 'tentative', 'busy', 'away', 'elsewhere', 'busy']);
  });

  it('skips a cancelled meeting, and reads an all-day event as dates', async () => {
    const { graph, provider } = setup();
    graph.addEvent('primary', { isCancelled: true, start: utc('2030-01-08T10:00:00'), end: utc('2030-01-08T11:00:00') });
    graph.addEvent('primary', { isAllDay: true, start: utc('2030-01-09T00:00:00'), end: utc('2030-01-10T00:00:00') });
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ intervals: [{ allDay: true, date: '2030-01-09', endDate: '2030-01-10', kind: 'busy' }] });
  });

  it.each([
    ['2030-01-09T00:00:00.0000000', '2030-01-09'],
    ['2030-01-09T08:00:00.0000000', '2030-01-09'],
    ['2030-01-08T23:00:00.0000000', '2030-01-09'],
    ['2029-12-31T15:00:00.0000000', '2030-01-01'],
  ])('reads an all-day time of %s as %s', (dateTime, day) => {
    expect(dayOf({ dateTime, timeZone: 'UTC' })).toBe(day);
  });

  it('refuses a time in a zone it did not ask for, rather than misplace it', async () => {
    const http = () => Promise.resolve(new Response(JSON.stringify({ value: [{ start: { dateTime: '2030-01-08T10:00:00.0000000', timeZone: 'Pacific Standard Time' }, end: { dateTime: '2030-01-08T11:00:00.0000000', timeZone: 'Pacific Standard Time' } }] }), { status: 200 }));
    expect(await createCalendarProvider({ http }).readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
  });

  it('asks for UTC times and ids that survive a move', async () => {
    const { graph, provider } = setup();
    await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO });
    expect(graph.requests[0]!.prefer).toBe('outlook.timezone="UTC", IdType="ImmutableId"');
  });

  it('a page that fails fails the whole read, and a link off Graph is not followed', async () => {
    const { graph, provider } = setup();
    graph.pageSize = 1;
    graph.addEvent('primary', { start: utc('2030-01-08T10:00:00'), end: utc('2030-01-08T11:00:00') });
    graph.addEvent('primary', { start: utc('2030-01-08T12:00:00'), end: utc('2030-01-08T13:00:00') });
    graph.failNext((one) => one.url.searchParams.get('$skip') === '1', 503);
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
    const seen: string[] = [];
    const hostile = (input: string | URL) => {
      seen.push(String(input));
      return Promise.resolve(new Response(JSON.stringify({ value: [], '@odata.nextLink': 'https://evil.example.test/steal' }), { status: 200 }));
    };
    expect(await createCalendarProvider({ http: hostile }).readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
    expect(seen.length).toBe(1);
  });
});

describe('the calendar it keeps', () => {
  it('reuses one of the same name, whatever its case, and never the main calendar', async () => {
    const { graph, provider } = setup();
    graph.addCalendar('existing', 'lumen studio');
    expect(await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })).toEqual({ calendarId: 'existing' });
    const main = await provider.ensureCalendar({ name: 'Calendar', knownId: null });
    expect(main).toEqual({ calendarError: 'CONFLICT' });
  });

  it('renames in place, and finds or makes one when the known one is gone', async () => {
    const { graph, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Old', knownId: null })) as { calendarId: string };
    await provider.ensureCalendar({ name: 'New', knownId: calendarId });
    expect(graph.calendars.get(calendarId)?.name).toBe('New');
    await graph.driver.deleteCalendarOutside(calendarId);
    const remade = (await provider.ensureCalendar({ name: 'New', knownId: calendarId })) as { calendarId: string };
    expect(remade.calendarId).not.toBe(calendarId);
  });

  it('writes no guest, place, body or reminder, in UTC', async () => {
    const { graph, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    await provider.upsertEvent(visit(calendarId));
    const body = graph.requests.find((one) => one.method === 'POST' && one.url.pathname.endsWith('/events'))!.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['end', 'isReminderOn', 'responseRequested', 'showAs', 'singleValueExtendedProperties', 'start', 'subject']);
    expect(body['start']).toEqual({ dateTime: '2030-01-08T09:00:00.000', timeZone: 'UTC' });
    expect(body['isReminderOn']).toBe(false);
  });

  it('a delta read that Graph does not know is not a deleted calendar', async () => {
    const { graph, provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    graph.failNext((one) => one.url.pathname.endsWith('/delta'), 404);
    expect(await provider.listOwnEvents({ calendarId, cursor: null })).toEqual({ calendarError: 'UNAVAILABLE' });
    await graph.driver.deleteCalendarOutside(calendarId);
    expect(await provider.listOwnEvents({ calendarId, cursor: null })).toEqual({ calendarError: 'CALENDAR_MISSING' });
  });

  it('begins the delta read again before its window goes stale, and refuses a cursor off Graph', async () => {
    const { provider } = setup();
    const today = Math.floor(NOW / 86_400_000);
    const link = 'https://graph.microsoft.com/v1.0/me/calendars/c/calendarView/delta?$deltatoken=x';
    expect(await provider.listOwnEvents({ calendarId: 'c', cursor: packCursor({ day: today - OWN_CURSOR_DAYS, link }) })).toEqual({ calendarError: 'CURSOR_GONE' });
    expect(await provider.listOwnEvents({ calendarId: 'c', cursor: `${String(today)}:https://evil.example.test/x` })).toEqual({ calendarError: 'CURSOR_GONE' });
  });

  it('reads an expired delta position as CURSOR_GONE', async () => {
    const { provider } = setup();
    const { calendarId } = (await provider.ensureCalendar({ name: 'Lumen Studio', knownId: null })) as { calendarId: string };
    const today = Math.floor(NOW / 86_400_000);
    const link = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/calendarView/delta?$deltatoken=expired`;
    expect(await provider.listOwnEvents({ calendarId, cursor: packCursor({ day: today, link }) })).toEqual({ calendarError: 'CURSOR_GONE' });
  });

  it('lists calendars with the main one named', async () => {
    const { graph, provider } = setup();
    graph.addCalendar('second', 'Work');
    const answer = (await provider.listCalendars()) as { calendars: { id: string; primary: boolean }[] };
    expect(answer.calendars.map((one) => [one.id, one.primary])).toEqual([['AAMk-default', true], ['second', false]]);
  });
});

describe('refusals', () => {
  it.each([
    [401, 'UNAUTHORIZED'],
    [403, 'PERMISSION_MISSING'],
    [429, 'RATE_LIMITED'],
    [500, 'UNAVAILABLE'],
    [503, 'UNAVAILABLE'],
  ])('reads %i as %s', async (status, code) => {
    const { graph, provider } = setup();
    graph.failNext(() => true, status);
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toMatchObject({ calendarError: code });
  });

  it('keeps how long Microsoft asked to be left alone', async () => {
    const { graph, provider } = setup();
    graph.failNext(() => true, 429, undefined, { 'retry-after': '12' });
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'RATE_LIMITED', retryAfterMs: 12_000 });
  });

  it('a failed connection is a refusal, never a throw', async () => {
    const provider = createCalendarProvider({ http: () => Promise.reject(new Error('socket hang up')) });
    expect(await provider.readBusy({ calendarIds: ['primary'], from: FROM, to: TO })).toEqual({ calendarError: 'UNAVAILABLE' });
  });
});

describe('push', () => {
  const input = { target: 'busy' as const, calendarIds: ['primary'], channelId: 'chn_1', secret: 's3cret', address: 'https://admin.example.test/api/v1/calendars/hook/calendar-microsoft/chn_1' };
  const ref = (remoteChannelId: string | null) => ({ channelId: 'chn_1', remoteChannelId, resourceId: null, address: input.address, secret: input.secret });

  it('subscribes for under seven days, with the secret and the lifecycle address', async () => {
    const { graph, provider } = setup();
    const answer = (await provider.watch(input)) as { remoteChannelId: string; expiresAt: string };
    const held = graph.subscriptions.get(answer.remoteChannelId)!;
    expect(held).toMatchObject({ clientState: 's3cret', notificationUrl: input.address, lifecycleNotificationUrl: input.address, changeType: 'created,updated,deleted' });
    expect(Date.parse(answer.expiresAt) - NOW).toBe(SUBSCRIPTION_MINUTES * 60_000);
    expect(SUBSCRIPTION_MINUTES).toBeLessThan(10_080);
    expect(input.secret.length).toBeLessThanOrEqual(128);
  });

  it('renews in place, and a subscription Microsoft lost makes the engine open a new one', async () => {
    const { provider } = setup();
    const { remoteChannelId } = (await provider.watch(input)) as { remoteChannelId: string };
    expect(await provider.renew(ref(remoteChannelId))).toMatchObject({ expiresAt: expect.any(String) });
    expect(await provider.renew(ref('gone'))).toEqual({ calendarError: 'INVALID_REQUEST' });
  });

  it('stops a subscription, and one already gone counts as stopped', async () => {
    const { graph, provider } = setup();
    const { remoteChannelId } = (await provider.watch(input)) as { remoteChannelId: string };
    expect(await provider.unwatch(ref(remoteChannelId))).toEqual({ stopped: true });
    expect(graph.subscriptions.size).toBe(0);
    expect(await provider.unwatch(ref('gone'))).toEqual({ stopped: true });
  });

  it('hands back the handshake token, spaces included', () => {
    const { provider } = setup();
    const token = 'Validation: Testing client application reachability for subscription Request-Id: 25ff4c23';
    expect(provider.readHook({ headers: {}, query: { validationToken: token }, rawBody: '' })).toEqual({ handshake: token, notices: [] });
  });

  it('reads each notice and lifecycle event, and believes nothing', () => {
    const { provider } = setup();
    const rawBody = JSON.stringify({ value: [{ clientState: 'a', changeType: 'updated' }, { clientState: 'b', lifecycleEvent: 'reauthorizationRequired' }, { clientState: 'c', lifecycleEvent: 'subscriptionRemoved' }, { clientState: 'd', lifecycleEvent: 'missed' }, { changeType: 'updated' }] });
    expect(provider.readHook({ headers: {}, query: {}, rawBody })).toEqual({
      handshake: null,
      notices: [{ secret: 'a', kind: 'changed' }, { secret: 'b', kind: 'reauthorize' }, { secret: 'c', kind: 'removed' }, { secret: 'd', kind: 'missed' }, { secret: null, kind: 'changed' }],
    });
    expect(provider.readHook({ headers: {}, query: {}, rawBody: 'not json' })).toEqual({ handshake: null, notices: [] });
    expect(provider.readHook({ headers: {}, query: {}, rawBody: '{"value":"x"}' })).toEqual({ handshake: null, notices: [] });
  });
});
