/**
 * HUNTER, MAPPED: people only, a person's address only with a name, the
 * pages it was seen on as https addresses (twenty at most), the key in a
 * header, and each refusal by the status Hunter gives it.
 */
import { describe, expect, it } from 'vitest';

import { HUNTER_EMAILS, hunter } from '../testing/answers.ts';
import { contextFor, KEYS, reply } from '../testing/service.ts';
import { personFrom } from './hunter.ts';
import { createLeadSource } from './index.ts';

const make = (answers = hunter(), key: string | null = KEYS.hunter) => createLeadSource(contextFor('hunter', key, answers.http));
const people = { domain: 'kestrelyard.example', company: 'Kestrel Yard Architects' };

describe('Hunter: the people at a domain', () => {
  it('asks the domain search for personal addresses, the key in a header and never in the address', async () => {
    const answers = hunter();
    await make(answers).findPeople!({ ...people, domain: 'WWW.Kestrelyard.example' });
    const [asked] = answers.asked;
    expect(asked?.url.origin + asked!.url.pathname).toBe('https://api.hunter.io/v2/domain-search');
    expect(Object.fromEntries(asked!.url.searchParams)).toEqual({ domain: 'kestrelyard.example', type: 'personal', limit: '50' });
    expect(asked?.headers['x-api-key']).toBe(KEYS.hunter);
    expect(asked?.url.href).not.toContain(KEYS.hunter);
  });

  it('keeps a person with a name: name, role, address, and the https pages they were seen on, once each', async () => {
    const found = await make().findPeople!(people);
    if (!found.ok) throw new Error('refused');
    expect(found.people[0]).toEqual({ name: 'Robin Hale', role: 'Director', email: 'robin@kestrelyard.example', sources: ['https://kestrelyard.example/team'] });
    // Never the phone number Hunter has for them.
    expect(JSON.stringify(found)).not.toContain('07700');
  });

  it('names at most twenty pages for one person', async () => {
    const found = await make().findPeople!(people);
    expect(found.ok && found.people[1]?.sources).toHaveLength(20);
    expect(found.ok && found.people[1]?.role).toBeUndefined();
  });

  it('keeps no address without a name, and no generic address', async () => {
    const found = await make().findPeople!(people);
    expect(found.ok && found.people.map((person) => person.email)).toEqual(['robin@kestrelyard.example', 'sam@kestrelyard.example']);
    expect(personFrom(HUNTER_EMAILS[3])).toBeNull();
    expect(personFrom({ ...HUNTER_EMAILS[0], type: 'generic' })).toBeNull();
    expect(personFrom({ ...HUNTER_EMAILS[0], last_name: '' })).toBeNull();
  });

  it('keeps a person once, however many times Hunter lists them', async () => {
    const twice = [HUNTER_EMAILS[0]!, { ...HUNTER_EMAILS[0]!, value: 'Robin@kestrelyard.example' }];
    const found = await make(hunter(twice)).findPeople!(people);
    expect(found.ok && found.people).toHaveLength(1);
  });

  it('refuses what is no domain before anything is asked', async () => {
    const answers = hunter();
    expect(await make(answers).findPeople!({ ...people, domain: 'not a domain' })).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(answers.asked).toEqual([]);
  });
});

describe('Hunter: the key and its refusals', () => {
  it('checks the key with the account call, which spends no look-up, and says whose account it is', async () => {
    const answers = hunter();
    expect(await make(answers).checkKey()).toEqual({ ok: true, account: 'dana@meridian.example' });
    expect(answers.asked.map((one) => one.url.pathname)).toEqual(['/v2/account']);
  });

  it('401 is KEY_REFUSED, 403 RATE_LIMITED, 429 QUOTA_SPENT, 451 NOT_FOUND', async () => {
    expect(await make(hunter(), 'refused').findPeople!(people)).toMatchObject({ code: 'KEY_REFUSED' });
    expect(await make(hunter(undefined, () => reply(403, {}, { 'retry-after': '2' }))).findPeople!(people)).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 2 });
    expect(await make(hunter(undefined, () => reply(429))).findPeople!(people)).toMatchObject({ code: 'QUOTA_SPENT' });
    expect(await make(hunter(undefined, () => reply(451))).findPeople!(people)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('with no key saved, refuses before anything is asked', async () => {
    const answers = hunter();
    expect(await make(answers, null).findPeople!(people)).toMatchObject({ code: 'KEY_REFUSED' });
    expect(answers.asked).toEqual([]);
  });

  it('gives people only', () => {
    const source = make();
    expect(source.findCompanies).toBeUndefined();
    expect(source.fillCompany).toBeUndefined();
  });
});
