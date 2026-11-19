/**
 * HUNTER (hunter.io): the people at a company's domain, with the owner's own
 * key. Used only while Lead finder keeps people; each look-up counts against
 * the owner's Hunter account.
 *
 * https://hunter.io/api-documentation/v2
 *  - Domain Search, `GET /v2/domain-search?domain=&type=personal&limit=`
 *    (`limit` 10 by default, 100 at most) answers `data.emails[]: { value,
 *    type, first_name, last_name, position, sources[]: { uri, … }, … }`;
 *  - Account Information, `GET /v2/account`, spends no look-up and answers
 *    `data.email` among others: what says the key is good;
 *  - the key goes in the `X-API-KEY` header (one of the three ways the
 *    reference gives), so it is never part of an address that could be
 *    written down;
 *  - 401: no valid key; 403: the rate limit (15 a second, 500 a minute);
 *    429: the account's look-ups are spent; 451: the person asked not to be
 *    processed.
 *
 * A person is kept only when Hunter says the address is a person's
 * (`type: "personal"`, never a generic `info@`) and gives their name. Their
 * role is the position as written; the pages the address was seen on are
 * its sources' https addresses, at most twenty.
 */
import type { FoundPerson, LeadSource, LeadSourceContext, LeadSourceError, PeopleFound, PeopleQuery } from '@adminium/add-on-contracts';

import { ask, halt, httpsLink, jsonOf, list, record, refusal, retryAfterOf, words } from './shared.ts';

export const HUNTER_HOST = 'api.hunter.io';
const API = `https://${HUNTER_HOST}/v2`;
/** The most people one look-up asks for, and the contract's cap. */
const PEOPLE_MAX = 50;
/** The most pages one person names. */
const PAGES_MAX = 20;

function refused(status: number, retryAfter: number | undefined): LeadSourceError {
  if (status === 401) return refusal('KEY_REFUSED', 'Hunter refused this key.');
  if (status === 403) return refusal('RATE_LIMITED', 'Hunter asks us to wait: it takes 15 look-ups a second at most.', retryAfter ?? 60);
  if (status === 429) return refusal('QUOTA_SPENT', 'This Hunter account has no look-ups left.');
  if (status === 451) return refusal('NOT_FOUND', 'Hunter holds nothing it may give about these people.');
  if (status === 400 || status === 422) return refusal('INVALID_REQUEST', 'Hunter could not read this search.');
  return refusal('UNAVAILABLE', `Hunter answered ${String(status)}.`);
}

/** One person of an answer, in the contract's shape; null when it is no person's address or has no name. */
export function personFrom(value: unknown): FoundPerson | null {
  const entry = record(value);
  if (entry['type'] !== 'personal') return null;
  const email = words(entry['value'], 320);
  if (email === undefined || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const first = words(entry['first_name'], 100);
  const last = words(entry['last_name'], 100);
  if (first === undefined || last === undefined) return null;
  const name = words(`${first} ${last}`, 200)!;
  const sources = [...new Set(list(entry['sources']).flatMap((source) => {
    const link = httpsLink(record(source)['uri']);
    return link === undefined ? [] : [link];
  }))].slice(0, PAGES_MAX);
  const role = words(entry['position'], 100);
  return role === undefined ? { name, email, sources } : { name, role, email, sources };
}

/** The service's source, for one call. */
export function createHunter(context: LeadSourceContext): LeadSource {
  const { signal } = context;
  const keyOrRefusal = (): string | LeadSourceError => (context.key === null || context.key.trim() === '' ? refusal('KEY_REFUSED', 'Hunter needs a key: none is saved.') : context.key.trim());

  return {
    async checkKey() {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      const response = await ask(context, `${API}/account`, { 'x-api-key': key });
      if (response.status !== 200) return refused(response.status, retryAfterOf(response));
      const account = words(record(record(await jsonOf(response, signal))['data'])['email'], 100);
      return account === undefined ? { ok: true } : { ok: true, account };
    },

    async findPeople(question: PeopleQuery): Promise<PeopleFound | LeadSourceError> {
      halt(signal);
      const key = keyOrRefusal();
      if (typeof key !== 'string') return key;
      const domain = question.domain.trim().toLowerCase().replace(/^www\./, '');
      if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain)) return refusal('INVALID_REQUEST', 'A domain such as kestrelyard.example.');
      const params = new URLSearchParams({ domain, type: 'personal', limit: String(PEOPLE_MAX) });
      const response = await ask(context, `${API}/domain-search?${params.toString()}`, { 'x-api-key': key });
      if (response.status !== 200) return refused(response.status, retryAfterOf(response));
      const seen = new Set<string>();
      const people = list(record(record(await jsonOf(response, signal))['data'])['emails'])
        .map(personFrom)
        .filter((person): person is FoundPerson => {
          if (person === null || seen.has(person.email.toLowerCase())) return false;
          seen.add(person.email.toLowerCase());
          return true;
        })
        .slice(0, PEOPLE_MAX);
      return { ok: true, people };
    },
  };
}
