/**
 * THE REGISTER OF FRANCE: units by NAF code and place, and one unit by its
 * SIREN or its name, through the state's open company search. No key.
 *
 *  - https://recherche-entreprises.api.gouv.fr/docs/ (its OpenAPI file,
 *    `/openapi.json`): `GET /search` with `q`, `activite_principale` (a NAF
 *    code or a comma list), `code_postal`, `code_commune` (INSEE codes, comma
 *    list), `departement`, `etat_administratif` (`A` active), `minimal` +
 *    `include` (`siege`, `complements`, `dirigeants`), `page`, `per_page` (at
 *    most 25). It answers `{ results[], total_results, page, per_page,
 *    total_pages }`; each result carries `siren`, `nom_complet`,
 *    `nature_juridique`, `activite_principale`, `statut_diffusion`,
 *    `opposition_diffusion_commerciale`, `siege` (its address fields),
 *    `complements.est_entrepreneur_individuel` and `dirigeants`. At most 7
 *    calls a second; past it a 429 with `Retry-After`. Callers are asked to
 *    send a `User-Agent` that names them.
 *  - The flags it carries are honoured: a unit that objected to its details
 *    being used for sales (`opposition_diffusion_commerciale`) or is only
 *    partly public (`statut_diffusion: "P"`) is `noMarketing`; a sole trader
 *    (`nature_juridique` 1000, or `est_entrepreneur_individuel`) is a natural
 *    person, `natural`.
 *  - A director is a name and a role (`qualite`) only: never the birth year
 *    or month (`annee_de_naissance`, `date_de_naissance`) or the nationality.
 *
 * A typed town becomes its INSEE codes through `france-places.ts`.
 */
import type { CompaniesFound, FillQuery, FindQuery, FoundCompany, LeadSource, LeadSourceContext, LeadSourceError } from '@adminium/add-on-contracts';

import { activityLabel, activityOf, codesStartingWith } from '../activities/index.ts';
import { placeCodes } from './france-places.ts';
import { addressOf, ask, cursorOf, halt, isRefusal, jsonOf, list, plain, record, refusal, retryAfterOf, roleWords, USER_AGENT, words } from './shared.ts';

export const FRANCE_HOST = 'recherche-entreprises.api.gouv.fr';
const API = `https://${FRANCE_HOST}/search`;
/** A unit's page in the state's directory: the link a found company's card draws, never fetched. */
const UNIT_PAGE = 'https://annuaire-entreprises.data.gouv.fr/entreprise/';
/** The largest page the register gives. */
const PAGE_MAX = 25;
/** The legal category of a sole trader (an "entrepreneur individuel"). */
const SOLE_TRADER = '1000';

function refused(status: number, retryAfter: number | undefined): LeadSourceError {
  if (status === 429) return refusal('RATE_LIMITED', 'The Register of France asks us to wait: 7 look-ups a second is its limit.', retryAfter ?? 1);
  if (status === 400) return refusal('INVALID_REQUEST', 'The Register of France could not read this search.');
  return refusal('UNAVAILABLE', `The Register of France answered ${String(status)}.`);
}

/** Whether a unit is a natural person: a sole trader by its legal category, or by the register's own mark. */
export function isNaturalPerson(unit: Record<string, unknown>): boolean {
  return String(unit['nature_juridique'] ?? '').trim() === SOLE_TRADER || record(unit['complements'])['est_entrepreneur_individuel'] === true;
}

/** Whether a unit asked not to be approached for sales, or is only partly public. */
export function refusesMarketing(unit: Record<string, unknown>): boolean {
  return unit['opposition_diffusion_commerciale'] === true || String(unit['statut_diffusion'] ?? '').trim().toUpperCase() === 'P';
}

/** A unit's head office, as the contract keeps an address. */
function headOfficeOf(value: unknown): FoundCompany['address'] {
  const office = record(value);
  const street = [office['numero_voie'], office['indice_repetition'], office['type_voie'], office['libelle_voie']].map((part) => words(part, 200)).filter((part) => part !== undefined).join(' ');
  const lines = [words(office['complement_adresse'], 200), street === '' ? undefined : street].filter((part) => part !== undefined).join(', ');
  const abroad = words(office['code_pays_etranger'], 10);
  return addressOf({
    lines: lines === '' ? words(office['adresse'], 500) : lines,
    town: words(office['libelle_commune'] ?? office['libelle_commune_etranger'], 120),
    postalCode: words(office['code_postal'], 20),
    // A head office abroad has a country code the register gives in INSEE's own scheme, not ISO: left out.
    country: abroad === undefined ? 'FR' : undefined,
  });
}

/** The unit's NAF code, with INSEE's label. */
function activityFrom(code: unknown, locale: string): FoundCompany['activity'] {
  const text = words(code, 20);
  if (text === undefined) return undefined;
  const known = activityOf('france', text);
  const label = known === undefined ? undefined : words(activityLabel(known, locale), 300);
  return label === undefined ? { code: text } : { code: text, label };
}

/** The directors: a person's first names and name, or a company's name, and the role. Nothing else of them. */
function directorsOf(value: unknown): FoundCompany['officers'] {
  const officers = list(value)
    .map(record)
    .flatMap((director) => {
      const person = [words(director['prenoms'], 100), words(director['nom'], 100)].filter((part) => part !== undefined).join(' ');
      const name = words(person === '' ? director['denomination'] : person, 200);
      if (name === undefined) return [];
      const role = roleWords(director['qualite']);
      return [role === undefined ? { name } : { name, role }];
    })
    .slice(0, 50);
  return officers.length === 0 ? undefined : officers;
}

