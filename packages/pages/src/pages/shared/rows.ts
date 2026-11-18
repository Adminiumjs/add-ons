/**
 * THE ROWS, AS THE SCREENS READ THEM.
 *
 * A page row and a funnel row come from the kit as loose values; these read
 * them into the shapes the screens draw, leniently: a value of the wrong kind
 * is read as empty, never thrown on. A funnel's steps are checked here, on
 * read, because nothing else can check them: a step names a row of another
 * table (or of another add-on) that may have gone since.
 *
 * Pure: no I/O.
 */
import type { DataRow, DataValue } from './host.ts';

export const PAGE_STATES = ['draft', 'live', 'off'] as const;
export type PageState = (typeof PAGE_STATES)[number];

/** The most steps one funnel holds: Adminium's own cap (`LANDING_FUNNEL_STEPS_MAX`). */
export const FUNNEL_STEPS_MAX = 8;

/** The columns the list reads of a page. */
export const PAGE_LIST_COLUMNS = ['id', 'name', 'slug', 'state', 'language', 'draft', 'published', 'updated_at'] as const;
/** The columns a funnel is read with. */
export const FUNNEL_COLUMNS = ['id', 'name', 'steps', 'rule_id'] as const;

export interface PageRow {
  key: string;
  name: string;
  slug: string;
  state: PageState;
  language: string;
  /** The main heading strangers see (or will see), for the card's little picture of the page. */
  heading: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const textOf = (value: DataValue | undefined): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');
/** A json column as the kit hands it: parsed already, or still the text of it. */
export function jsonOf(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

/** A json value as a column takes it: the kit sends it as it is. */
export const asJson = (value: unknown): DataValue => value as DataValue;

/** A row's key as text, whatever its column held. */
export const rowKey = (row: DataRow): string => textOf(row['id']);

/**
 * The main heading of a page document, read without holding the whole
 * document to the vocabulary: the first Hero's heading, else the first
 * Heading, else the title. The list only shows it; the editor checks it.
 */
export function headingOf(document: unknown): string {
  const doc = isRecord(document) ? document : {};
  const blocks = Array.isArray(doc['blocks']) ? doc['blocks'].filter(isRecord) : [];
  const hero = blocks.find((block) => block['kind'] === 'hero' && typeof block['heading'] === 'string');
  if (hero !== undefined) return hero['heading'] as string;
  const heading = blocks.find((block) => block['kind'] === 'heading' && typeof block['text'] === 'string');
  if (heading !== undefined) return heading['text'] as string;
  return typeof doc['title'] === 'string' ? doc['title'] : '';
}

export function pageRowOf(row: DataRow): PageRow {
  const state = PAGE_STATES.find((one) => one === row['state']) ?? 'draft';
  // What strangers see is the published copy; a draft is what it will be.
  const shown = state === 'draft' ? jsonOf(row['draft']) : (jsonOf(row['published']) ?? jsonOf(row['draft']));
  return { key: rowKey(row), name: textOf(row['name']), slug: textOf(row['slug']), state, language: textOf(row['language']), heading: headingOf(shown) };
}

/** A page's path on any host: `/x/pages/<slug>`. */
export const pagePath = (slug: string): string => `/x/pages/${slug}`;

/** A page's full address, on the install's public address when Adminium says what it is. */
export const pageAddress = (origin: string | null, slug: string): string => `${origin === null ? '' : origin.replace(/\/+$/, '')}${pagePath(slug)}`;

/* ── funnels ────────────────────────────────────────────────────────────── */

/** One step: a landing page of this add-on, or a form of a forms add-on (by its key there). */
export type Step = { kind: 'page'; key: string } | { kind: 'form'; key: string; addOn: string | null };

export interface FunnelRow {
  key: string;
  name: string;
  steps: Step[];
  ruleId: string | null;
}

const keyText = (value: unknown): string | null => (typeof value === 'number' && Number.isInteger(value) ? String(value) : typeof value === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(value) ? value : null);

/** A funnel's steps, as stored: anything that is not a step is left out, and no more than eight are read. */
export function stepsOf(value: unknown): Step[] {
  const list = jsonOf(value);
  if (!Array.isArray(list)) return [];
  return list
    .flatMap((one): Step[] => {
      if (!isRecord(one)) return [];
      const key = keyText(one['key']);
      if (key === null) return [];
      if (one['kind'] === 'page') return [{ kind: 'page', key }];
      if (one['kind'] === 'form') return [{ kind: 'form', key, addOn: typeof one['addOn'] === 'string' && one['addOn'] !== '' ? one['addOn'] : null }];
      return [];
    })
    .slice(0, FUNNEL_STEPS_MAX);
}

/** A funnel's steps as they are stored: a form's add-on only where it is known. */
export const storedSteps = (steps: readonly Step[]): Record<string, string>[] =>
  steps.slice(0, FUNNEL_STEPS_MAX).map((step): Record<string, string> => (step.kind === 'page' ? { kind: 'page', key: step.key } : step.addOn === null ? { kind: 'form', key: step.key } : { kind: 'form', key: step.key, addOn: step.addOn }));

export function funnelRowOf(row: DataRow): FunnelRow {
  const rule = row['rule_id'];
  return { key: rowKey(row), name: textOf(row['name']), steps: stepsOf(row['steps']), ruleId: typeof rule === 'string' && rule !== '' ? rule : null };
}

/** Whether two steps name the same row. */
export const sameStep = (a: Step, b: Step): boolean => a.kind === b.kind && a.key === b.key && (a.kind === 'page' || b.kind === 'page' || a.addOn === null || b.addOn === null || a.addOn === b.addOn);
