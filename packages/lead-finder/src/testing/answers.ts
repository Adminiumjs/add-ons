/**
 * THE SERVICES' ANSWERS, WRITTEN BY HAND in the shapes their documentation
 * gives (each adapter's header cites the page), about made-up companies and
 * people only: numbers that fail their registers' check digits (UK `98…`,
 * a SIREN that fails Luhn, a Norwegian number that fails mod-11), `.example`
 * sites and addresses, made-up streets.
 *
 * Each answer also carries what the adapter must NOT take (an officer's birth
 * date and nationality, a mobile number, a generic address), so a test can
 * prove it was left behind.
 */
import { KEYS, reply, service, type Route } from './service.ts';

// ─── Companies House ────────────────────────────────────────────────────────

const office = (premises: string, line1: string, locality: string, postal: string, country = 'England') => ({ premises, address_line_1: line1, locality, region: 'West Yorkshire', postal_code: postal, country });

export const CH_COMPANIES = [
  { company_name: 'KESTREL YARD ARCHITECTS LTD', company_number: '98000412', company_status: 'active', company_type: 'ltd', date_of_creation: '2016-03-01', kind: 'search-results#company', registered_office_address: office('Unit 4', 'Calder Wharf Lane', 'Leeds', 'LS1 0ZZ'), sic_codes: ['71111', '74100'] },
  { company_name: 'MILLBECK DRAWING OFFICE LIMITED', company_number: '98001537', company_status: 'active', company_type: 'ltd', date_of_creation: '2019-07-15', kind: 'search-results#company', registered_office_address: office('22', 'Fennel Row', 'Leeds', 'LS2 0ZZ', 'Wales'), sic_codes: ['71111'] },
  { company_name: 'TANNERY ROW DESIGN LIMITED', company_number: '98003391', company_status: 'active', company_type: 'ltd', date_of_creation: '2021-01-04', kind: 'search-results#company', registered_office_address: office('7', 'Tannery Row', 'Leeds', 'LS3 0ZZ', 'Not specified'), sic_codes: ['71111'] },
];

export const CH_PROFILE = {
  company_name: 'KESTREL YARD ARCHITECTS LTD',
  company_number: '98000412',
  company_status: 'active',
  type: 'ltd',
  can_file: true,
  links: { self: '/company/98000412' },
  date_of_creation: '2016-03-01',
  registered_office_address: office('Unit 4', 'Calder Wharf Lane', 'Leeds', 'LS1 0ZZ'),
  sic_codes: ['71111'],
};

export const CH_OFFICERS = {
  kind: 'officer-list',
  active_count: 1,
  resigned_count: 1,
  total_results: 2,
  items_per_page: 50,
  start_index: 0,
  etag: 'e',
  links: { self: '/company/98000412/officers' },
  items: [
    { name: 'HALE, Robin', officer_role: 'director', appointed_on: '2016-03-01', date_of_birth: { month: 4, year: 1980 }, nationality: 'British', occupation: 'Surveyor', country_of_residence: 'England', address: { address_line_1: '1 Home Close', locality: 'Leeds' }, links: { self: '/x', officer: { appointments: '/y' } } },
    { name: 'ELLERY, Sam', officer_role: 'secretary', appointed_on: '2016-03-01', resigned_on: '2020-01-01', links: { self: '/x', officer: { appointments: '/y' } } },
  ],
};