/** One unit of an answer, in the contract's shape; null when it has no SIREN or no name. */
export function unitFrom(value: unknown, locale: string, withDirectors: boolean): FoundCompany | null {
  const unit = record(value);
  const siren = words(unit['siren'], 40);
  const name = words(unit['nom_complet'] ?? unit['nom_raison_sociale'], 300);
  if (siren === undefined || name === undefined) return null;
  const company: FoundCompany = {
    ref: siren,
    name,
    number: siren,
    natural: isNaturalPerson(unit),
    noMarketing: refusesMarketing(unit),
    sourceUrl: `${UNIT_PAGE}${encodeURIComponent(siren)}`,
  };
  const address = headOfficeOf(unit['siege']);
  if (address !== undefined) company.address = address;
  const activity = activityFrom(unit['activite_principale'], locale);
  if (activity !== undefined) company.activity = activity;
  if (withDirectors) {
    const officers = directorsOf(unit['dirigeants']);
    if (officers !== undefined) company.officers = officers;
  }
  return company;
}

/** The register's source, for one call. */
export function createFrance(context: LeadSourceContext): LeadSource {
  const { signal, locale } = context;
  const headers = { 'user-agent': USER_AGENT };

  async function search(params: Record<string, string>, withDirectors: boolean): Promise<{ companies: FoundCompany[]; body: Record<string, unknown> } | LeadSourceError> {
    const include = withDirectors ? 'siege,complements,dirigeants' : 'siege,complements';
    const response = await ask(context, `${API}?${new URLSearchParams({ ...params, minimal: 'true', include }).toString()}`, headers);
    if (response.status !== 200) return refused(response.status, retryAfterOf(response));
    const body = record(await jsonOf(response, signal));
    const companies = list(body['results'])
      .map((unit) => unitFrom(unit, locale, withDirectors))
      .filter((company): company is FoundCompany => company !== null);
    return { companies, body };
  }

  return {
    async checkKey() {
      halt(signal);
      // No key: a one-result search says whether the register can be reached.
      const response = await ask(context, `${API}?${new URLSearchParams({ q: 'architecture', per_page: '1', minimal: 'true' }).toString()}`, headers);
      return response.status === 200 ? { ok: true } : refused(response.status, retryAfterOf(response));
    },

    async findCompanies(question: FindQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      if (question.place.country.toUpperCase() !== 'FR') return { ok: true, companies: [], next: null, total: 0 };
      const page = cursorOf(question.page.cursor, 1);
      if (page === null) return refusal('INVALID_REQUEST', 'That page of results is not one the Register of France gave.');
      const size = Math.max(1, Math.min(PAGE_MAX, Math.trunc(question.page.size)));
      const activity = question.activity.trim().toUpperCase();
      const codes = activityOf('france', activity) === undefined ? codesStartingWith('france', activity).slice(0, 50) : [activity];
      if (codes.length === 0) return refusal('INVALID_REQUEST', 'That is not a NAF code.');
      const place = await placeCodes(context, question.place);
      if (place === null) return { ok: true, companies: [], next: null, total: 0 };
      if (isRefusal(place)) return place;
      const found = await search({ activite_principale: codes.join(','), ...place, etat_administratif: 'A', page: String(page), per_page: String(size) }, false);
      if (isRefusal(found)) return found;
      const pages = Number(found.body['total_pages']);
      const total = Number(found.body['total_results']);
      return {
        ok: true,
        companies: found.companies.slice(0, size),
        next: Number.isInteger(pages) && page < pages ? String(page + 1) : null,
        ...(Number.isInteger(total) && total >= 0 ? { total } : {}),
      };
    },

    async fillCompany(question: FillQuery): Promise<CompaniesFound | LeadSourceError> {
      halt(signal);
      if (question.country !== undefined && question.country.toUpperCase() !== 'FR') return { ok: true, companies: [], next: null };
      const digits = question.number?.replace(/\D+/g, '') ?? '';
      if (digits !== '') {
        // A SIRET is the SIREN and five more digits: the unit is the first nine.
        const siren = digits.length === 14 ? digits.slice(0, 9) : digits;
        if (siren.length !== 9) return refusal('INVALID_REQUEST', 'A SIREN has nine digits.');
        const found = await search({ q: siren, per_page: '5' }, true);
        if (isRefusal(found)) return found;
        return { ok: true, companies: found.companies.filter((company) => company.number === siren).slice(0, 1), next: null };
      }
      const name = question.name?.trim() ?? '';
      if (name === '') return refusal('INVALID_REQUEST', 'Give a SIREN, or a name.');
      const town = question.town?.trim() ?? '';
      const place = town === '' ? null : await placeCodes(context, { text: town });
      if (isRefusal(place)) return place;
      const found = await search({ q: name, ...(place ?? {}), per_page: '10' }, true);
      if (isRefusal(found)) return found;
      const wanted = plain(name);
      return { ok: true, companies: found.companies.filter((company) => plain(company.name).includes(wanted)).slice(0, 10), next: null };
    },
  };
}
