/**
 * WHERE, FOR THE REGISTER OF FRANCE: the register filters by codes, never by
 * a town's name, so a typed place becomes the codes it searches by.
 *
 *  - codes the engine already resolved (`place.codes`): INSEE commune codes;
 *  - five digits: a postcode (`code_postal`);
 *  - two or three characters (`69`, `2A`, `974`): a département;
 *  - anything else: a town's name, turned into its INSEE code by the state's
 *    open town service, https://geo.api.gouv.fr/decoupage-administratif/communes
 *    (its definition, `/definition.yml`: `GET /communes?nom=&fields=&boost=`
 *    answers `[{ nom, code, … }]`). Paris, Lyon and Marseille are searched by
 *    their arrondissements: the register files each unit under the
 *    arrondissement's own code, so the city's code alone finds nothing.
 */
import type { FindQuery, LeadSourceContext, LeadSourceError } from '@adminium/add-on-contracts';

import { ask, jsonOf, list, plain, record, refusal, retryAfterOf, USER_AGENT, words } from './shared.ts';

export const FRANCE_PLACES_HOST = 'geo.api.gouv.fr';
const API = `https://${FRANCE_PLACES_HOST}/communes`;

/** Codes `from` to `to`, as five-character INSEE codes. */
function run(from: number, to: number): string[] {
  return Array.from({ length: to - from + 1 }, (_, i) => String(from + i));
}

/** The three cities filed by arrondissement: the city's code, and the codes its units are filed under. */
export const ARRONDISSEMENTS: Readonly<Record<string, readonly string[]>> = {
  // Paris: 75101 to 75120.
  '75056': run(75101, 75120),
  // Lyon: 69381 to 69389.
  '69123': run(69381, 69389),
  // Marseille: 13201 to 13216.
  '13055': run(13201, 13216),
};

/** A commune's codes as the register files units under them: a city of arrondissements becomes all of them. */
export function filedUnder(code: string): string[] {
  return [...(ARRONDISSEMENTS[code] ?? [code])];
}

/**
 * The search's place parameters for a typed place: a postcode, a
 * département or commune codes. Null when the place is no town France knows
 * (nothing can be found there); a refusal when the town service could not answer.
 */
export async function placeCodes(context: LeadSourceContext, place: Pick<FindQuery['place'], 'text' | 'codes'>): Promise<Record<string, string> | null | LeadSourceError> {
  const given = (place.codes ?? []).map((code) => code.trim().toUpperCase()).filter((code) => /^[0-9][0-9AB][0-9]{3}$/.test(code));
  if (given.length > 0) return { code_commune: [...new Set(given.flatMap(filedUnder))].join(',') };
  const text = place.text.trim();
  if (text === '') return {};
  if (/^\d{5}$/.test(text)) return { code_postal: text };
  if (/^(\d{2,3}|2[AB])$/i.test(text)) return { departement: text.toUpperCase() };

  const response = await ask(context, `${API}?${new URLSearchParams({ nom: text, fields: 'nom,code', boost: 'population' }).toString()}`, { 'user-agent': USER_AGENT });
  if (response.status === 429) return refusal('RATE_LIMITED', 'The French town service asks us to wait.', retryAfterOf(response) ?? 1);
  if (response.status !== 200) return refusal('UNAVAILABLE', `The French town service answered ${String(response.status)}.`);
  const towns = list(await jsonOf(response, context.signal))
    .map(record)
    .flatMap((town) => {
      const code = words(town['code'], 5);
      const name = words(town['nom'], 120);
      return code === undefined || name === undefined || !/^[0-9][0-9AB][0-9]{3}$/.test(code) ? [] : [{ code, name }];
    });
  // The towns of exactly that name (there may be several: "Saint-Denis"); else the most populous match.
  const wanted = plain(text);
  const exact = towns.filter((town) => plain(town.name) === wanted);
  const chosen = exact.length > 0 ? exact : towns.slice(0, 1);
  if (chosen.length === 0) return null;
  return { code_commune: [...new Set(chosen.flatMap((town) => filedUnder(town.code)))].join(',') };
}