/** Companies House, as its specification answers. Basic auth with the accepted key, else 401. */
export function companiesHouse(extra?: Route) {
  return service((url, headers) => {
    const custom = extra?.(url, headers);
    if (custom !== undefined) return custom;
    if (headers['authorization'] !== `Basic ${btoa(`${KEYS.companiesHouse}:`)}`) return reply(401, { error: 'Invalid Authorization' });
    if (url.pathname === '/search/companies') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const items = CH_COMPANIES.filter((company) => q === 'company' || company.company_name.toLowerCase().includes(q)).map(({ company_name, registered_office_address, sic_codes: _sic, ...rest }) => ({ ...rest, title: company_name, address: registered_office_address, description: `${rest.company_number} - Incorporated on 1 March 2016` }));
      return reply(200, { kind: 'search#companies', items: items.slice(0, Number(url.searchParams.get('items_per_page') ?? 20)), total_results: items.length, start_index: 0, items_per_page: 20 });
    }
    if (url.pathname === '/advanced-search/companies') {
      const codes = (url.searchParams.get('sic_codes') ?? '').split(',');
      const place = (url.searchParams.get('location') ?? '').toLowerCase();
      const matching = CH_COMPANIES.filter((company) => company.sic_codes.some((code) => codes.includes(code)) && (place === '' || company.registered_office_address.locality.toLowerCase() === place));
      if (matching.length === 0) return reply(404, { errors: [{ error: 'no-companies-found' }] });
      const start = Number(url.searchParams.get('start_index') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      return reply(200, { etag: 'e', kind: 'search#advanced-search', top_hit: matching[0], items: matching.slice(start, start + size), hits: String(matching.length) });
    }
    if (url.pathname === '/company/98000412') return reply(200, CH_PROFILE);
    if (url.pathname === '/company/98000412/officers') return reply(200, CH_OFFICERS);
    return undefined;
  });
}

// ─── France ─────────────────────────────────────────────────────────────────

export const FR_UNIT = {
  siren: '412345678',
  nom_complet: 'ATELIER SAONE CLAIR',
  nom_raison_sociale: null,
  nature_juridique: '5499',
  activite_principale: '71.11Z',
  statut_diffusion: 'O',
  opposition_diffusion_commerciale: false,
  etat_administratif: 'A',
  siege: { numero_voie: '9', type_voie: 'RUE', libelle_voie: 'DES TISSERANDS', code_postal: '69001', commune: '69381', libelle_commune: 'LYON', est_siege: true, siret: '41234567800012' },
  complements: { est_entrepreneur_individuel: false },
  dirigeants: [
    { nom: 'VASSEUR', prenoms: 'Claire', annee_de_naissance: '1984', date_de_naissance: '1984-05', qualite: 'Gérant', nationalite: 'Française', type_dirigeant: 'personne physique' },
    { siren: '512378901', denomination: 'HOLDING DES CANUTS', qualite: 'Associé', type_dirigeant: 'personne morale' },
  ],
};

/** A copy of the unit with some fields changed: a sole trader, a unit that objected, one partly public. */
export function frUnit(changes: Record<string, unknown>): Record<string, unknown> {
  return { ...FR_UNIT, ...changes };
}

/** The Register of France and the town service, as their documentation answers. */
export function france(units: readonly Record<string, unknown>[] = [FR_UNIT], extra?: Route) {
  return service((url, headers) => {
    const custom = extra?.(url, headers);
    if (custom !== undefined) return custom;
    if (url.hostname === 'geo.api.gouv.fr' && url.pathname === '/communes') {
      const name = (url.searchParams.get('nom') ?? '').toLowerCase();
      if (name === 'lyon') return reply(200, [{ nom: 'Lyon', code: '69123' }, { nom: 'Lyons-la-Forêt', code: '27377' }]);
      if (name === 'villeurbanne') return reply(200, [{ nom: 'Villeurbanne', code: '69266' }]);
      return reply(200, []);
    }
    if (url.hostname === 'recherche-entreprises.api.gouv.fr' && url.pathname === '/search') {
      const page = Number(url.searchParams.get('page') ?? 1);
      const perPage = Number(url.searchParams.get('per_page') ?? 10);
      const pages = Math.max(1, Math.ceil(units.length / perPage));
      return reply(200, { results: units.slice((page - 1) * perPage, page * perPage), total_results: units.length, page, per_page: perPage, total_pages: pages });
    }
    return undefined;
  });
}

