/**
 * ADMINIUM'S ROUTES, AS THESE SCREENS CALL THEM.
 *
 * Adminium does every call to a source, every read of a website, every write
 * and every match: a screen only asks. The lead door
 * (`/api/v1/leads/lead-finder/…`) finds, adds, looks up, fills in and keeps
 * people, as the signed-in person; the Sources routes
 * (`/api/v1/add-ons/lead-finder/sources…`) read each source's state and,
 * with the settings grant, save, check and remove its key and set its switch
 * and daily limit. A screen never sends a found value back to be written: it
 * names what was found (a `ref`, a source), and the door writes what it kept.
 *
 * Every refusal throws the host's `ApiError` with its status, its stable code
 * and its details (`source`, `retryAfterSeconds`, `field`, `reason`), which
 * `codes.ts` turns into the reader's words.
 */
import { api } from './host.ts';
import { ADD_ON } from './paths.ts';

const DOOR = `/api/v1/leads/${ADD_ON}`;
const SOURCES = `/api/v1/add-ons/${ADD_ON}/sources`;

/** What a source does: finds companies, fills one in, finds the people at one. */
export type Gives = 'find' | 'fill' | 'people';

/** One source, as Adminium reads its state: never its key. */
export interface SourceView {
  id: string;
  hosts: string[];
  gives: Gives[];
  website: boolean;
  needsKey: boolean;
  paid: boolean;
  /** The last four of the saved key ('' for a key too short to show any); null when none is saved. */
  lastFour: string | null;
  savedAt: number | null;
  verdict: 'accepted' | 'refused' | 'unreachable' | null;
  checkedAt: number | null;
  on: boolean;
  dailyCap: number | null;
  personShare: number | null;
  usedToday: number;
  pausedFor: number;
}

export interface SourcesReply {
  key: string;
  /** Whether this reader may change keys, switches and limits (the settings grant). */
  canManage: boolean;
  sources: SourceView[];
}

export interface CheckView {
  verdict: 'accepted' | 'refused' | 'unreachable';
  code: string | null;
  message: string | null;
  account: string | null;
}

export interface OneSourceReply {
  source: SourceView;
  check: CheckView | null;
}

export interface Address {
  lines?: string;
  town?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}

/** A company a source found, as the door shows it to this reader. */
export interface FoundView {
  ref: string;
  name: string;
  number?: string;
  website?: string;
  phone?: string;
  address?: Address;
  activity?: { code?: string; label?: string };
  about?: string;
  natural: boolean;
  noMarketing: boolean;
  officers?: { name: string; role?: string }[];
  sourceUrl?: string;
  /** The row it already is: its key only when the reader may open it, never its values. */
  here: { key: string | null; keptByColleague: boolean; by: 'number' | 'domain' | 'name' } | null;
  /** Why it may not be ticked; null when it may. */
  blocked: { reason: 'no-marketing' | 'sole-trader' | 'needs-address'; message: string } | null;
}

export interface SearchBody {
  source: string;
  table?: string;
  activity: string;
  place: { text: string; country: string };
  cursor?: string | null;
  size?: number;
}

export interface SearchReply {
  source: string;
  table: string | null;
  peopleOn: boolean;
  companies: FoundView[];
  next: string | null;
  total: number | null;
}

export type AddReason = 'already-here' | 'no-marketing' | 'sole-trader' | 'needs-address' | 'not-found' | 'refused' | 'not-kept';

export interface AddReply {
  table: string;
  added: number;
  refused: number;
  message: string;
  results: { ref: string; outcome: 'added' | 'refused'; key: string | null; reason: AddReason | null; message: string | null }[];
}

/** The details a company's record keeps, by the `lead` word's names. */
export const LEAD_FIELDS = ['name', 'number', 'website', 'phone', 'lines', 'town', 'region', 'postalCode', 'country', 'activity', 'about'] as const;
export type LeadField = (typeof LEAD_FIELDS)[number];

export type WebsiteOutcome = 'read' | 'asks' | 'refused-by-site' | 'not-a-page' | 'unreachable' | 'no-website' | 'off';

export interface LookupBody {
  table?: string;
  record: string;
  sources: string[];
  website: boolean;
  confirmedHost?: string;
  number?: string;
  name?: string;
  town?: string;
}

export interface LookupReply {
  table: string;
  record: string;
  sources: { source: string; outcome: 'found' | 'several' | 'none' | 'refused'; code: string | null; message: string | null; matches: FoundView[] }[];
  website: { outcome: WebsiteOutcome; host: string | null; message: string | null } | null;
  fields: { field: LeadField; column: string; now: string | null; found: { source: string; value: string }[] }[];
}

export interface FillBody {
  table?: string;
  record: string;
  fields: { field: LeadField; source: string; now: string | null }[];
}

export interface FillReply {
  table: string;
  record: string;
  filled: { field: LeadField; column: string; source: string }[];
}

export interface PeopleReply {
  record: string;
  domain: string;
  people: { name: string; role: string | null; email: string; sources: string[]; note: 'generic' | 'already-here' | null }[];
  /** How many it found are on the do-not-email list: never listed, never kept. */
  stopped: number;
}

export interface KeepReply {
  kept: { email: string; personTable: string; personKey: string }[];
  refused: { email: string; reason: string }[];
}

/** A table of companies an app declares, as the add-on's kit names it. */
export interface CompaniesHost {
  tableRef: string;
  id: string;
  label: string;
  via: 'companies';
  /** The slug of a generated page of the table this reader may open. */
  page?: string;
  lead: { number?: string; website?: string; phone?: string; activity?: string; about?: string; owner?: string; address?: Record<string, string | undefined> };
}

