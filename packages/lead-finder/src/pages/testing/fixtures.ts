/**
 * What Adminium answers the screens with, in their tests: the six sources,
 * the kit, a search's companies, a look-up, the people at a company. Every
 * company and person is made up (§6 of the sample rules): UK numbers from
 * the unallocated `98…` block, `.example` sites, made-up streets.
 */
import type { FoundView, LookupReply, PeopleReply, SourceView } from '../shared/door.ts';
import { world } from './host.tsx';

export const DOOR = '/api/v1/leads/lead-finder';
export const SOURCES = '/api/v1/add-ons/lead-finder/sources';
export const KIT = '/api/v1/add-ons/lead-finder/kit';

const base = (id: string, more: Partial<SourceView>): SourceView => ({
  id,
  hosts: [],
  gives: ['find', 'fill'],
  website: false,
  needsKey: false,
  paid: false,
  lastFour: null,
  savedAt: null,
  verdict: null,
  checkedAt: null,
  on: true,
  dailyCap: null,
  personShare: null,
  usedToday: 0,
  pausedFor: 0,
  ...more,
});

export function sourceList(more: Partial<Record<string, Partial<SourceView>>> = {}): SourceView[] {
  return [
    base('website', { website: true, gives: ['fill'], ...more['website'] }),
    base('companies-house', { hosts: ['api.company-information.service.gov.uk'], needsKey: true, lastFour: '7Kd2', savedAt: 1, verdict: 'accepted', checkedAt: Date.parse('2026-07-28T09:35:00Z'), ...more['companies-house'] }),
    base('france', { hosts: ['recherche-entreprises.api.gouv.fr', 'geo.api.gouv.fr'], ...more['france'] }),
    base('norway', { hosts: ['data.brreg.no'], ...more['norway'] }),
    base('opencorporates', { hosts: ['api.opencorporates.com'], gives: ['fill'], needsKey: true, paid: true, lastFour: 'a1B2', verdict: 'accepted', dailyCap: 100, personShare: 50, usedToday: 43, ...more['opencorporates'] }),
    base('hunter', { hosts: ['api.hunter.io'], gives: ['people'], needsKey: true, paid: true, lastFour: '7Qa3', verdict: 'accepted', dailyCap: 100, personShare: 50, usedToday: 12, ...more['hunter'] }),
  ];
}

export const KIT_REPLY = {
  connectionId: 'conn-1',
  tables: {
    settings: { id: 'lf_settings', can: { read: true, create: true, update: true, delete: false } },
    found_people: { id: 'lf_found_people', can: { read: true, create: false, update: false, delete: false } },
  },
  hosts: [{ tableRef: 'crm:companies', id: 'companies', label: 'Companies', via: 'companies', page: 'companies', lead: { number: 'company_number', website: 'website', owner: 'account_owner_id', address: { town: 'town' } } }],
};

const company = (ref: string, name: string, more: Partial<FoundView> = {}): FoundView => ({
  ref,
  name,
  number: ref.replace(/^gb-/, ''),
  website: `https://${name.toLowerCase().replace(/[^a-z]+/g, '')}.example`,
  address: { town: 'Leeds', country: 'GB' },
  activity: { code: '71111', label: 'Architectural activities' },
  natural: false,
  noMarketing: false,
  here: null,
  blocked: null,
  ...more,
});

export const FOUND: FoundView[] = [
  company('gb-98000412', 'Kestrel Yard Architects'),
  company('gb-98001537', 'Millbeck Drawing Office'),
  company('gb-98002264', 'Ouseburn Studio', { here: { key: '17', keptByColleague: false, by: 'number' } }),
  company('gb-98003391', 'Tannery Row Design', { here: { key: null, keptByColleague: true, by: 'name' } }),
  company('gb-98004417', 'Calder Mill Works', { noMarketing: true, blocked: { reason: 'no-marketing', message: 'This business told the register it does not want sales contact.' } }),
  company('gb-98005520', 'Robin Ashby', { natural: true, website: undefined, blocked: { reason: 'sole-trader', message: 'A sole trader is a person: turn on People to keep one.' } }),
];

export const LOOKUP: LookupReply = {
  table: 'crm:companies',
  record: '17',
  sources: [{ source: 'companies-house', outcome: 'found', code: null, message: null, matches: [] }],
  website: { outcome: 'read', host: null, message: null },
  fields: [
    { field: 'name', column: 'name', now: 'Kestrel Yard', found: [{ source: 'companies-house', value: 'Kestrel Yard Architects Ltd' }] },
    { field: 'number', column: 'company_number', now: null, found: [{ source: 'companies-house', value: '98000412' }] },
    { field: 'lines', column: 'address_lines', now: null, found: [{ source: 'companies-house', value: 'Unit 4, Calder Wharf Lane' }] },
    { field: 'activity', column: 'sector', now: 'Architects', found: [{ source: 'companies-house', value: 'Architectural activities · 71111' }] },
    { field: 'about', column: 'about', now: null, found: [{ source: 'website', value: 'A small practice drawing homes and workshops.' }] },
    { field: 'town', column: 'town', now: 'Leeds', found: [{ source: 'companies-house', value: 'Leeds' }] },
  ],
};

export const PEOPLE_REPLY: PeopleReply = {
  record: '17',
  domain: 'kestrelyard.example',
  people: [
    { name: 'Sam Ellery', role: 'Architect', email: 'sam@kestrelyard.example', sources: ['https://kestrelyard.example/team'], note: null },
    { name: 'Robin Hale', role: 'Director', email: 'robin@kestrelyard.example', sources: [], note: null },
    { name: 'Office', role: null, email: 'info@kestrelyard.example', sources: [], note: 'generic' },
    { name: 'Jo Ashby', role: 'Director', email: 'jo@kestrelyard.example', sources: [], note: 'already-here' },
  ],
  stopped: 1,
};

/** Answer the routes: each handler by "METHOD path"; anything else answers an empty object. */
export function answer(handlers: Record<string, (payload: unknown) => unknown>): void {
  world.api = (method, path, payload) => {
    const handler = handlers[`${method} ${path}`] ?? handlers[path];
    return handler === undefined ? {} : handler(payload);
  };
}

/** A promise that never settles: a call still in flight. */
export const pending = (): Promise<never> => new Promise<never>(() => undefined);
