/**
 * THE REGISTER OF FRANCE, MAPPED: the place a search asks by, the flags it
 * honours, the natural person it marks, and the directors it never copies
 * more than a name and a role of.
 */
import { describe, expect, it } from 'vitest';

import { france, frUnit, FR_UNIT } from '../testing/answers.ts';
import { failing, passesLuhn } from '../testing/check-digits.ts';
import { contextFor, reply } from '../testing/service.ts';
import { ARRONDISSEMENTS, filedUnder } from './france-places.ts';
import { isNaturalPerson, refusesMarketing } from './france.ts';
import { createLeadSource } from './index.ts';

const make = (answers = france(), locale = 'fr-FR') => createLeadSource(contextFor('france', null, answers.http, undefined, locale));
const find = (place: string, codes?: string[]) => ({ activity: '71.11Z', place: { text: place, country: 'FR', ...(codes === undefined ? {} : { codes }) }, page: { cursor: null, size: 10 } });
const searched = (answers: ReturnType<typeof france>) => answers.asked.filter((one) => one.url.hostname === 'recherche-entreprises.api.gouv.fr').map((one) => Object.fromEntries(one.url.searchParams));

describe('France: where a search looks', () => {
  it('Lyon is its nine arrondissements, found through the town service', async () => {
    const answers = france();
    await make(answers).findCompanies!(find('Lyon'));
    expect(answers.asked[0]?.url.href).toBe('https://geo.api.gouv.fr/communes?nom=Lyon&fields=nom%2Ccode&boost=population');
    expect(searched(answers)[0]).toMatchObject({ activite_principale: '71.11Z', code_commune: '69381,69382,69383,69384,69385,69386,69387,69388,69389', etat_administratif: 'A', page: '1', per_page: '10', minimal: 'true', include: 'siege,complements' });
  });

  it('Paris and Marseille are their arrondissements too', () => {
    expect(filedUnder('75056')).toHaveLength(20);
    expect(filedUnder('75056')[0]).toBe('75101');
    expect(filedUnder('13055').at(-1)).toBe('13216');
    expect(Object.keys(ARRONDISSEMENTS).sort()).toEqual(['13055', '69123', '75056']);
  });

  it('a town of one commune is its own code', async () => {
    const answers = france();
    await make(answers).findCompanies!(find('Villeurbanne'));
    expect(searched(answers)[0]?.['code_commune']).toBe('69266');
  });

  it('a postcode, a département and codes already resolved are asked as they are, with no town look-up', async () => {
    for (const [given, want] of [
      [find('69002'), { code_postal: '69002' }],
      [find('69'), { departement: '69' }],
      [find('2a'), { departement: '2A' }],
      [find('Lyon', ['69123', '69266']), { code_commune: '69381,69382,69383,69384,69385,69386,69387,69388,69389,69266' }],
    ] as const) {
      const answers = france();
      await make(answers).findCompanies!(given);
      expect(answers.asked.every((one) => one.url.hostname === 'recherche-entreprises.api.gouv.fr')).toBe(true);
      expect(searched(answers)[0]).toMatchObject(want);
    }
  });

  it('a town France does not know finds nothing, and asks the register nothing', async () => {
    const answers = france();
    expect(await make(answers).findCompanies!(find('Atlantis'))).toEqual({ ok: true, companies: [], next: null, total: 0 });
    expect(searched(answers)).toEqual([]);
  });

  it('names itself to the register with the user agent it is asked for', async () => {
    const answers = france();
    await make(answers).findCompanies!(find('69002'));
    expect(answers.asked[0]?.headers['user-agent']).toBe('Adminium-LeadFinder/1 (+https://adminium.dev/lead-finder)');
  });

  it('pages 25 at most, by the page number it gave', async () => {
    const many = failing(412345600, 30, passesLuhn).map((siren, i) => frUnit({ siren, nom_complet: `ATELIER ${String(i)}` }));
    const first = await make(france(many)).findCompanies!({ ...find('69002'), page: { cursor: null, size: 50 } });
    expect(first).toMatchObject({ ok: true, next: '2', total: 30 });
    if (first.ok) expect(first.companies).toHaveLength(25);
    const second = await make(france(many)).findCompanies!({ ...find('69002'), page: { cursor: '2', size: 50 } });
    expect(second).toMatchObject({ ok: true, next: null });
  });
});

