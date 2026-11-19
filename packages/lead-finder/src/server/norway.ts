/**
 * THE REGISTER OF NORWAY (Enhetsregisteret, Brønnøysundregistrene): units by
 * SN2025 code and municipality, and one unit by its organisation number or
 * its name. No key.
 *
 * https://data.brreg.no/enhetsregisteret/api/dokumentasjon/no/index.html
 *  - `GET /enhetsregisteret/api/enheter` with `naeringskode` (a code or the
 *    start of one), `kommunenummer`, `navn`, `organisasjonsnummer`,
 *    `konkurs`, `underAvvikling`, `size` (20 by default) and `page` (from 0;
 *    `(page + 1) * size` may not pass 10 000). It answers
 *    `{ _embedded: { enheter[] }, page: { size, totalElements, totalPages,
 *    number } }`; a unit carries `organisasjonsnummer`, `navn`,
 *    `organisasjonsform { kode }`, `naeringskode1 { kode, beskrivelse }`,
 *    `forretningsadresse` and `postadresse` (`adresse[]`, `postnummer`,
 *    `poststed`, `landkode`), `hjemmeside`, `telefon`, `mobil`.
 *  - `GET /enhetsregisteret/api/enheter/{organisasjonsnummer}`: one unit; 404
 *    when there is none, 410 when it was removed for legal reasons.
 *  - `GET /enhetsregisteret/api/kommuner`: the register's own municipalities,
 *    `_embedded.kommuner[]: { nummer, navn }`, so a typed town needs nothing
 *    but this host.
 *
 * A sole proprietorship (`organisasjonsform.kode` "ENK") is a natural person.
 * A mobile number (`mobil`) is never taken: only the switchboard (`telefon`).
 */
import type { CompaniesFound, FillQuery, FindQuery, FoundCompany, LeadSource, LeadSourceContext, LeadSourceError } from '@adminium/add-on-contracts';

import { addressOf, ask, cursorOf, halt, httpsSite, isRefusal, joined, jsonOf, list, plain, record, refusal, retryAfterOf, words } from './shared.ts';

export const NORWAY_HOST = 'data.brreg.no';
const API = `https://${NORWAY_HOST}/enhetsregisteret/api`;
/** A unit's page in the register's own search: the link a found company's card draws, never fetched. */
const UNIT_PAGE = 'https://virksomhet.brreg.no/nb/oppslag/enheter/';
/** The most results one search may reach into, as the register says. */
const REACH = 10_000;
/** The legal form of a sole proprietorship. */
const SOLE_PROPRIETORSHIP = 'ENK';

function refused(status: number, retryAfter: number | undefined): LeadSourceError {
  if (status === 429) return refusal('RATE_LIMITED', 'The Register of Norway asks us to wait.', retryAfter ?? 60);
  if (status === 400) return refusal('INVALID_REQUEST', 'The Register of Norway could not read this search.');
  return refusal('UNAVAILABLE', `The Register of Norway answered ${String(status)}.`);
}

/** Whether a unit is a natural person: a sole proprietorship. */
export function isSoleProprietorship(unit: Record<string, unknown>): boolean {
  return String(record(unit['organisasjonsform'])['kode'] ?? '').trim().toUpperCase() === SOLE_PROPRIETORSHIP;
}

/** One unit of an answer, in the contract's shape; null when it has no number, no name, or was deleted. */
export function unitFrom(value: unknown): FoundCompany | null {
  const unit = record(value);
  const number = words(unit['organisasjonsnummer'], 40);
  const name = words(unit['navn'], 300);
  if (number === undefined || name === undefined || unit['slettedato'] !== undefined) return null;
  const company: FoundCompany = {
    ref: number,
    name,
    number,
    natural: isSoleProprietorship(unit),
    // The register keeps no mark against approaches for sales.
    noMarketing: false,
    sourceUrl: `${UNIT_PAGE}${encodeURIComponent(number)}`,
  };
  const office = record(unit['forretningsadresse'] ?? unit['postadresse']);
  const address = addressOf({ lines: joined(list(office['adresse']), 500), town: words(office['poststed'], 120), postalCode: words(office['postnummer'], 20), country: words(office['landkode'], 2) });
  if (address !== undefined) company.address = address;
  const website = httpsSite(unit['hjemmeside']);
  if (website !== undefined) company.website = website;
  const phone = words(unit['telefon'], 40);
  if (phone !== undefined) company.phone = phone;
  const activity = record(unit['naeringskode1']);
  const code = words(activity['kode'], 20);
  if (code !== undefined) {
    const label = words(activity['beskrivelse'], 300);
    company.activity = label === undefined ? { code } : { code, label };
  }
  return company;
}

