/**
 * THE WEBSITE READER: the company's own site, read by ADMINIUM, never by
 * this add-on. The engine fetches one page (robots first, redirects held to
 * the same site, `text/html` only) and hands over typed fields; this source
 * only picks the company's facts out of them. It reaches no host and holds
 * no key, so it has no client to call.
 *
 * What it takes: the name (the page's own markup first, then its title), the
 * site's own description as "About" (never body text), the site itself as
 * the website, the first switchboard number, and the address. Generic
 * addresses (`info@`) are a company's, not a person's, and the contract keeps
 * no address for a company: they are not taken.
 */
import type { CompanyFacts, LeadSource, LeadSourceContext, WebsitePage } from '@adminium/add-on-contracts';

import { addressOf, halt, httpsLink, words } from './shared.ts';

/** The facts of one page the engine read. */
export function factsFrom(page: WebsitePage): CompanyFacts {
  const facts: CompanyFacts = {};
  const marked = page.jsonLd[0] ?? {};
  const name = words(marked.name, 300) ?? words(page.name, 300);
  if (name !== undefined) facts.name = name;
  const about = words(page.about, 2000) ?? words(marked.about, 2000);
  if (about !== undefined) facts.about = about;
  const read = httpsLink(page.finalUrl) ?? httpsLink(page.url);
  if (read !== undefined) {
    facts.website = new URL(read).origin;
    facts.sourceUrl = read;
  }
  const phone = words(page.phones[0], 40) ?? words(marked.phone, 40);
  if (phone !== undefined) facts.phone = phone;
  const address = page.address ?? marked.address;
  if (address !== undefined) {
    const kept = addressOf(address);
    if (kept !== undefined) facts.address = kept;
  }
  const number = words(marked.number, 40);
  if (number !== undefined) facts.number = number;
  if (marked.activity !== undefined) facts.activity = marked.activity;
  return facts;
}

/** The reader's source, for one call. */
export function createWebsite(context: LeadSourceContext): LeadSource {
  const { signal } = context;
  return {
    async checkKey() {
      halt(signal);
      // Nothing to check: no key, and the engine does the reading.
      return { ok: true };
    },
    async fromWebsite(page: WebsitePage) {
      halt(signal);
      return factsFrom(page);
    },
  };
}
