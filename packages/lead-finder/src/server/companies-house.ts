/**
 * COMPANIES HOUSE (UK): companies by SIC code and place, and one company by
 * its number or its name.
 *
 * Built to the published Public Data API specification; no real key was used
 * to write it:
 *  - https://developer-specs.company-information.service.gov.uk/companies-house-public-data-api/reference/search/advanced-company-search
 *    `GET /advanced-search/companies?sic_codes=&location=&company_status=&size=&start_index=`
 *    answers `{ hits, items[]: { company_name, company_number, company_status,
 *    company_type, date_of_creation, registered_office_address, sic_codes } }`
 *    (`size` 1 to 5000; 404 when nothing matches);
 *  - https://developer-specs.company-information.service.gov.uk/api.ch.gov.uk-specifications/swagger-2.0/spec/companyProfile.json
 *    `GET /company/{number}` (404 when there is none);
 *  - https://developer-specs.company-information.service.gov.uk/api.ch.gov.uk-specifications/swagger-2.0/spec/search.json
 *    `GET /search/companies?q=&items_per_page=` answers `items[]: { title,
 *    company_number, company_status, address }`;
 *  - https://developer-specs.company-information.service.gov.uk/api.ch.gov.uk-specifications/swagger-2.0/spec/companyOfficerList.json
 *    `GET /company/{number}/officers` answers `items[]: { name, officer_role,
 *    resigned_on, … }`: only the name and the role are read, never a birth
 *    date, a nationality or an address;
 *  - https://developer-specs.company-information.service.gov.uk/guides/authorisation:
 *    the key is the user name of HTTP Basic, with an empty password;
 *  - https://developer-specs.company-information.service.gov.uk/guides/rateLimiting:
 *    600 calls in five minutes, then 429 for the rest of the window.
 *
 * Its offices' countries ("England", "Wales", "Scotland", "Northern Ireland",
 * "Great Britain", "United Kingdom") are all `GB`.
 */
import type { CompaniesFound, FillQuery, FindQuery, FoundCompany, LeadSource, LeadSourceContext, LeadSourceError } from '@adminium/add-on-contracts';

import { activityLabel, activityOf, codesStartingWith } from '../activities/index.ts';
import { addressOf, ask, cursorOf, halt, joined, jsonOf, list, plain, record, refusal, retryAfterOf, roleWords, words } from './shared.ts';

export const COMPANIES_HOUSE_HOST = 'api.company-information.service.gov.uk';
const API = `https://${COMPANIES_HOUSE_HOST}`;
/** A company's page on the register's own site: the link a found company's card draws, never fetched. */
const COMPANY_PAGE = 'https://find-and-update.company-information.service.gov.uk/company/';

/** The countries a registered office may name, every one of them the United Kingdom. */
const UK_COUNTRIES = new Set(['england', 'wales', 'scotland', 'northern ireland', 'great britain', 'united kingdom', 'uk']);

/** The most officers a filled company names. */
const OFFICERS_MAX = 50;

/** The key as HTTP Basic: the key is the user name, the password is empty. */
function authorisation(key: string): Record<string, string> {
  return { authorization: `Basic ${btoa(`${key}:`)}` };
}

/** The refusal an answer that is not 200 means. */
function refused(status: number, retryAfter: number | undefined): LeadSourceError {
  if (status === 401) return refusal('KEY_REFUSED', 'Companies House refused this key.');
  if (status === 429) return refusal('RATE_LIMITED', 'Companies House asks us to wait: 600 look-ups in five minutes is its limit.', retryAfter ?? 300);
  if (status === 400) return refusal('INVALID_REQUEST', 'Companies House could not read this search.');
  return refusal('UNAVAILABLE', `Companies House answered ${String(status)}.`);
}

/** A registered office, as the contract keeps an address. */
function officeOf(value: unknown): FoundCompany['address'] {
  const office = record(value);
  const country = typeof office['country'] === 'string' && UK_COUNTRIES.has(office['country'].trim().toLowerCase()) ? 'GB' : undefined;
  // "12" and "Fennel Row" are one line ("12 Fennel Row"); the second line and a PO box follow it.
  const street = [words(office['premises'], 200), words(office['address_line_1'], 300)].filter((part) => part !== undefined).join(' ');
  return addressOf({
    lines: joined([street, office['address_line_2'], office['po_box']], 500),
    town: words(office['locality'], 120),
    region: words(office['region'], 120),
    postalCode: words(office['postal_code'], 20),
    country,
  });
}

/** The first SIC code, with the list's label. */
function activityFrom(codes: unknown, locale: string): FoundCompany['activity'] {
  const first = list(codes).find((code): code is string => typeof code === 'string' && code.trim() !== '');
  if (first === undefined) return undefined;
  const known = activityOf('companies-house', first);
  const label = known === undefined ? undefined : words(activityLabel(known, locale), 300);
  return label === undefined ? { code: first.trim().slice(0, 20) } : { code: first.trim().slice(0, 20), label };
}

/** One company of an answer, in the contract's shape; null when it has no number or no name. */
export function companyFrom(value: unknown, locale: string): FoundCompany | null {
  const item = record(value);
  const number = words(item['company_number'], 40);
  const name = words(item['company_name'] ?? item['title'], 300);
  if (number === undefined || name === undefined) return null;
  const company: FoundCompany = {
    ref: number.slice(0, 100),
    name,
    number,
    // The register keeps companies, partnerships and LLPs, never a sole trader.
    natural: false,
    // The register says nothing of approaches for sales.
    noMarketing: false,
    sourceUrl: `${COMPANY_PAGE}${encodeURIComponent(number)}`,
  };
  const address = officeOf(item['registered_office_address'] ?? item['address']);
  if (address !== undefined) company.address = address;
  const activity = activityFrom(item['sic_codes'], locale);
  if (activity !== undefined) company.activity = activity;
  // A search item's `description` is the register's own line ("98000412 - Incorporated on …"), not what the company is about: left out.
  return company;
}