// ─── Norway ─────────────────────────────────────────────────────────────────

export const NO_UNIT = {
  organisasjonsnummer: '923456781',
  navn: 'FJORDLYS ARKITEKTER AS',
  organisasjonsform: { kode: 'AS', beskrivelse: 'Aksjeselskap' },
  naeringskode1: { kode: '71.110', beskrivelse: 'Arkitektvirksomhet' },
  forretningsadresse: { land: 'Norge', landkode: 'NO', postnummer: '5003', poststed: 'BERGEN', adresse: ['Lysverkgata 5'], kommune: 'BERGEN', kommunenummer: '4601' },
  hjemmeside: 'www.fjordlys.example',
  telefon: '55 00 00 00',
  mobil: '400 00 000',
  epostadresse: 'post@fjordlys.example',
  konkurs: false,
  underAvvikling: false,
  _links: { self: { href: 'https://data.brreg.no/enhetsregisteret/api/enheter/923456781' } },
};

/** A copy of the unit with some fields changed. */
export function noUnit(changes: Record<string, unknown>): Record<string, unknown> {
  return { ...NO_UNIT, ...changes };
}

/** The Register of Norway, as its documentation answers. */
export function norway(units: readonly Record<string, unknown>[] = [NO_UNIT], extra?: Route) {
  return service((url, headers) => {
    const custom = extra?.(url, headers);
    if (custom !== undefined) return custom;
    if (url.pathname === '/enhetsregisteret/api/kommuner') return reply(200, { _embedded: { kommuner: [{ nummer: '0301', navn: 'OSLO' }, { nummer: '4601', navn: 'BERGEN' }] }, page: { size: 1000, totalElements: 2, totalPages: 1, number: 0 } });
    if (url.pathname === '/enhetsregisteret/api/enheter') {
      const size = Number(url.searchParams.get('size') ?? 20);
      const page = Number(url.searchParams.get('page') ?? 0);
      return reply(200, { _embedded: { enheter: units.slice(page * size, (page + 1) * size) }, page: { size, totalElements: units.length, totalPages: Math.ceil(units.length / size), number: page } });
    }
    if (url.pathname === '/enhetsregisteret/api/enheter/923456781') return reply(200, units[0]);
    if (url.pathname === '/enhetsregisteret/api/enheter/916357208') return reply(410, { feilmelding: 'Fjernet av juridiske årsaker' });
    return undefined;
  });
}

// ─── OpenCorporates ─────────────────────────────────────────────────────────

export const OC_COMPANY = {
  name: 'OUSEBURN STUDIO LIMITED',
  company_number: '98002264',
  jurisdiction_code: 'gb',
  incorporation_date: '2018-09-12',
  current_status: 'Active',
  company_type: 'Private Limited Company',
  registered_address: { street_address: '3 Lime Kiln Court', locality: 'Newcastle upon Tyne', region: 'Tyne and Wear', postal_code: 'NE1 0ZZ', country: 'United Kingdom' },
  registered_address_in_full: '3 Lime Kiln Court, Newcastle upon Tyne, NE1 0ZZ',
  industry_codes: [{ industry_code: { code: '71.11', description: 'Architectural activities', code_scheme_id: 'eu_nace_2' } }],
  officers: [
    { officer: { id: 1, name: 'JO ASHBY', position: 'director', start_date: '2018-09-12', end_date: null, opencorporates_url: 'https://opencorporates.com/officers/1' } },
    { officer: { id: 2, name: 'KARI VIK', position: 'secretary', start_date: '2018-09-12', end_date: '2020-02-02' } },
  ],
  restricted_for_marketing: null,
  opencorporates_url: 'https://opencorporates.com/companies/gb/98002264',
};

