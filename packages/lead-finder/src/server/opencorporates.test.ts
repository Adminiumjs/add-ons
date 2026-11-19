/**
 * OPENCORPORATES, MAPPED: fill-in only, the key as `api_token`, the country
 * from the jurisdiction, and its marketing restriction honoured.
 */
import { describe, expect, it } from 'vitest';

import { OC_COMPANY, openCorporates } from '../testing/answers.ts';
import { contextFor, KEYS, reply } from '../testing/service.ts';
import { createLeadSource } from './index.ts';
import { restrictedForMarketing } from './opencorporates.ts';

const make = (answers = openCorporates(), key: string | null = KEYS.openCorporates) => createLeadSource(contextFor('opencorporates', key, answers.http));

describe('OpenCorporates: what it gives', () => {
  it('fills in only: it has no search by activity', () => {
    const source = make();
    expect(source.fillCompany).toBeTypeOf('function');
    expect(source.findCompanies).toBeUndefined();
    expect(source.findPeople).toBeUndefined();
  });
});

describe('OpenCorporates: filling one company in', () => {
  it('by number and country: the company, its registered address, its first industry code, its serving officers', async () => {
    const answers = openCorporates();
    const found = await make(answers).fillCompany!({ number: '98002264', country: 'GB' });
    expect(answers.asked[0]?.url.pathname).toBe('/v0.4/companies/gb/98002264');
    expect(answers.asked[0]?.url.searchParams.get('api_token')).toBe(KEYS.openCorporates);
    expect(found).toEqual({
      ok: true,
      next: null,
      companies: [
        {
          ref: 'gb/98002264',
          name: 'OUSEBURN STUDIO LIMITED',
          number: '98002264',
          natural: false,
          noMarketing: false,
          address: { lines: '3 Lime Kiln Court', town: 'Newcastle upon Tyne', region: 'Tyne and Wear', postalCode: 'NE1 0ZZ', country: 'GB' },
          activity: { code: '71.11', label: 'Architectural activities' },
          officers: [{ name: 'JO ASHBY', role: 'Director' }],
          sourceUrl: 'https://opencorporates.com/companies/gb/98002264',
        },
      ],
    });
  });

  it('a number without a country is refused before anything is asked', async () => {
    const answers = openCorporates();
    expect(await make(answers).fillCompany!({ number: '98002264' })).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(answers.asked).toEqual([]);
  });

  it('by name, in a country: the companies of that name', async () => {
    const answers = openCorporates();
    const found = await make(answers).fillCompany!({ name: 'Ouseburn', town: 'Newcastle upon Tyne', country: 'GB' });
    expect(found.ok && found.companies.map((company) => company.ref)).toEqual(['gb/98002264']);
    expect(Object.fromEntries(answers.asked[0]!.url.searchParams)).toEqual({ q: 'Ouseburn', per_page: '20', api_token: KEYS.openCorporates, country_code: 'gb' });
  });

  it('a jurisdiction that is part of a country gives the country', async () => {
    const found = await make(openCorporates([{ ...OC_COMPANY, jurisdiction_code: 'us_de', registered_address: null }])).fillCompany!({ name: 'Ouseburn' });
    expect(found.ok && found.companies[0]?.address).toEqual({ lines: '3 Lime Kiln Court, Newcastle upon Tyne, NE1 0ZZ', country: 'US' });
  });

  it('none there: nothing to fill in', async () => {
    expect(await make().fillCompany!({ number: '98999999', country: 'GB' })).toEqual({ ok: true, companies: [], next: null });
  });
});

describe('OpenCorporates: restricted for marketing', () => {
  it('a company the register restricts is noMarketing', async () => {
    const found = await make(openCorporates([{ ...OC_COMPANY, restricted_for_marketing: 'true' }])).fillCompany!({ number: '98002264', country: 'GB' });
    expect(found.ok && found.companies[0]?.noMarketing).toBe(true);
  });

  it('reads the text field: any value but an empty or a "no" one restricts', () => {
    for (const yes of [true, 'true', 'Yes', 'restricted', 'Y']) expect(restrictedForMarketing(yes), String(yes)).toBe(true);
    for (const no of [null, undefined, false, '', ' ', 'false', 'No', '0', 'none']) expect(restrictedForMarketing(no), String(no)).toBe(false);
  });
});

describe('OpenCorporates: the key', () => {
  it('is checked by the account status, which spends no look-up', async () => {
    const answers = openCorporates();
    expect(await make(answers).checkKey()).toEqual({ ok: true });
    expect(answers.asked[0]?.url.pathname).toBe('/v0.4/account_status');
  });

  it('a refused key is KEY_REFUSED; none saved is refused before anything is asked', async () => {
    expect(await make(openCorporates(), 'refused').checkKey()).toMatchObject({ ok: false, code: 'KEY_REFUSED' });
    const answers = openCorporates();
    expect(await make(answers, null).fillCompany!({ number: '98002264', country: 'GB' })).toMatchObject({ ok: false, code: 'KEY_REFUSED' });
    expect(answers.asked).toEqual([]);
  });

  it('a 403 or a 429 is RATE_LIMITED', async () => {
    expect(await make(openCorporates(undefined, () => reply(403))).fillCompany!({ name: 'Ouseburn' })).toMatchObject({ code: 'RATE_LIMITED' });
    expect(await make(openCorporates(undefined, () => reply(429, {}, { 'retry-after': '30' }))).checkKey()).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 30 });
  });
});