describe('France: a unit, mapped', () => {
  it('number, name, head office, the NAF code with its French label, the directory page', async () => {
    const found = await make().findCompanies!(find('69002'));
    if (!found.ok) throw new Error('refused');
    expect(found.companies[0]).toEqual({
      ref: '412345678',
      name: 'ATELIER SAONE CLAIR',
      number: '412345678',
      natural: false,
      noMarketing: false,
      sourceUrl: 'https://annuaire-entreprises.data.gouv.fr/entreprise/412345678',
      address: { lines: '9 RUE DES TISSERANDS', town: 'LYON', postalCode: '69001', country: 'FR' },
      activity: { code: '71.11Z', label: "Activités d'architecture" },
    });
  });

  it('a fill by SIREN (or SIRET) takes the directors, a name and a role each: never a birth year or a nationality', async () => {
    const answers = france();
    const found = await make(answers).fillCompany!({ number: '412 345 678 00012', country: 'FR' });
    if (!found.ok) throw new Error('refused');
    expect(found.companies[0]?.officers).toEqual([
      { name: 'Claire VASSEUR', role: 'Gérant' },
      { name: 'HOLDING DES CANUTS', role: 'Associé' },
    ]);
    const text = JSON.stringify(found);
    for (const never of ['1984', 'Française', 'nationalite']) expect(text).not.toContain(never);
    expect(searched(answers)[0]).toMatchObject({ q: '412345678', include: 'siege,complements,dirigeants' });
  });

  it('a fill by name looks in the town it is given', async () => {
    const answers = france();
    const found = await make(answers).fillCompany!({ name: 'Atelier Saône Clair', town: 'Villeurbanne' });
    expect(found.ok && found.companies).toHaveLength(1);
    expect(searched(answers)[0]).toMatchObject({ q: 'Atelier Saône Clair', code_commune: '69266' });
  });

  it('a SIREN of the wrong length is refused before anything is asked', async () => {
    const answers = france();
    expect(await make(answers).fillCompany!({ number: '4123' })).toMatchObject({ ok: false, code: 'INVALID_REQUEST' });
    expect(answers.asked).toEqual([]);
  });
});

describe('France: the flags it honours', () => {
  const one = async (changes: Record<string, unknown>) => {
    const found = await make(france([frUnit(changes)])).findCompanies!(find('69002'));
    if (!found.ok) throw new Error('refused');
    return found.companies[0]!;
  };

  it('a unit that objected to sales use is noMarketing', async () => {
    expect((await one({ opposition_diffusion_commerciale: true })).noMarketing).toBe(true);
  });

  it('a unit only partly public (statut_diffusion P) is noMarketing', async () => {
    expect((await one({ statut_diffusion: 'P' })).noMarketing).toBe(true);
    expect((await one({ statut_diffusion: 'O' })).noMarketing).toBe(false);
  });

  it('a sole trader by legal category 1000 is a natural person', async () => {
    expect((await one({ nature_juridique: '1000' })).natural).toBe(true);
  });

  it('a sole trader by the register’s own mark is a natural person', async () => {
    expect((await one({ complements: { est_entrepreneur_individuel: true } })).natural).toBe(true);
  });

  it('a company is neither', async () => {
    expect(await one({})).toMatchObject({ natural: false, noMarketing: false });
    expect(isNaturalPerson(FR_UNIT)).toBe(false);
    expect(refusesMarketing(FR_UNIT)).toBe(false);
  });
});

describe('France: refusals', () => {
  it('a 429 is RATE_LIMITED with its Retry-After, else a second', async () => {
    expect(await make(france(undefined, () => reply(429, {}, { 'Retry-After': '3' }))).findCompanies!(find('69002'))).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 3 });
    expect(await make(france(undefined, () => reply(429))).checkKey()).toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 1 });
  });

  it('the town service down is UNAVAILABLE, said as the town service', async () => {
    const down = france(undefined, (url) => (url.hostname === 'geo.api.gouv.fr' ? reply(503) : undefined));
    expect(await make(down).findCompanies!(find('Lyon'))).toMatchObject({ ok: false, code: 'UNAVAILABLE', message: expect.stringContaining('town service') });
  });

  it('finds nothing outside France', async () => {
    expect(await make().findCompanies!({ ...find('Leeds'), place: { text: 'Leeds', country: 'GB' } })).toEqual({ ok: true, companies: [], next: null, total: 0 });
  });
});
