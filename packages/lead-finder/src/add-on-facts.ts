/**
 * THE FACTS A HOST'S OWN GATES NEED FROM THIS ADD-ON (see `shipping-dhl`'s
 * copy of this file for why they travel with the add-on).
 *
 * The server half is loaded by the Adminium engine only, which calls it per
 * source with only that source's key and a client narrowed to its hosts.
 */

/**
 * Addresses this add-on names without ever calling them: the pages a found
 * company's card links to on each register's own site, and the address in
 * the user agent the registers are asked with. The sources suite checks no
 * other address appears but the sources' own hosts.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [
  { origin: 'https://find-and-update.company-information.service.gov.uk', why: 'a found UK company’s page on the register’s site: a link on its card, never fetched' },
  { origin: 'https://annuaire-entreprises.data.gouv.fr', why: 'a found French unit’s page in the state’s directory: a link on its card, never fetched' },
  { origin: 'https://virksomhet.brreg.no', why: 'a found Norwegian unit’s page in the register’s search: a link on its card, never fetched' },
  { origin: 'https://adminium.dev', why: 'named in the user agent the registers are asked with, as France asks callers to name themselves' },
];

/** Strings that must never reach a browser: the three keys' setting names, and the services they open. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [
  { text: 'companies_house_key', why: 'the `secret: true` setting that holds the owner’s Companies House key' },
  { text: 'opencorporates_key', why: 'the `secret: true` setting that holds the owner’s OpenCorporates key, which costs them money' },
  { text: 'hunter_key', why: 'the `secret: true` setting that holds the owner’s Hunter key, which costs them money' },
];

/** The marks this add-on's words name (TRADEMARKS.md, "Lead finder"). */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [
  { mark: 'Hunter', owner: 'Hunter Web Services, Inc.' },
  { mark: 'OpenCorporates', owner: 'OpenCorporates Ltd' },
];
