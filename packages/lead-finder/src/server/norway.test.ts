/**
 * THE REGISTER OF NORWAY, MAPPED: SN2025 codes by prefix, the municipality
 * from the register's own list, the sole proprietorship it marks as a
 * person, and the mobile number it never takes.
 */
import { describe, expect, it } from 'vitest';

import { norway, noUnit, NO_UNIT } from '../testing/answers.ts';
import { failing, passesMod11 } from '../testing/check-digits.ts';
import { contextFor, reply } from '../testing/service.ts';
import { createLeadSource } from './index.ts';
import { isSoleProprietorship } from './norway.ts';

const make = (answers = norway()) => createLeadSource(contextFor('norway', null, answers.http));
const find = (text: string, activity = '71.110', codes?: string[]) => ({ activity, place: { text, country: 'NO', ...(codes === undefined ? {} : { codes }) }, page: { cursor: null, size: 20 } });
const units = (answers: ReturnType<typeof norway>) => answers.asked.filter((one) => one.url.pathname === '/enhetsregisteret/api/enheter').map((one) => Object.fromEntries(one.url.searchParams));

describe('Norway: where and what a search asks', () => {
  it('a town becomes its municipality number from the register’s own list', async () => {
    const answers = norway();
    await make(answers).findCompanies!(find('Bergen'));
    expect(answers.asked.map((one) => one.url.pathname)).toEqual(['/enhetsregisteret/api/kommuner', '/enhetsregisteret/api/enheter']);
    expect(units(answers)[0]).toEqual({ naeringskode: '71.110', konkurs: 'false', underAvvikling: 'false', size: '20', page: '0', kommunenummer: '4601' });
  });

  it('a municipality number, or codes already resolved, need no list', async () => {
    for (const given of [find('4601'), find('Bergen', '71.110', ['4601'])]) {
      const answers = norway();
      await make(answers).findCompanies!(given);
      expect(answers.asked.map((one) => one.url.pathname)).toEqual(['/enhetsregisteret/api/enheter']);
      expect(units(answers)[0]?.['kommunenummer']).toBe('4601');
    }
  });

  it('sends the start of a code as it is: the register finds by prefix', async () => {
    const answers = norway();
    await make(answers).findCompanies!(find('4601', '71.11'));
    expect(units(answers)[0]?.['naeringskode']).toBe('71.11');
  });

  it('a town the register does not list finds nothing, and asks nothing more', async () => {
    const answers = norway();
    expect(await make(answers).findCompanies!(find('Atlantis'))).toEqual({ ok: true, companies: [], next: null, total: 0 });
    expect(units(answers)).toEqual([]);
  });

  it('refuses what is not an SN2025 code', async () => {
    expect(await make().findCompanies!(find('Bergen', 'architects'))).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
  });

  it('pages from 0 and stops at the register’s reach of 10 000', async () => {
    const many = failing(923456700, 45, passesMod11).map((organisasjonsnummer) => noUnit({ organisasjonsnummer }));
    expect(await make(norway(many)).findCompanies!(find('4601'))).toMatchObject({ ok: true, next: '1', total: 45 });
    expect(await make(norway(many)).findCompanies!({ ...find('4601'), page: { cursor: '2', size: 20 } })).toMatchObject({ ok: true, next: null });
    expect(await make(norway(many)).findCompanies!({ ...find('4601'), page: { cursor: '499', size: 20 } })).toMatchObject({ ok: true, next: null });
    expect(await make(norway(many)).findCompanies!({ ...find('4601'), page: { cursor: '500', size: 20 } })).toEqual({ ok: true, companies: [], next: null });
  });
});

describe('Norway: a unit, mapped', () => {
  it('number, name, the business address, the website as https, the switchboard, the activity in the register’s words', async () => {
    const found = await make().findCompanies!(find('4601'));
    if (!found.ok) throw new Error('refused');
    expect(found.companies[0]).toEqual({
      ref: '923456781',
      name: 'FJORDLYS ARKITEKTER AS',
      number: '923456781',
      natural: false,
      noMarketing: false,
      sourceUrl: 'https://virksomhet.brreg.no/nb/oppslag/enheter/923456781',
      address: { lines: 'Lysverkgata 5', town: 'BERGEN', postalCode: '5003', country: 'NO' },
      website: 'https://www.fjordlys.example',
      phone: '55 00 00 00',
      activity: { code: '71.110', label: 'Arkitektvirksomhet' },
    });
    // Never the mobile, never the e-mail address.
    expect(JSON.stringify(found)).not.toContain('400 00 000');
    expect(JSON.stringify(found)).not.toContain('post@');
  });

  it('a sole proprietorship (ENK) is a natural person; a limited company is not', async () => {
    const found = await make(norway([noUnit({ organisasjonsform: { kode: 'ENK', beskrivelse: 'Enkeltpersonforetak' } })])).findCompanies!(find('4601'));
    expect(found.ok && found.companies[0]?.natural).toBe(true);
    expect(isSoleProprietorship(NO_UNIT)).toBe(false);
    expect(isSoleProprietorship(noUnit({ organisasjonsform: { kode: 'enk' } }))).toBe(true);
  });

  it('a deleted unit is left out', async () => {
    const found = await make(norway([noUnit({ slettedato: '2024-01-01' })])).findCompanies!(find('4601'));
    expect(found.ok && found.companies).toEqual([]);
  });

  it('a fill by organisation number reads the one unit; one removed for legal reasons gives nothing', async () => {
    const answers = norway();
    const found = await make(answers).fillCompany!({ number: '923 456 781' });
    expect(found.ok && found.companies.map((company) => company.number)).toEqual(['923456781']);
    expect(answers.asked[0]?.url.pathname).toBe('/enhetsregisteret/api/enheter/923456781');
    expect(await make().fillCompany!({ number: '916357208' })).toEqual({ ok: true, companies: [], next: null });
  });

  it('a fill by name looks in the municipality of the town it is given', async () => {
    const answers = norway();
    await make(answers).fillCompany!({ name: 'Fjordlys', town: 'Bergen' });
    expect(units(answers)[0]).toEqual({ navn: 'Fjordlys', size: '10', kommunenummer: '4601' });
  });
});

describe('Norway: refusals', () => {
  it('the register down is UNAVAILABLE; a 429 is RATE_LIMITED', async () => {
    expect(await make(norway(undefined, () => reply(500))).checkKey()).toMatchObject({ ok: false, code: 'UNAVAILABLE' });
    expect(await make(norway(undefined, () => reply(429, {}, { 'retry-after': '5' }))).findCompanies!(find('4601'))).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 5 });
  });
});
