import { describe, expect, it } from 'vitest';

import { addCalendarProblem, checkResult, countsOf, dayAfter, daysUntil, firstNameOf, initialsOf, instantCard, isDay, isGoogleClientId, isMicrosoftClientId, isTenant, localProblem, secretNotice, setupCard, splitPeople, type Person, type SetupDraft } from './model.ts';

const person = (over: Partial<Person> & { state?: NonNullable<Person['account']>['state'] | null }): Person => {
  const { state = 'connected', ...rest } = over;
  return {
    connection: 'c',
    table: 't',
    row: '1',
    name: 'Elin Sund',
    address: 'elin@example.test',
    account: state === null ? null : { id: 'a', state, since: 0, address: 'elin@example.test', addressDiffers: false, grantEndsAt: null },
    lastSyncedAt: null,
    elsewhere: false,
    ...rest,
  };
};

describe('the setup card', () => {
  it('reads "Ready" only once someone has connected through the app', () => {
    expect(setupCard({ install: 'not-set-up', registered: false, accounts: 0 })).toBe('not-set-up');
    expect(setupCard({ install: 'ready', registered: true, accounts: 0 })).toBe('almost');
    expect(setupCard({ install: 'ready', registered: true, accounts: 1 })).toBe('ready');
  });

  it('says the studio has to act when the provider refuses its app, however many are connected', () => {
    expect(setupCard({ install: 'secret-refused', registered: true, accounts: 6 })).toBe('refused');
    expect(setupCard({ install: 'cannot-read-keys', registered: false, accounts: 6 })).toBe('keys-lost');
  });
});

describe('the instant card', () => {
  it.each([
    ['cannot-connect', true, 'cannot'],
    ['cannot-connect', false, 'cannot'],
    ['push', false, 'waiting'],
    ['push', true, 'on'],
    ['poll-only', true, 'polling'],
  ] as const)('%s, registered %s: %s', (reach, registered, card) => {
    expect(instantCard({ reach, registered })).toBe(card);
  });
});

describe('the people', () => {
  it('counts a studio-wide refusal as connected, not as people to reconnect', () => {
    expect(countsOf([person({}), person({ state: 'setup' }), person({ state: 'reconnect' }), person({ state: 'partial' }), person({ state: null }), person({ state: 'disconnecting' })])).toEqual({ connected: 2, reconnect: 2 });
  });

  it('offers a link only to someone connected nowhere', () => {
    const a = person({ row: 'a' });
    const b = person({ row: 'b', state: null });
    const c = person({ row: 'c', state: null, elsewhere: true });
    const d = person({ row: 'd', state: 'disconnecting' });
    const split = splitPeople([a, b, c, d]);
    expect(split.connected.map((one) => one.row)).toEqual(['a']);
    expect(split.invite.map((one) => one.row)).toEqual(['b']);
  });

  it('names people', () => {
    expect(initialsOf('Elin Sund', null)).toBe('ES');
    expect(initialsOf(null, 'rafa@example.test')).toBe('R');
    expect(firstNameOf({ name: 'Elin Sund', address: null })).toBe('Elin');
    expect(firstNameOf({ name: null, address: 'rafa@example.test' })).toBe('rafa@example.test');
  });
});

describe('the secret’s end date', () => {
  const now = Date.UTC(2026, 8, 15, 10);

  it('warns 30 days ahead, and says when it has passed', () => {
    expect(secretNotice(null, now)).toEqual({ kind: 'none' });
    expect(secretNotice('2026-11-30', now)).toEqual({ kind: 'none' });
    expect(secretNotice('2026-10-15', now)).toEqual({ kind: 'soon', days: 30 });
    expect(secretNotice('2026-09-16', now)).toEqual({ kind: 'soon', days: 1 });
    expect(secretNotice('2026-09-14', now)).toEqual({ kind: 'past' });
    expect(daysUntil('2026-09-16', now)).toBe(1);
  });

  it('takes only a real day', () => {
    expect(isDay('2028-02-29')).toBe(true);
    expect(isDay('2027-02-29')).toBe(false);
    expect(isDay('15/09/2026')).toBe(false);
  });
});

describe('the shapes', () => {
  it('knows a client ID', () => {
    expect(isGoogleClientId('482130655917-k2q9m5ls.apps.googleusercontent.com')).toBe(true);
    expect(isGoogleClientId('482130655917')).toBe(false);
    expect(isMicrosoftClientId('7c1e5b2a-3f9d-4a61-b0e8-2d5c9a4f1e73')).toBe(true);
    expect(isMicrosoftClientId('not-a-guid')).toBe(false);
  });

  it('knows a directory, and is not fooled by a path', () => {
    expect(isTenant('7c1e5b2a-3f9d-4a61-b0e8-2d5c9a4f1e73')).toBe(true);
    expect(isTenant('contoso.onmicrosoft.com')).toBe(true);
    expect(isTenant('common')).toBe(false);
    expect(isTenant('evil.example/path')).toBe(false);
  });

  const draft = (over: Partial<SetupDraft>): SetupDraft => ({ clientId: 'id', secret: 'secret', hasSavedSecret: false, tenant: null, singleTenant: false, endsOn: '', ...over });
  const any = () => true;

  it('judges what it can before anything is sent', () => {
    expect(localProblem(draft({ clientId: ' ' }), any)).toBe('empty');
    expect(localProblem(draft({ secret: '' }), any)).toBe('empty');
    expect(localProblem(draft({ secret: '', hasSavedSecret: true }), any)).toBeNull();
    expect(localProblem(draft({}), () => false)).toBe('client-shape');
    expect(localProblem(draft({ tenant: '', singleTenant: true }), any)).toBe('tenant-needed');
    expect(localProblem(draft({ tenant: 'bad value', singleTenant: true }), any)).toBe('tenant-shape');
    expect(localProblem(draft({ tenant: '', singleTenant: false }), any)).toBeNull();
    expect(localProblem(draft({ endsOn: 'soon' }), any)).toBe('date-shape');
  });

  it('never calls a check "ready" on what it could not prove', () => {
    expect(checkResult('accepted')).toBe('good');
    expect(checkResult('unknown')).toBe('unproved');
    expect(checkResult('refused')).toBe('refused');
    expect(checkResult('not-set-up')).toBe('refused');
    expect(checkResult('expired')).toBe('expired');
    expect(checkResult('unreachable')).toBe('unreachable');
  });

  it('judges a typed calendar', () => {
    expect(addCalendarProblem(' ', [])).toBe('empty');
    expect(addCalendarProblem('a b', [])).toBe('spaces');
    expect(addCalendarProblem('x@y', ['x@y'])).toBe('already');
    expect(addCalendarProblem('x@y', [])).toBeNull();
    expect(dayAfter(Date.UTC(2026, 8, 15), 14)).toBe('2026-09-29');
  });
});