/** The register's source, for one call. */
export function createNorway(context: LeadSourceContext): LeadSource {
  const { signal } = context;

  /** A municipality's number for a typed place: four digits as they are, a name through the register's own list. */
  async function municipality(text: string, codes: readonly string[] | undefined): Promise<string | null | LeadSourceError> {
    const given = (codes ?? []).map((code) => code.trim()).filter((code) => /^\d{4}$/.test(code));
    if (given.length > 0) return given.join(',');
    const place = text.trim();
    if (place === '') return '';
    if (/^\d{4}$/.test(place)) return place;
    const response = await ask(context, `${API}/kommuner?size=1000`);
    if (response.status !== 200) return refused(response.status, retryAfterOf(response));
    const wanted = plain(place);
    const found = list(record(record(await jsonOf(response, signal))['_embedded'])['kommuner'])
      .map(record)
      .find((one) => typeof one['navn'] === 'string' && plain(one['navn']) === wanted);
    const number = words(found?.['nummer'], 4);
    return number === undefined ? null : number;
  }

  async function units(params: URLSearchParams): Promise<{ companies: FoundCompany[]; page: Record<string, unknown> } | LeadSourceError> {
    const response = await ask(context, `${API}/enheter?${params.toString()}`);
    if (response.status !== 200) return refused(response.status, retryAfterOf(response));
    const body = record(await jsonOf(response, signal));
    const companies = list(record(body['_embedded'])['enheter'])
      .map(unitFrom)
      .filter((company): company is FoundCompany => company !== null);
    return { companies, page: record(body['page']) };
  }

  return {
    async checkKey() {
      halt(signal);
      // No key: a one-unit search says whether the register can be reached.
      const response = await ask(context, `${API}/enheter?size=1`);
      return response.status === 200 ? { ok: true } : refused(response.status, retryAfterOf(response));
    },

    async findCompanies(question: FindQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      if (question.place.country.toUpperCase() !== 'NO') return { ok: true, companies: [], next: null, total: 0 };
      const page = cursorOf(question.page.cursor, 0);
      if (page === null) return refusal('INVALID_REQUEST', 'That page of results is not one the Register of Norway gave.');
      const size = Math.max(1, Math.min(50, Math.trunc(question.page.size)));
      if ((page + 1) * size > REACH) return { ok: true, companies: [], next: null };
      const activity = question.activity.trim();
      if (!/^\d{2}(\.\d{1,3})?$/.test(activity)) return refusal('INVALID_REQUEST', 'That is not an SN2025 code.');
      const place = await municipality(question.place.text, question.place.codes);
      if (place === null) return { ok: true, companies: [], next: null, total: 0 };
      if (typeof place !== 'string') return place;
      const params = new URLSearchParams({ naeringskode: activity, konkurs: 'false', underAvvikling: 'false', size: String(size), page: String(page) });
      if (place !== '') params.set('kommunenummer', place);
      const found = await units(params);
      if (isRefusal(found)) return found;
      const pages = Number(found.page['totalPages']);
      const total = Number(found.page['totalElements']);
      const more = Number.isInteger(pages) && page + 1 < pages && (page + 2) * size <= REACH;
      return { ok: true, companies: found.companies.slice(0, size), next: more ? String(page + 1) : null, ...(Number.isInteger(total) && total >= 0 ? { total } : {}) };
    },

    async fillCompany(question: FillQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      if (question.country !== undefined && question.country.toUpperCase() !== 'NO') return { ok: true, companies: [], next: null };
      const digits = question.number?.replace(/\D+/g, '') ?? '';
      if (digits !== '') {
        if (digits.length !== 9) return refusal('INVALID_REQUEST', 'An organisation number has nine digits.');
        const response = await ask(context, `${API}/enheter/${digits}`);
        // None, or removed from the register for legal reasons: nothing to fill in.
        if (response.status === 404 || response.status === 410) return { ok: true, companies: [], next: null };
        if (response.status !== 200) return refused(response.status, retryAfterOf(response));
        const company = unitFrom(await jsonOf(response, signal));
        return { ok: true, companies: company === null ? [] : [company], next: null };
      }
      const name = question.name?.trim() ?? '';
      if (name === '') return refusal('INVALID_REQUEST', 'Give an organisation number, or a name.');
      const place = await municipality(question.town ?? '', undefined);
      if (typeof place !== 'string' && place !== null) return place;
      const params = new URLSearchParams({ navn: name, size: '10' });
      if (place !== null && place !== '') params.set('kommunenummer', place);
      const found = await units(params);
      if (isRefusal(found)) return found;
      return { ok: true, companies: found.companies.slice(0, 10), next: null };
    },
  };
}
