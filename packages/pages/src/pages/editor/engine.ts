/**
 * WHAT THE EDITOR ASKS ADMINIUM, BEYOND THE ADD-ON'S OWN TABLES.
 *
 * The routes the engine keeps for a landing pages add-on's staff (each under
 * the person's own grants on the add-on's pages table), and the two of the
 * dashboard's own the editor uses:
 *
 *   GET  /api/v1/landing/:addOn/status?page=       reach, the privacy notice, the public address,
 *                                                  the pages hosts and this page's address on each
 *   POST /api/v1/landing/:addOn/pictures?page=     a file of Files kept as the page's own copy
 *   GET  /api/v1/landing/:addOn/pictures/:file     one of the page's own pictures (the canvas draws it)
 *   POST /api/v1/landing/:addOn/draft              Milo's draft of a page
 *   GET  /api/v1/landing/:addOn/forms              the live forms a Form section may show
 *   GET  /api/v1/files                             the pictures in Files, to choose one from
 *   GET  /api/v1/surfaces, PUT /surfaces/domains   which page a pages host opens on (its home)
 *
 * Every reply is read leniently: what is not there is not claimed, and a
 * reply that is not what it should be reads as nothing.
 */
import { api } from '../shared/host.ts';
import { ADD_ON } from '../shared/paths.ts';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const dataOf = (reply: unknown): unknown => (isRecord(reply) ? reply['data'] : undefined);

/** The add-on's own routes. */
export const LANDING = `/api/v1/landing/${ADD_ON}`;
export const statusPath = (page: string): string => `${LANDING}/status?page=${encodeURIComponent(page)}`;
export const picturesPath = (page: string): string => `${LANDING}/pictures?page=${encodeURIComponent(page)}`;
export const DRAFT_PATH = `${LANDING}/draft`;
export const FORMS_PATH = `${LANDING}/forms`;
export const SURFACES_PATH = '/api/v1/surfaces';
export const DOMAINS_PATH = '/api/v1/surfaces/domains';
/** The kinds of picture a page may show, by the files routes' own words; and the most one may weigh (the public picture rule). */
export const PICTURE_KINDS = ['png', 'jpeg', 'webp', 'gif'] as const;
export const PICTURE_MIMES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const PICTURE_MAX_BYTES = 5 * 1024 * 1024;
export const filesPath = (q: string): string => `/api/v1/files?accept=${PICTURE_KINDS.join(',')}&limit=60${q.trim() === '' ? '' : `&q=${encodeURIComponent(q.trim())}`}`;

/** Where the canvas reads one of the page's own pictures. */
export const pictureSrc = (page: string, file: string): string => `${LANDING}/pictures/${encodeURIComponent(file)}?page=${encodeURIComponent(page)}`;

/* ── the status ─────────────────────────────────────────────────────────── */

export interface PageAddress {
  host: string;
  url: string;
  home: boolean;
}

export interface LandingStatus {
  /** `reachable`, or why strangers cannot open the pages (`network-off`, `not-set`, …). */
  reach: { state: string; proxyUnchecked: boolean };
  notice: boolean;
  publicOrigin: string | null;
  /** The hosts mapped to the add-on pages, each with its home. */
  hosts: readonly { host: string; home: string }[];
  /** This page: its address on each pages host, then on the public address; and the hosts it is home of. */
  page: { slug: string | null; state: string | null; addresses: readonly PageAddress[]; canonical: string | null; homeOf: readonly string[] } | null;
}

function addressOf(value: unknown): PageAddress | null {
  if (!isRecord(value) || text(value['host']) === null || text(value['url']) === null) return null;
  return { host: value['host'] as string, url: value['url'] as string, home: value['home'] === true };
}

/** The status reply, read leniently; null when it is not one. */
export function statusOf(reply: unknown): LandingStatus | null {
  const data = dataOf(reply);
  if (!isRecord(data) || !isRecord(data['reach']) || typeof data['reach']['state'] !== 'string' || typeof data['notice'] !== 'boolean') return null;
  const hosts = Array.isArray(data['hosts']) ? data['hosts'].filter((one): one is { host: string; home: string } => isRecord(one) && typeof one['host'] === 'string' && typeof one['home'] === 'string') : [];
  const page = isRecord(data['page']) ? data['page'] : null;
  return {
    reach: { state: data['reach']['state'], proxyUnchecked: data['reach']['proxyUnchecked'] === true },
    notice: data['notice'],
    publicOrigin: text(data['publicOrigin']),
    hosts: hosts.map((one) => ({ host: one.host, home: one.home })),
    page:
      page === null
        ? null
        : {
            slug: text(page['slug']),
            state: text(page['state']),
            addresses: (Array.isArray(page['addresses']) ? page['addresses'] : []).map(addressOf).filter((one): one is PageAddress => one !== null),
            canonical: text(page['canonical']),
            homeOf: Array.isArray(page['homeOf']) ? page['homeOf'].filter((one): one is string => typeof one === 'string') : [],
          },
  };
}

export async function readStatus(page: string): Promise<LandingStatus | null> {
  return statusOf(await api.get<unknown>(statusPath(page)));
}

/* ── pictures ───────────────────────────────────────────────────────────── */

/** A file of Files (one the person may read) kept as the page's own cleaned copy: its id, which the page names. */
export async function keepPicture(page: string, file: string): Promise<string> {
  const data = dataOf(await api.post<unknown>(picturesPath(page), { file }));
  const id = isRecord(data) ? text(data['id']) : null;
  if (id === null) throw new Error('The picture was not kept.');
  return id;
}