/** One of the add-on's own tables, as the kit names it to this reader. */
export interface KitTable {
  id: string;
  can: { read: boolean; create: boolean; update: boolean; delete: boolean };
}

export interface Kit {
  connectionId: string;
  /** The add-on's own tables, by the short names of its manifest. */
  tables: Record<string, KitTable>;
  companies: CompaniesHost[];
}

/** A call the person may stop: the answer is dropped the moment they do. */
async function stoppable<T>(call: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return call;
  if (signal.aborted) throw stopped();
  return new Promise<T>((resolve, reject) => {
    const onStop = () => reject(stopped());
    signal.addEventListener('abort', onStop, { once: true });
    call.then(
      (value) => {
        signal.removeEventListener('abort', onStop);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onStop);
        reject(error);
      },
    );
  });
}

/** What a stopped call rejects with. */
export const STOPPED = 'STOPPED';
const stopped = (): Error & { code: string } => Object.assign(new Error('Stopped.'), { code: STOPPED });
export const isStopped = (caught: unknown): boolean => typeof caught === 'object' && caught !== null && (caught as { code?: unknown }).code === STOPPED;

/**
 * The person's Stop goes with the request: a host whose `api` takes a signal
 * ends the call itself, and the engine stops asking the source the moment the
 * request goes away. Either way the answer is dropped here at once.
 */
const post = api.post as <T>(path: string, payload?: unknown, options?: { signal?: AbortSignal }) => Promise<T>;
const ask = <T,>(path: string, body: unknown, signal: AbortSignal | undefined): Promise<T> => stoppable(signal === undefined ? post<T>(path, body) : post<T>(path, body, { signal }), signal);

export const door = {
  search: (body: SearchBody, signal?: AbortSignal): Promise<SearchReply> => ask<SearchReply>(`${DOOR}/search`, body, signal),
  add: (body: { source: string; table?: string; companies: { ref: string; retryKey: string; email?: string }[] }): Promise<AddReply> => api.post<AddReply>(`${DOOR}/add`, body),
  lookup: (body: LookupBody, signal?: AbortSignal): Promise<LookupReply> => ask<LookupReply>(`${DOOR}/lookup`, body, signal),
  fill: (body: FillBody): Promise<FillReply> => api.post<FillReply>(`${DOOR}/fill`, body),
  people: (body: { table?: string; record: string; source: string }, signal?: AbortSignal): Promise<PeopleReply> => ask<PeopleReply>(`${DOOR}/people`, body, signal),
  keep: (body: { table?: string; record: string; source: string; emails: string[] }): Promise<KeepReply> => api.post<KeepReply>(`${DOOR}/people/keep`, body),
};

export const sources = {
  list: (): Promise<SourcesReply> => api.get<SourcesReply>(SOURCES),
  saveKey: (id: string, value: string): Promise<OneSourceReply> => api.put<OneSourceReply>(`${SOURCES}/${encodeURIComponent(id)}/key`, { value }),
  removeKey: (id: string): Promise<OneSourceReply> => api.delete<OneSourceReply>(`${SOURCES}/${encodeURIComponent(id)}/key`),
  check: (id: string): Promise<OneSourceReply> => api.post<OneSourceReply>(`${SOURCES}/${encodeURIComponent(id)}/check`, {}),
  change: (id: string, body: { on?: boolean; dailyCap?: number | null; personShare?: number | null }): Promise<OneSourceReply> => api.put<OneSourceReply>(`${SOURCES}/${encodeURIComponent(id)}`, body),
};

/** The add-on's kit: its database, its own tables, and the tables of companies the apps on it declare. */
export async function readKit(): Promise<Kit> {
  const reply = await api.get<{ connectionId?: string; tables?: Record<string, KitTable>; hosts?: { via?: string }[] }>(`/api/v1/add-ons/${ADD_ON}/kit`);
  const companies = (reply.hosts ?? []).filter((host): host is CompaniesHost => host.via === 'companies');
  return { connectionId: reply.connectionId ?? '', tables: reply.tables ?? {}, companies };
}

/** The rows of a table of the database, as this reader may read them (the data routes, as the person). */
export async function readRows(connectionId: string, tableId: string, query = ''): Promise<Record<string, unknown>[]> {
  const reply = await api.get<{ data?: unknown }>(`/api/v1/data/${encodeURIComponent(connectionId)}/${encodeURIComponent(tableId)}${query}`);
  return Array.isArray(reply.data) ? (reply.data as Record<string, unknown>[]) : [];
}

/** One row of a table of the database as this reader may read it; refused (403, 404) when they may not. */
export async function readRow(connectionId: string, tableId: string, key: string): Promise<Record<string, unknown> | null> {
  const reply = await api.get<{ data?: unknown }>(`/api/v1/data/${encodeURIComponent(connectionId)}/${encodeURIComponent(tableId)}/${encodeURIComponent(key)}`);
  return typeof reply.data === 'object' && reply.data !== null ? (reply.data as Record<string, unknown>) : null;
}

/** Whether people are kept here: the add-on's settings row, read as the person. */
export async function peopleOn(kit: Kit): Promise<boolean | null> {
  const settings = kit.tables['settings'];
  if (settings === undefined || !settings.can.read) return null;
  const [row] = await readRows(kit.connectionId, settings.id, '?pageSize=1');
  if (row === undefined) return false;
  const value = row['people_on'];
  return value === true || value === 1 || value === '1' || value === 'true' || value === 't';
}

/** A fresh retry key for one found company: sent again, the add answers what it did the first time. */
export function retryKey(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(18));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
