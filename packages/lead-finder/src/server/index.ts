/**
 * ONE FACTORY, ONE SOURCE A CALL: `createLeadSource(context)` is what the
 * engine imports (`lead-source@1`), and it builds the source the call is for
 * (`context.source`, an `addOn.sources[].id` of the manifest). Each source
 * gets only its own key and a client the engine narrowed to its own hosts,
 * so no source's code ever holds another's key or reaches another's service.
 */
import type { CreateLeadSource, LeadSource, LeadSourceContext } from '@adminium/add-on-contracts';

import { COMPANIES_HOUSE_HOST, createCompaniesHouse } from './companies-house.ts';
import { createFrance, FRANCE_HOST } from './france.ts';
import { FRANCE_PLACES_HOST } from './france-places.ts';
import { createHunter, HUNTER_HOST } from './hunter.ts';
import { createNorway, NORWAY_HOST } from './norway.ts';
import { createOpenCorporates, OPENCORPORATES_HOST } from './opencorporates.ts';
import { halt, refusal } from './shared.ts';
import { createWebsite } from './website.ts';

/** Each source this add-on has, the hosts its code reaches (none for the engine's reader), and how it is made. */
export const SOURCES = {
  website: { hosts: [] as readonly string[], create: createWebsite },
  'companies-house': { hosts: [COMPANIES_HOUSE_HOST], create: createCompaniesHouse },
  france: { hosts: [FRANCE_HOST, FRANCE_PLACES_HOST], create: createFrance },
  norway: { hosts: [NORWAY_HOST], create: createNorway },
  opencorporates: { hosts: [OPENCORPORATES_HOST], create: createOpenCorporates },
  hunter: { hosts: [HUNTER_HOST], create: createHunter },
} as const satisfies Readonly<Record<string, { hosts: readonly string[]; create: (context: LeadSourceContext) => LeadSource }>>;

export type SourceId = keyof typeof SOURCES;

/** A source id this add-on has. */
export function isSourceId(id: string): id is SourceId {
  return Object.hasOwn(SOURCES, id);
}

/** The engine's factory: the source `context.source` names; for an id this add-on does not have, one that refuses every question. */
export const createLeadSource: CreateLeadSource = (context) => {
  if (isSourceId(context.source)) return SOURCES[context.source].create(context);
  const none = async () => {
    halt(context.signal);
    return refusal('INVALID_REQUEST', `Lead finder has no source called "${context.source.slice(0, 40)}".`);
  };
  return { checkKey: none };
};
