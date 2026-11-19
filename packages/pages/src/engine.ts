/**
 * ADMINIUM'S OWN ROUTES THE SCREENS CALL, IN ONE PLACE.
 *
 * The add-on's tables are read and written through the kit. What the kit
 * cannot give is asked of Adminium's own staff routes, and each is called
 * from here and nowhere else:
 *
 * - `GET /api/v1/landing/<add-on>/status`: whether visitors can reach the
 *   pages, whether the privacy notice is set, the public address, the pages
 *   hosts and (for one page) its address on each;
 * - `GET /api/v1/views`: how many views strangers made of some pages or forms,
 *   per day, with the counting level and the day counting started;
 * - `GET /api/v1/landing/<add-on>/forms`: every live form of every forms
 *   add-on the person may read;
 * - `GET /api/v1/landing/<add-on>/funnels/<key>/rule`: the name and steps of
 *   the rule linked to a funnel, and whether the person may open it;
 * - `GET /api/v1/automations`: the rules, to pick one for a funnel (only for
 *   someone who manages rules: anyone else is refused, and told so);
 * - `GET /api/v1/add-ons`: an add-on's install id, which the views route takes.
 *
 * Every landing route names the copy of the add-on the page is open for
 * (`install.ts`).
 *
 * Every answer is read leniently: a field that is missing or of another kind
 * is read as "not known", never thrown on, so a screen says less rather than
 * breaking when a route grows. Each reader is a plain function of the `api`
 * it is handed, so the tests hand it a fake.
 */

import { landingPath } from './install.ts';