/** OpenCorporates, as its reference answers; `api_token` must be the accepted key, else 401. */
export function openCorporates(companies: readonly Record<string, unknown>[] = [OC_COMPANY], extra?: Route) {
  return service((url, headers) => {
    const custom = extra?.(url, headers);
    if (custom !== undefined) return custom;
    if (url.searchParams.get('api_token') !== KEYS.openCorporates) return reply(401, { error: { message: 'Invalid Api Token' } });
    if (url.pathname === '/v0.4/account_status') return reply(200, { api_version: '0.4', results: { account_status: { status: 'approved', usage: { today: 1, this_month: 1 }, calls_remaining: { today: 49, this_month: 199 } } } });
    if (url.pathname === '/v0.4/companies/search') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const found = companies.filter((company) => String(company['name']).toLowerCase().includes(q));
      return reply(200, { api_version: '0.4', results: { companies: found.map((company) => ({ company })), page: 1, per_page: 20, total_pages: 1, total_count: found.length } });
    }
    const one = /^\/v0\.4\/companies\/([a-z_]+)\/([^/]+)$/.exec(url.pathname);
    if (one !== null) {
      const company = companies.find((candidate) => candidate['jurisdiction_code'] === one[1] && candidate['company_number'] === one[2]);
      return company === undefined ? reply(404, { error: { message: 'Company not found' } }) : reply(200, { api_version: '0.4', results: { company } });
    }
    return undefined;
  });
}

// ─── Hunter ─────────────────────────────────────────────────────────────────

const seen = (uri: string) => ({ domain: 'kestrelyard.example', uri, extracted_on: '2026-07-01', last_seen_on: '2026-07-20', still_on_page: true });

export const HUNTER_EMAILS = [
  { value: 'robin@kestrelyard.example', type: 'personal', confidence: 94, sources: [seen('https://kestrelyard.example/team'), seen('http://kestrelyard.example/old-team'), seen('https://kestrelyard.example/team')], first_name: 'Robin', last_name: 'Hale', position: 'Director', seniority: 'executive', department: 'management', linkedin: null, twitter: null, phone_number: '07700 900412', verification: { date: '2026-07-20', status: 'valid' } },
  { value: 'sam@kestrelyard.example', type: 'personal', confidence: 88, sources: Array.from({ length: 25 }, (_, i) => seen(`https://kestrelyard.example/projects/${String(i)}`)), first_name: 'Sam', last_name: 'Ellery', position: null, seniority: null, department: null, phone_number: null, verification: null },
  // No name: not a person the add-on may keep.
  { value: 'drawings@kestrelyard.example', type: 'personal', confidence: 60, sources: [], first_name: null, last_name: null, position: null },
  // A generic address: a company's, never a person's.
  { value: 'info@kestrelyard.example', type: 'generic', confidence: 99, sources: [seen('https://kestrelyard.example/contact')], first_name: null, last_name: null, position: null },
];

/** Hunter, as its reference answers; the `X-API-KEY` header must be the accepted key, else 401. */
export function hunter(emails: readonly Record<string, unknown>[] = HUNTER_EMAILS, extra?: Route) {
  return service((url, headers) => {
    const custom = extra?.(url, headers);
    if (custom !== undefined) return custom;
    if (headers['x-api-key'] !== KEYS.hunter) return reply(401, { errors: [{ id: 'authentication_failed', code: 401, details: 'No user found for the API key supplied' }] });
    if (url.pathname === '/v2/account') return reply(200, { data: { first_name: 'Dana', last_name: 'Whitlock', email: 'dana@meridian.example', reset_date: '2026-12-01', team_id: 1, requests: { searches: { used: 3, available: 50 } } } });
    if (url.pathname === '/v2/domain-search') {
      return reply(200, { data: { domain: url.searchParams.get('domain'), disposable: false, webmail: false, accept_all: false, pattern: '{first}', organization: 'Kestrel Yard Architects', emails }, meta: { results: emails.length, limit: 50, offset: 0, params: {} } });
    }
    return undefined;
  });
}