/** The serving officers of a company: names and roles only. */
async function officersOf(context: LeadSourceContext, key: string, number: string): Promise<FoundCompany['officers']> {
  const response = await ask(context, `${API}/company/${encodeURIComponent(number)}/officers?items_per_page=${String(OFFICERS_MAX)}`, authorisation(key));
  if (response.status !== 200) return undefined;
  const officers = list(record(await jsonOf(response, context.signal))['items'])
    .map(record)
    .filter((officer) => officer['resigned_on'] === undefined || officer['resigned_on'] === null)
    .flatMap((officer) => {
      const name = words(officer['name'], 200);
      if (name === undefined) return [];
      const role = roleWords(officer['officer_role']);
      return [role === undefined ? { name } : { name, role }];
    })
    .slice(0, OFFICERS_MAX);
  return officers.length === 0 ? undefined : officers;
}

/** The register's source, for one call. */
export function createCompaniesHouse(context: LeadSourceContext): LeadSource {
  const { signal, locale } = context;
  const keyOrRefusal = (): string | LeadSourceError => (context.key === null || context.key.trim() === '' ? refusal('KEY_REFUSED', 'Companies House needs a key: none is saved.') : context.key.trim());

  return {
    async checkKey() {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      // The cheapest call the register has: one result of a name search. A bad key is a 401.
      const response = await ask(context, `${API}/search/companies?q=company&items_per_page=1`, authorisation(key));
      return response.status === 200 ? { ok: true } : refused(response.status, retryAfterOf(response));
    },

    async findCompanies(question: FindQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      if (question.place.country.toUpperCase() !== 'GB') return { ok: true, companies: [], next: null, total: 0 };
      const start = cursorOf(question.page.cursor, 0);
      if (start === null) return refusal('INVALID_REQUEST', 'That page of results is not one Companies House gave.');
      const size = Math.max(1, Math.min(50, Math.trunc(question.page.size)));
      // A code or the start of one: the search takes exact codes, so the start becomes every code it begins.
      const exact = activityOf('companies-house', question.activity) === undefined ? codesStartingWith('companies-house', question.activity).slice(0, 50) : [question.activity.trim()];
      if (exact.length === 0) return refusal('INVALID_REQUEST', 'That is not a UK SIC code.');
      const params = new URLSearchParams({ sic_codes: exact.join(','), company_status: 'active', size: String(size), start_index: String(start) });
      const place = question.place.text.trim();
      if (place !== '') params.set('location', place);
      const response = await ask(context, `${API}/advanced-search/companies?${params.toString()}`, authorisation(key));
      if (response.status === 404) return { ok: true, companies: [], next: null, total: 0 };
      if (response.status !== 200) return refused(response.status, retryAfterOf(response));
      const body = record(await jsonOf(response, signal));
      const companies = list(body['items'])
        .map((item) => companyFrom(item, locale))
        .filter((company): company is FoundCompany => company !== null)
        .slice(0, size);
      const hits = Number(body['hits']);
      const total = Number.isInteger(hits) && hits >= 0 ? hits : undefined;
      const more = total === undefined ? companies.length === size : start + size < total;
      return { ok: true, companies, next: more ? String(start + size) : null, ...(total === undefined ? {} : { total }) };
    },

    async fillCompany(question: FillQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      if (question.country !== undefined && question.country.toUpperCase() !== 'GB') return { ok: true, companies: [], next: null };
      const number = question.number?.replace(/\s+/g, '').toUpperCase();
      if (number !== undefined && number !== '') {
        const response = await ask(context, `${API}/company/${encodeURIComponent(number)}`, authorisation(key));
        if (response.status === 404) return { ok: true, companies: [], next: null };
        if (response.status !== 200) return refused(response.status, retryAfterOf(response));
        const company = companyFrom(await jsonOf(response, signal), locale);
        if (company === null) return { ok: true, companies: [], next: null };
        const officers = await officersOf(context, key, company.number ?? number);
        return { ok: true, companies: [officers === undefined ? company : { ...company, officers }], next: null };
      }
      const name = question.name?.trim() ?? '';
      if (name === '') return refusal('INVALID_REQUEST', 'Give a company number, or a name.');
      const response = await ask(context, `${API}/search/companies?${new URLSearchParams({ q: name, items_per_page: '20' }).toString()}`, authorisation(key));
      if (response.status === 404) return { ok: true, companies: [], next: null };
      if (response.status !== 200) return refused(response.status, retryAfterOf(response));
      const wanted = plain(name);
      const found = list(record(await jsonOf(response, signal))['items'])
        .map((item) => companyFrom(item, locale))
        .filter((company): company is FoundCompany => company !== null && plain(company.name).includes(wanted));
      // With a town: the companies in it, when any is; else every company of that name, for the person to choose.
      const town = plain(question.town ?? '');
      const inTown = town === '' ? found : found.filter((company) => plain(company.address?.town ?? '') === town);
      return { ok: true, companies: (inTown.length > 0 ? inTown : found).slice(0, 20), next: null };
    },
  };
}