/** The part of the dashboard's `api` these reads use. */
export interface EngineApi {
  get: (path: string) => Promise<unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const flag = (value: unknown): boolean | null => (typeof value === 'boolean' ? value : null);
/** The `data` a route answers with, or the answer itself when it has none. */
const dataOf = (answer: unknown): unknown => (isRecord(answer) && 'data' in answer ? answer['data'] : answer);
/** A key as the routes write it: a row key is a number or digits. */
const keyOf = (value: unknown): string | null => (typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' && value !== '' ? value : null);

/* ── the status ─────────────────────────────────────────────────────────── */

/** A host mapped to the add-on's pages, and the page its `/` opens on (`/x/pages/<slug>`). */
export interface PagesHost {
  host: string;
  home: string;
}

/** What the status read says. Each part is null while Adminium does not say it. */
export interface LandingStatus {
  /** The add-on's install, which the views route takes. */
  installId: string | null;
  /** Whether the privacy notice is set: publishing waits for it. */
  notice: boolean | null;
  /** Whether visitors can reach the pages (`reachable`, or the reach words' code), and whether a proxy is unchecked. */
  reach: { state: string; proxyUnchecked: boolean } | null;
  /** The install's public address, the start of every page's address. */
  publicOrigin: string | null;
  /** The business's time zone: a day of counts is a day there. */
  timeZone: string | null;
  /** How many months view counts are kept (the privacy settings' "View counts" row). */
  viewCountsMonths: number | null;
  hosts: PagesHost[];
}

export function statusOf(answer: unknown): LandingStatus {
  const data = dataOf(answer);
  const d = isRecord(data) ? data : {};
  const reach = isRecord(d['reach']) && typeof d['reach']['state'] === 'string' ? { state: d['reach']['state'], proxyUnchecked: d['reach']['proxyUnchecked'] === true } : null;
  const hosts = (Array.isArray(d['hosts']) ? d['hosts'] : []).flatMap((one): PagesHost[] => (isRecord(one) && typeof one['host'] === 'string' && typeof one['home'] === 'string' ? [{ host: one['host'], home: one['home'] }] : []));
  return {
    installId: keyOf(d['installId']),
    notice: flag(d['notice']),
    reach,
    publicOrigin: text(d['publicOrigin']),
    timeZone: text(d['timeZone']),
    viewCountsMonths: typeof d['viewCountsMonths'] === 'number' && Number.isInteger(d['viewCountsMonths']) && d['viewCountsMonths'] > 0 ? d['viewCountsMonths'] : null,
    hosts,
  };
}

/** The status, and for one page its address on each host. */
export async function readStatus(api: EngineApi, addOn: string, page?: string): Promise<LandingStatus> {
  const query = page === undefined ? '' : `?page=${encodeURIComponent(page)}`;
  return statusOf(await api.get(landingPath(`/api/v1/landing/${encodeURIComponent(addOn)}/status${query}`)));
}

/* ── view counts ────────────────────────────────────────────────────────── */

/** What is counted: a landing page, a form's own page, a form coming into view on a page, a form sent. */
export const VIEW_KINDS = ['page', 'form-page', 'form-opened', 'form-sent'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];
/** How much Adminium counts: nothing, views only, or which pages a visitor who said yes saw. */
export type CountingLevel = 'off' | 'counts' | 'visitor';
/** The most things one views read names: the route's own cap. */
export const VIEWS_THINGS_MAX = 50;

export interface ViewDay {
  day: string;
  place: string;
  views: number;
}

export interface ViewCounts {
  level: CountingLevel | null;
  /** When counting started, as milliseconds; null when Adminium does not say. */
  countingSince: number | null;
  /** Each thing's days that had views; a thing with none has none. */
  days: ReadonlyMap<string, readonly ViewDay[]>;
}

export interface ViewsQuery {
  installId: string;
  kind: ViewKind;
  things: readonly string[];
  /** First and last day, both included, as `YYYY-MM-DD`. */
  from: string;
  to: string;
  /** A form's counts on one page only. */
  place?: string;
}

const LEVELS: readonly CountingLevel[] = ['off', 'counts', 'visitor'];

export function viewCountsOf(answer: unknown): ViewCounts {
  const data = dataOf(answer);
  const d = isRecord(data) ? data : {};
  const level = LEVELS.find((one) => one === d['level']) ?? null;
  const since = d['countingSince'];
  const days = new Map<string, ViewDay[]>();
  for (const one of Array.isArray(d['things']) ? d['things'] : []) {
    if (!isRecord(one)) continue;
    const thing = keyOf(one['thing']);
    if (thing === null) continue;
    const list = (Array.isArray(one['days']) ? one['days'] : []).flatMap((day): ViewDay[] =>
      isRecord(day) && typeof day['day'] === 'string' && typeof day['views'] === 'number' && Number.isFinite(day['views']) ? [{ day: day['day'], place: typeof day['place'] === 'string' ? day['place'] : '', views: day['views'] }] : [],
    );
    days.set(thing, [...(days.get(thing) ?? []), ...list]);
  }
  return { level, countingSince: typeof since === 'number' && Number.isFinite(since) ? since : typeof since === 'string' && !Number.isNaN(Date.parse(since)) ? Date.parse(since) : null, days };
}

/** Views of some things: one read per fifty things, put back together. */
export async function readViews(api: EngineApi, query: ViewsQuery): Promise<ViewCounts> {
  const things = [...new Set(query.things)];
  const parts: ViewCounts[] = [];
  // Nothing to count asks nothing.
  for (let at = 0; at < things.length; at += VIEWS_THINGS_MAX) {
    const some = things.slice(at, at + VIEWS_THINGS_MAX);
    const search = new URLSearchParams({ installId: query.installId, kind: query.kind, things: some.join(','), from: query.from, to: query.to });
    if (query.place !== undefined) search.set('place', query.place);
    parts.push(viewCountsOf(await api.get(`/api/v1/views?${search.toString()}`)));
  }
  const days = new Map<string, readonly ViewDay[]>();
  for (const part of parts) for (const [thing, list] of part.days) days.set(thing, [...(days.get(thing) ?? []), ...list]);
  return { level: parts[0]?.level ?? null, countingSince: parts[0]?.countingSince ?? null, days };
}

/** A thing's views over the days read, every place added up. */
export const totalOf = (counts: ViewCounts, thing: string): number => (counts.days.get(thing) ?? []).reduce((sum, day) => sum + day.views, 0);

/* ── live forms ─────────────────────────────────────────────────────────── */

/** A live form of one of the forms add-ons, as the Form block and a funnel's steps name it. */
export interface LiveForm {
  /** The forms add-on's key. */
  addOn: string;
  /** The form's row key in that add-on's forms table. */
  key: string;
  name: string;
  slug: string;
  /** The languages the form has a version in. */
  languages: string[];
  /** The form's ending as stored; read only. */
  ending: unknown;
  /** The forms add-on's install, when the read names it. */
  installId: string | null;
}

export function liveFormsOf(answer: unknown): LiveForm[] {
  const data = dataOf(answer);
  const list = Array.isArray(data) ? data : isRecord(data) && Array.isArray(data['forms']) ? data['forms'] : [];
  return list.flatMap((one): LiveForm[] => {
    if (!isRecord(one)) return [];
    const addOn = text(one['addOn']);
    const key = keyOf(one['key']);
    if (addOn === null || key === null) return [];
    return [
      {
        addOn,
        key,
        name: text(one['name']) ?? '',
        slug: text(one['slug']) ?? '',
        languages: (Array.isArray(one['languages']) ? one['languages'] : []).filter((tag): tag is string => typeof tag === 'string'),
        ending: one['ending'] ?? null,
        installId: keyOf(one['installId']),
      },
    ];
  });
}

export async function readLiveForms(api: EngineApi, addOn: string): Promise<LiveForm[]> {
  return liveFormsOf(await api.get(landingPath(`/api/v1/landing/${encodeURIComponent(addOn)}/forms`)));
}

/* ── a funnel's rule ────────────────────────────────────────────────────── */

/** One step of a rule as a chip: its words and the icon its kind is drawn with. */
export interface RuleChip {
  words: string;
  icon: string | null;
}

/** The rule linked to a funnel: none, one that was removed, or its name and steps. */
export type FunnelRule = { state: 'none' } | { state: 'removed' } | { state: 'linked'; id: string | null; name: string; chips: RuleChip[]; canOpen: boolean };

/**
 * The icon a chip is drawn with, by the step's kind as the rule read names it
 * (`trigger`, `action`, `condition`, `wait`, `branch`, `stop`) and, for an
 * action, what it does: an e-mail and a notification have their own.
 */
export function chipIconOf(kind: unknown, action: unknown): string | null {
  switch (kind) {
    case 'trigger':
      return 'zap';
    case 'action':
      return action === 'email' ? 'mail' : action === 'notification' ? 'bell' : 'play';
    case 'condition':
      return 'filter';
    case 'wait':
      return 'hourglass';
    case 'branch':
      return 'git-branch';
    case 'stop':
      return 'circle-stop';
    default:
      return null;
  }
}

/**
 * The rule read: `{ state: 'none' }`, `{ state: 'removed' }`, or
 * `{ state: 'linked', name, enabled, chips: [{ kind, title, … }], canOpen,
 * ruleId? }`, the id only for someone who may open the rule.
 */
export function funnelRuleOf(answer: unknown): FunnelRule {
  const data = dataOf(answer);
  if (!isRecord(data)) return { state: 'none' };
  if (data['state'] === 'removed') return { state: 'removed' };
  const name = text(data['name']);
  if (data['state'] !== 'linked' || name === null) return { state: 'none' };
  const chips = (Array.isArray(data['chips']) ? data['chips'] : []).flatMap((one): RuleChip[] => {
    if (!isRecord(one)) return [];
    const words = text(one['title']);
    return words === null || words.trim() === '' ? [] : [{ words, icon: chipIconOf(one['kind'], one['action']) }];
  });
  const canOpen = data['canOpen'] === true;
  return { state: 'linked', id: canOpen ? keyOf(data['ruleId']) : null, name, chips, canOpen };
}

export async function readFunnelRule(api: EngineApi, addOn: string, funnel: string): Promise<FunnelRule> {
  return funnelRuleOf(await api.get(landingPath(`/api/v1/landing/${encodeURIComponent(addOn)}/funnels/${encodeURIComponent(funnel)}/rule`)));
}

/* ── the rules, to pick one ─────────────────────────────────────────────── */

export interface RuleChoice {
  id: string;
  name: string;
}

export function rulesOf(answer: unknown): RuleChoice[] {
  const list = isRecord(answer) && Array.isArray(answer['rules']) ? answer['rules'] : [];
  return list.flatMap((one): RuleChoice[] => (isRecord(one) && keyOf(one['id']) !== null && typeof one['name'] === 'string' ? [{ id: keyOf(one['id'])!, name: one['name'] }] : []));
}

/** Every rule, for someone who manages rules; null for anyone else (Adminium refuses them the list). */
export async function readRules(api: EngineApi): Promise<RuleChoice[] | null> {
  try {
    return rulesOf(await api.get('/api/v1/automations'));
  } catch {
    return null;
  }
}

/* ── install ids ────────────────────────────────────────────────────────── */

/** Each installed add-on's install id by its key, as far as the person may see them: the first copy of each. */
export function installIdsOf(answer: unknown): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  const list = isRecord(answer) && Array.isArray(answer['addOns']) ? answer['addOns'] : [];
  for (const one of list) {
    if (!isRecord(one) || typeof one['key'] !== 'string') continue;
    const id = keyOf(one['installId']);
    if (id !== null && !out.has(one['key'])) out.set(one['key'], id);
  }
  return out;
}

export async function readInstallIds(api: EngineApi): Promise<ReadonlyMap<string, string>> {
  return installIdsOf(await api.get('/api/v1/add-ons'));
}
