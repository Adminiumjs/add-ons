/**
 * The comps' pages, forms and funnel, as the screens' tests seed them, and a
 * stand-in Adminium that answers the routes `engine.ts` calls.
 */
import type { Call } from './host.tsx';

const doc = (heading: string) => ({ v: 1, title: heading, description: heading, blocks: [{ id: 'hero', kind: 'hero', heading }] });

/** The comp's four pages (1a): two live, a draft, one switched off. */
export const PAGES = [
  { id: 1, name: 'Showroom open day', slug: 'open-day', state: 'live', language: 'en-US', draft: doc('Open day at our Leeds showroom'), published: doc('Open day at our Leeds showroom'), updated_at: '2026-07-20T10:00:00Z' },
  { id: 2, name: 'Acoustic booths', slug: 'acoustic-booths', state: 'live', language: 'en-US', draft: doc('Booths that cut noise by half'), published: doc('Booths that cut noise by half'), updated_at: '2026-07-19T10:00:00Z' },
  { id: 3, name: 'Spring open day', slug: 'spring-open-day', state: 'draft', language: 'en-US', draft: doc('Spring open day at our Leeds showroom'), published: null, updated_at: '2026-07-18T10:00:00Z' },
  { id: 4, name: 'Spring offer', slug: 'spring-offer', state: 'off', language: 'en-US', draft: doc('Acoustic booths, fitted this spring'), published: doc('Acoustic booths, fitted this spring'), updated_at: '2026-07-17T10:00:00Z' },
  { id: 5, name: 'Thanks, see you there', slug: 'thanks-open-day', state: 'live', language: 'en-US', draft: doc('Thanks, see you there'), published: doc('Thanks, see you there'), updated_at: '2026-07-16T10:00:00Z' },
];

/** The one live form of the comps, in the Forms add-on. */
export const FORMS = [{ addOn: 'forms', key: '7', name: 'Book a showroom visit', slug: 'book-a-visit', languages: ['en-US'], ending: { kind: 'landing', page: '5', addOn: 'pages', broken: false }, installId: 'install-forms' }];

/** The comp's funnel "Open day": page → form → thanks page. */
export const FUNNEL = { id: 11, name: 'Open day', steps: [{ kind: 'page', key: '1' }, { kind: 'form', key: '7', addOn: 'forms' }, { kind: 'page', key: '5' }], rule_id: 'rule-brochure' };

export const STATUS = { data: { installId: 'install-pages', notice: true, reach: { state: 'reachable', proxyUnchecked: false }, publicOrigin: 'https://crm.meridian.example', timeZone: 'Europe/London', viewCountsMonths: 13, hosts: [] } };
export const ADD_ONS = { addOns: [{ key: 'pages', installId: 'install-pages' }, { key: 'forms', installId: 'install-forms' }] };

/** The comp's counts (5): 1,240 → 310 → 96 → 94, and 412 for the booths. */
export const COUNTS: Record<string, Record<string, number>> = {
  'page|': { '1': 1240, '2': 412, '4': 0, '5': 94 },
  'form-opened|1': { '7': 310 },
  'form-sent|1': { '7': 96 },
};

/** The rule read, as Adminium answers it for someone who manages rules. */
export const RULE = {
  data: {
    state: 'linked',
    name: 'Brochure follow-up',
    enabled: true,
    canOpen: true,
    ruleId: 'rule-brochure',
    chips: [
      { kind: 'trigger', title: 'Form sent', on: 'record', event: 'created' },
      { kind: 'action', title: 'E-mail the brochure', action: 'email' },
      { kind: 'wait', title: 'Wait 2 days', amount: 2, unit: 'days' },
      { kind: 'branch', title: 'If no deal yet, a follow-up for the rep' },
    ],
  },
};

/** The kit's read: the database the add-on's tables are on. */
export const KIT = { connectionId: 'conn-crm', tables: {}, hosts: [], has: {}, currency: null };

export interface Adminium {
  level?: 'off' | 'counts' | 'visitor';
  countingSince?: number | null;
  counts?: Record<string, Record<string, number>>;
  rule?: unknown;
  /** The rules list; null refuses it (someone who does not manage rules). */
  rules?: { id: string; name: string }[] | null;
  forms?: unknown[];
  status?: unknown;
}

/** Answers what `engine.ts` asks, as Adminium would; anything else is an empty answer. */
export function adminium(said: Adminium = {}): (method: string, path: string) => unknown {
  return (method, path) => {
    if (method !== 'get') return {};
    const url = new URL(path, 'https://crm.example');
    if (url.pathname === '/api/v1/landing/pages/status') return said.status ?? STATUS;
    if (url.pathname === '/api/v1/add-ons') return ADD_ONS;
    if (url.pathname === '/api/v1/add-ons/pages/kit') return KIT;
    if (url.pathname === '/api/v1/landing/pages/forms') return { data: said.forms ?? FORMS };
    if (url.pathname.startsWith('/api/v1/landing/pages/funnels/')) return said.rule ?? RULE;
    if (url.pathname === '/api/v1/automations') {
      if (said.rules === null) throw Object.assign(new Error('forbidden'), { code: 'FORBIDDEN' });
      return { rules: said.rules ?? [{ id: 'rule-brochure', name: 'Brochure follow-up' }, { id: 'rule-thanks', name: 'Thank the visitor' }] };
    }
    if (url.pathname === '/api/v1/views') {
      const kind = url.searchParams.get('kind') ?? '';
      const place = url.searchParams.get('place') ?? '';
      const table = (said.counts ?? COUNTS)[`${kind}|${place}`] ?? {};
      const things = (url.searchParams.get('things') ?? '').split(',');
      return { data: { level: said.level ?? 'counts', countingSince: said.countingSince ?? null, things: things.map((thing) => ({ thing, days: table[thing] === undefined ? [] : [{ day: url.searchParams.get('to'), place, views: table[thing] }] })) } };
    }
    return {};
  };
}

/** The views reads a screen made, as `kind|place|things`. */
export const viewsAsked = (calls: readonly Call[]): string[] =>
  calls
    .filter((call) => call.kind === 'api' && call.table.startsWith('get /api/v1/views'))
    .map((call) => {
      const url = new URL(call.table.slice(4), 'https://crm.example');
      return `${url.searchParams.get('kind') ?? ''}|${url.searchParams.get('place') ?? ''}|${url.searchParams.get('things') ?? ''}`;
    });
