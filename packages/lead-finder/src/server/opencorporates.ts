/**
 * OPENCORPORATES: one company's registered details, by its number and
 * country or by its name, with the owner's own key. It fills in; it does not
 * search by activity (whether its API finds companies with no name was never
 * tried with a key, so it stays a fill-in source).
 *
 * https://api.opencorporates.com/documentation/API-Reference (v0.4):
 *  - `GET /v0.4/companies/{jurisdiction_code}/{company_number}` answers
 *    `results.company`: `name`, `company_number`, `jurisdiction_code`,
 *    `current_status`, `registered_address { street_address, locality,
 *    region, postal_code, country }`, `registered_address_in_full`,
 *    `industry_codes[].industry_code { code, description }`, `officers[].officer
 *    { name, position, end_date }`, `opencorporates_url`;
 *  - `GET /v0.4/companies/search?q=&country_code=&per_page=` answers
 *    `results.companies[].company`;
 *  - `GET /v0.4/account_status` says whether the key is good, and spends no look-up;
 *  - the key is sent as `api_token`, the only way the reference gives; a bad
 *    key is a 401, and 403 is what it answers while it limits a caller's rate.
 * https://knowledge.opencorporates.com/knowledge-base/data-dictionary-companies/:
 *  `restricted_for_marketing` is text, set when the register says the
 *  company's details may not be used for marketing: any value but an empty
 *  or a "no" one makes the company `noMarketing`.
 *
 * A jurisdiction is the country's code (`gb`, `fr`) or a part of one
 * (`us_de`): the found company's country is its first two letters.
 */
import type { CompaniesFound, FillQuery, FoundCompany, LeadSource, LeadSourceContext, LeadSourceError } from '@adminium/add-on-contracts';

import { addressOf, ask, halt, httpsLink, jsonOf, list, plain, record, refusal, retryAfterOf, roleWords, words } from './shared.ts';

export const OPENCORPORATES_HOST = 'api.opencorporates.com';
const API = `https://${OPENCORPORATES_HOST}/v0.4`;

function refused(status: number, retryAfter: number | undefined): LeadSourceError {
  if (status === 401) return refusal('KEY_REFUSED', 'OpenCorporates refused this key.');
  if (status === 403 || status === 429) return refusal('RATE_LIMITED', 'OpenCorporates asks us to wait, or this key has no look-ups left today.', retryAfter ?? 3600);
  if (status === 400) return refusal('INVALID_REQUEST', 'OpenCorporates could not read this search.');
  return refusal('UNAVAILABLE', `OpenCorporates answered ${String(status)}.`);
}

/** Whether a company may not be approached for marketing: the field set to anything but a no. */
export function restrictedForMarketing(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value !== 'string') return false;
  const text = value.trim().toLowerCase();
  return text !== '' && !['false', 'no', 'n', '0', 'none'].includes(text);
}

/** One company of an answer, in the contract's shape; null when it has no number, name or jurisdiction. */
export function companyFrom(value: unknown): FoundCompany | null {
  const item = record(value);
  const number = words(item['company_number'], 40);
  const name = words(item['name'], 300);
  const jurisdiction = words(item['jurisdiction_code'], 20)?.toLowerCase();
  if (number === undefined || name === undefined || jurisdiction === undefined || !/^[a-z]{2}(_[a-z0-9]+)?$/.test(jurisdiction)) return null;
  const company: FoundCompany = {
    ref: `${jurisdiction}/${number}`.slice(0, 100),
    name,
    number,
    natural: false,
    noMarketing: restrictedForMarketing(item['restricted_for_marketing']),
  };
  const office = record(item['registered_address']);
  const address = addressOf({
    lines: words(office['street_address'], 500) ?? words(item['registered_address_in_full'], 500),
    town: words(office['locality'], 120),
    region: words(office['region'], 120),
    postalCode: words(office['postal_code'], 20),
    country: jurisdiction.slice(0, 2),
  });
  if (address !== undefined) company.address = address;
  const industry = record(record(list(item['industry_codes'])[0])['industry_code']);
  const code = words(industry['code'], 20);
  if (code !== undefined) {
    const label = words(industry['description'], 300);
    company.activity = label === undefined ? { code } : { code, label };
  }
  const officers = list(item['officers'])
    .map((entry) => record(record(entry)['officer']))
    .filter((officer) => (officer['end_date'] === undefined || officer['end_date'] === null) && officer['inactive'] !== true)
    .flatMap((officer) => {
      const who = words(officer['name'], 200);
      if (who === undefined) return [];
      const role = roleWords(officer['position']);
      return [role === undefined ? { name: who } : { name: who, role }];
    })
    .slice(0, 50);
  if (officers.length > 0) company.officers = officers;
  const link = httpsLink(item['opencorporates_url']);
  if (link !== undefined) company.sourceUrl = link;
  return company;
}

/** The service's source, for one call. */
export function createOpenCorporates(context: LeadSourceContext): LeadSource {
  const { signal } = context;
  const keyOrRefusal = (): string | LeadSourceError => (context.key === null || context.key.trim() === '' ? refusal('KEY_REFUSED', 'OpenCorporates needs a key: none is saved.') : context.key.trim());

  return {
    async checkKey() {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      const response = await ask(context, `${API}/account_status?${new URLSearchParams({ api_token: key }).toString()}`);
      return response.status === 200 ? { ok: true } : refused(response.status, retryAfterOf(response));
    },

    async fillCompany(question: FillQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      const country = question.country?.trim().toLowerCase();
      if (country !== undefined && country !== '' && !/^[a-z]{2}$/.test(country)) return refusal('INVALID_REQUEST', 'A country is its two-letter code.');
      const number = question.number?.replace(/\s+/g, '') ?? '';
      if (number !== '') {
        if (country === undefined || country === '') return refusal('INVALID_REQUEST', 'OpenCorporates finds a company by its number in one country: give the country.');
        const response = await ask(context, `${API}/companies/${encodeURIComponent(country)}/${encodeURIComponent(number)}?${new URLSearchParams({ api_token: key }).toString()}`);
        if (response.status === 404) return { ok: true, companies: [], next: null };
        if (response.status !== 200) return refused(response.status, retryAfterOf(response));
        const company = companyFrom(record(record(await jsonOf(response, signal))['results'])['company']);
        return { ok: true, companies: company === null ? [] : [company], next: null };
      }
      const name = question.name?.trim() ?? '';
      if (name === '') return refusal('INVALID_REQUEST', 'Give a company number and country, or a name.');
      const params = new URLSearchParams({ q: name, per_page: '20', api_token: key });
      if (country !== undefined && country !== '') params.set('country_code', country);
      const response = await ask(context, `${API}/companies/search?${params.toString()}`);
      if (response.status !== 200) return refused(response.status, retryAfterOf(response));
      const found = list(record(record(await jsonOf(response, signal))['results'])['companies'])
        .map((entry) => companyFrom(record(entry)['company']))
        .filter((company): company is FoundCompany => company !== null);
      const town = plain(question.town ?? '');
      const inTown = town === '' ? found : found.filter((company) => plain(company.address?.town ?? '') === town);
      return { ok: true, companies: (inTown.length > 0 ? inTown : found).slice(0, 20), next: null };
    },
  };
}
