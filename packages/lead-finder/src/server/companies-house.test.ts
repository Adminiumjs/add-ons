/**
 * COMPANIES HOUSE, MAPPED: what it is asked, what it answers, and what of an
 * answer is kept, against handwritten answers in the specification's shapes.
 */
import { describe, expect, it } from 'vitest';

import { CH_COMPANIES, companiesHouse } from '../testing/answers.ts';
import { contextFor, KEYS, reply } from '../testing/service.ts';
import { createLeadSource } from './index.ts';

const make = (answers = companiesHouse(), key: string | null = KEYS.companiesHouse) => createLeadSource(contextFor('companies-house', key, answers.http));
const find = { activity: '71111', place: { text: 'Leeds', country: 'GB' }, page: { cursor: null, size: 2 } };

describe('Companies House: finding companies', () => {
  it('asks the advanced search by SIC code and place, active companies only, with the key as Basic user name', async () => {
    const answers = companiesHouse();
    await make(answers).findCompanies!(find);
    const [asked] = answers.asked;
    expect(asked?.url.origin + asked!.url.pathname).toBe('https://api.company-information.service.gov.uk/advanced-search/companies');
    expect(Object.fromEntries(asked!.url.searchParams)).toEqual({ sic_codes: '71111', company_status: 'active', size: '2', start_index: '0', location: 'Leeds' });
    expect(asked?.headers['authorization']).toBe(`Basic ${btoa('test-key-companies-1:')}`);
  });

  it('maps each company: number, name, office address in GB, the first SIC code with its label, the register page', async () => {
    const found = await make().findCompanies!(find);
    expect(found).toMatchObject({ ok: true, total: 3, next: '2' });
    if (!found.ok) throw new Error('refused');
    expect(found.companies[0]).toEqual({
      ref: '98000412',
      name: 'KESTREL YARD ARCHITECTS LTD',
      number: '98000412',
      natural: false,
      noMarketing: false,
      sourceUrl: 'https://find-and-update.company-information.service.gov.uk/company/98000412',
      address: { lines: 'Unit 4 Calder Wharf Lane', town: 'Leeds', region: 'West Yorkshire', postalCode: 'LS1 0ZZ', country: 'GB' },
      activity: { code: '71111', label: 'Architectural activities' },
    });
    // Wales is the United Kingdom too.
    expect(found.companies[1]?.address?.country).toBe('GB');
  });

  it('pages with the cursor it gave, and ends when the hits run out', async () => {
    const second = await make().findCompanies!({ ...find, page: { cursor: '2', size: 2 } });
    expect(second).toMatchObject({ ok: true, next: null, total: 3 });
    if (second.ok) expect(second.companies.map((company) => company.number)).toEqual(['98003391']);
  });

  it('leaves out a country it cannot name ("Not specified")', async () => {
    const found = await make().findCompanies!({ ...find, page: { cursor: '2', size: 2 } });
    if (found.ok) expect(found.companies[0]?.address?.country).toBeUndefined();
  });

  it('turns the start of a code into every SIC code it begins', async () => {
    const answers = companiesHouse();
    await make(answers).findCompanies!({ ...find, activity: '7111' });
    expect(answers.asked[0]?.url.searchParams.get('sic_codes')).toBe('71111,71112');
  });

  it('finds nothing outside the United Kingdom, and asks nothing', async () => {
    const answers = companiesHouse();
    expect(await make(answers).findCompanies!({ ...find, place: { text: 'Lyon', country: 'FR' } })).toEqual({ ok: true, companies: [], next: null, total: 0 });
    expect(answers.asked).toEqual([]);
  });

  it('reads a 404 as nothing found', async () => {
    expect(await make().findCompanies!({ ...find, place: { text: 'Hull', country: 'GB' } })).toEqual({ ok: true, companies: [], next: null, total: 0 });
  });

  it('refuses a cursor it never gave', async () => {
    expect(await make().findCompanies!({ ...find, page: { cursor: 'next-please', size: 2 } })).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
  });
});

describe('Companies House: filling one company in', () => {
  it('by number: the profile, and the serving officers by name and role only', async () => {
    const answers = companiesHouse();
    const found = await make(answers).fillCompany!({ number: '98000412' });
    if (!found.ok) throw new Error('refused');
    expect(found.companies).toHaveLength(1);
    expect(found.companies[0]?.officers).toEqual([{ name: 'HALE, Robin', role: 'Director' }]);
    // Never a birth date, a nationality or a home address, whatever the register sends.
    const text = JSON.stringify(found);
    for (const never of ['1980', 'British', 'Home Close', 'Surveyor']) expect(text).not.toContain(never);
    expect(answers.asked.map((one) => one.url.pathname)).toEqual(['/company/98000412', '/company/98000412/officers']);
  });

  it('by number, none there: nothing to fill in', async () => {
    expect(await make().fillCompany!({ number: '98999999' })).toEqual({ ok: true, companies: [], next: null });
  });

  it('by name and town: the companies of that name in that town', async () => {
    const found = await make().fillCompany!({ name: 'Kestrel Yard', town: 'Leeds', country: 'GB' });
    expect(found.ok && found.companies.map((company) => company.number)).toEqual(['98000412']);
  });

  it('by name, the town matching none: every company of that name, for the person to choose', async () => {
    const found = await make().fillCompany!({ name: 'Limited', town: 'York' });
    expect(found.ok && found.companies.map((company) => company.number)).toEqual(['98001537', '98003391']);
  });

  it('keeps no search line as "About"', async () => {
    const found = await make().fillCompany!({ name: 'Kestrel Yard' });
    expect(found.ok && found.companies[0]?.about).toBeUndefined();
  });
});

describe('Companies House: refusals', () => {
  it('a refused key is KEY_REFUSED, on the check and on a search', async () => {
    expect(await make(companiesHouse(), 'refused').checkKey()).toMatchObject({ ok: false, code: 'KEY_REFUSED' });
    expect(await make(companiesHouse(), 'refused').findCompanies!(find)).toMatchObject({ ok: false, code: 'KEY_REFUSED' });
    expect(await make(companiesHouse(), null).checkKey()).toMatchObject({ ok: false, code: 'KEY_REFUSED' });
  });

  it('a good key is accepted by the cheapest call the register has', async () => {
    const answers = companiesHouse();
    expect(await make(answers).checkKey()).toEqual({ ok: true });
    expect(answers.asked.map((one) => one.url.pathname + one.url.search)).toEqual(['/search/companies?q=company&items_per_page=1']);
  });

  it('a 429 is RATE_LIMITED, with the wait it gives, else the rest of the five-minute window', async () => {
    const busy = (after?: string) => companiesHouse(() => reply(429, {}, after === undefined ? {} : { 'retry-after': after }));
    expect(await make(busy('42')).findCompanies!(find)).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSeconds: 42 });
    expect(await make(busy()).fillCompany!({ number: '98000412' })).toMatchObject({ ok: false, code: 'RATE_LIMITED', retryAfterSeconds: 300 });
  });

  it('anything else it answers is UNAVAILABLE', async () => {
    expect(await make(companiesHouse(() => reply(502, 'Bad gateway'))).checkKey()).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
  });

  it('an answer that is not JSON gives nothing, never a throw', async () => {
    expect(await make(companiesHouse(() => reply(200, '<html>'))).findCompanies!(find)).toMatchObject({ ok: true, companies: [] });
  });
});

describe('Companies House: the sample answers', () => {
  it('are made up: every number is in the unallocated 98 block', () => {
    for (const company of CH_COMPANIES) expect(company.company_number).toMatch(/^98\d{6}$/);
  });
});