/** A picture in Files, as the chooser lists it. */
export interface LibraryPicture {
  id: string;
  filename: string;
  mime: string;
  /** Where its thumbnail is read. */
  src: string;
}

export function filesOf(reply: unknown): LibraryPicture[] {
  const list = isRecord(reply) && Array.isArray(reply['data']) ? reply['data'] : [];
  return list
    .filter(isRecord)
    .filter((one) => typeof one['id'] === 'string' && typeof one['contentPath'] === 'string' && PICTURE_MIMES.includes(String(one['mime'])) && one['deletedAt'] == null)
    .map((one) => ({ id: one['id'] as string, filename: text(one['filename']) ?? (one['id'] as string), mime: String(one['mime']), src: `${one['contentPath'] as string}${(one['contentPath'] as string).includes('?') ? '&' : '?'}inline=true` }));
}

export async function readFiles(q: string): Promise<LibraryPicture[]> {
  return filesOf(await api.get<unknown>(filesPath(q)));
}

/** Whether a chosen file can be a page's picture before it is sent: its type and its size, as the server judges them again. */
export function pictureFits(file: { type: string; size: number }): boolean {
  return PICTURE_MIMES.includes(file.type) && file.size > 0 && file.size <= PICTURE_MAX_BYTES;
}

/* ── Milo's draft ───────────────────────────────────────────────────────── */

export type LeftOut = { what: 'quote' | 'picture' | 'form'; block: string } | { what: 'link' | 'page-link'; block: string; label: string };

export interface Drafted {
  /** The page document Milo wrote: every section marked. */
  page: unknown;
  left: readonly LeftOut[];
}

export function draftedOf(reply: unknown): Drafted | null {
  const data = dataOf(reply);
  if (!isRecord(data) || !isRecord(data['page'])) return null;
  const left = (Array.isArray(data['left']) ? data['left'] : []).filter(isRecord).flatMap((one): LeftOut[] => {
    const block = text(one['block']) ?? '';
    if (one['what'] === 'quote' || one['what'] === 'picture' || one['what'] === 'form') return [{ what: one['what'], block }];
    if (one['what'] === 'link' || one['what'] === 'page-link') return [{ what: one['what'], block, label: text(one['label']) ?? '' }];
    return [];
  });
  return { page: data['page'], left };
}

export async function askDraft(input: { description: string; language: string; pageKey: string }): Promise<Drafted> {
  const drafted = draftedOf(await api.post<unknown>(DRAFT_PATH, input));
  if (drafted === null) throw new Error('Milo’s draft could not be read.');
  return drafted;
}

/* ── the live forms ─────────────────────────────────────────────────────── */

export type FormEnding = { kind: 'words' } | { kind: 'page'; url: string } | { kind: 'landing'; page: string; broken: boolean };

export interface LiveForm {
  addOn: string;
  key: string;
  name: string;
  slug: string;
  languages: readonly string[];
  ending: FormEnding;
}

function endingOf(value: unknown): FormEnding {
  if (isRecord(value) && value['kind'] === 'page' && typeof value['url'] === 'string') return { kind: 'page', url: value['url'] };
  if (isRecord(value) && value['kind'] === 'landing' && typeof value['page'] === 'string') return { kind: 'landing', page: value['page'], broken: value['broken'] === true };
  return { kind: 'words' };
}

export function formsOf(reply: unknown): LiveForm[] {
  const data = dataOf(reply);
  const list = isRecord(data) && Array.isArray(data['forms']) ? data['forms'] : [];
  return list.filter(isRecord).flatMap((one): LiveForm[] => {
    const addOn = text(one['addOn']);
    const key = text(one['key']);
    if (addOn === null || key === null) return [];
    return [{ addOn, key, name: text(one['name']) ?? key, slug: text(one['slug']) ?? '', languages: Array.isArray(one['languages']) ? one['languages'].filter((tag): tag is string => typeof tag === 'string') : [], ending: endingOf(one['ending']) }];
  });
}

export async function readLiveForms(): Promise<LiveForm[]> {
  return formsOf(await api.get<unknown>(FORMS_PATH));
}

/** Whether a form is written in the page's language: a form with no version in it is left off the page for strangers. */
export function formSpeaks(form: LiveForm, language: string): boolean {
  const base = language.split('-')[0] ?? language;
  return form.languages.some((tag) => tag === language || tag === base || tag.split('-')[0] === base);
}

/* ── a pages host's home ────────────────────────────────────────────────── */

/** The whole map of mapped hosts, as the domains editor round-trips it; null for someone who may not change it. */
export async function readDomains(): Promise<Record<string, unknown> | null> {
  try {
    const reply = await api.get<unknown>(SURFACES_PATH);
    return isRecord(reply) && isRecord(reply['domains']) ? reply['domains'] : null;
  } catch {
    return null;
  }
}

/**
 * Make the page at `slug` the home of `host`: the whole map read, that one
 * host's home changed, and the whole map saved back, as the domains editor
 * saves it. Nothing else in the map changes.
 */
export async function makeHome(host: string, slug: string): Promise<void> {
  const domains = await readDomains();
  if (domains === null) throw new Error('The hosts could not be read.');
  // The status names a host as the engine normalises it; the map keeps it as it was typed.
  const named = Object.keys(domains).find((one) => one.toLowerCase().replace(/\.$/, '') === host.toLowerCase());
  const target = named === undefined ? undefined : domains[named];
  if (named === undefined || !isRecord(target) || target['kind'] !== 'pages') throw new Error(`${host} is not a pages host.`);
  await api.put<unknown>(DOMAINS_PATH, { domains: { ...domains, [named]: { ...target, home: `/x/pages/${slug}` } } });
}
