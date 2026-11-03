/**
 * A FORM'S ROW, READ ONCE FOR EVERY SCREEN.
 *
 * The forms table holds the definition and the settings as JSON. A database
 * hands a JSON column back as text or as an object, depending on which one it
 * is, so every screen reads a row through `formRowOf` and never a column
 * directly. Nothing here parses a definition against the vocabulary: a draft
 * may be half made, and only publishing holds it to `parseForm`.
 */
import type { DataRow, DataValue } from './host.ts';
import type { Kind } from './paths.ts';

export type FormState = 'draft' | 'live' | 'closed';

/** What a definition says that the list and the frame read, whatever else it holds. */
export interface DefinitionGlance {
  languages: string[];
  defaultLanguage: string | null;
  title: Readonly<Record<string, string>>;
  questions: number;
}

export interface FormRow {
  id: string;
  slug: string;
  kind: Kind;
  state: FormState;
  /** The title in the form's own default language, kept beside the definition for lists and notices. */
  name: string;
  /** As stored: a draft may not parse. */
  definition: unknown;
  settings: unknown;
  published: unknown;
  publishedAt: string | null;
  updatedAt: string | null;
  closedAt: string | null;
  /** The row as the data kit handed it. */
  row: DataRow;
}

/** A JSON column's value as an object, whichever way the database handed it back. */
export function jsonOf(value: unknown): unknown {
  if (typeof value !== 'string') return value ?? null;
  const text = value.trim();
  if (text === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/** An object written to a JSON column: the data kit takes it as it is. */
export const asJson = (value: unknown): DataValue => value as DataValue;

const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : null);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function formRowOf(row: DataRow): FormRow {
  const state = row['state'];
  return {
    id: String(row['id']),
    slug: textOf(row['slug']) ?? '',
    kind: row['kind'] === 'survey' ? 'survey' : 'form',
    state: state === 'live' || state === 'closed' ? state : 'draft',
    name: textOf(row['name']) ?? '',
    definition: jsonOf(row['definition']),
    settings: jsonOf(row['settings']),
    published: jsonOf(row['published']),
    publishedAt: textOf(row['published_at']),
    updatedAt: textOf(row['updated_at']),
    closedAt: textOf(row['closed_at']),
    row,
  };
}

/** The few things the list and the frame read of a definition, read leniently. */
export function glanceOf(definition: unknown): DefinitionGlance {
  if (!isRecord(definition)) return { languages: [], defaultLanguage: null, title: {}, questions: 0 };
  const languages = Array.isArray(definition['languages']) ? definition['languages'].filter((one): one is string => typeof one === 'string') : [];
  const title = isRecord(definition['title']) ? Object.fromEntries(Object.entries(definition['title']).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) : {};
  return {
    languages,
    defaultLanguage: typeof definition['defaultLanguage'] === 'string' ? definition['defaultLanguage'] : (languages[0] ?? null),
    title,
    questions: Array.isArray(definition['questions']) ? definition['questions'].length : 0,
  };
}

/** The name a person reads: the title in their language where the form has one, else the form's own. */
export function titleOf(form: Pick<FormRow, 'name' | 'definition'>, locale: string): string {
  const glance = glanceOf(form.definition);
  return glance.title[locale] ?? (glance.defaultLanguage === null ? undefined : glance.title[glance.defaultLanguage]) ?? form.name;
}

/** A language's short code on a chip: `EN`, `DE`; Chinese keeps its script (`ZH-CN`, `ZH-TW`). */
export const codeOf = (tag: string): string => (tag.startsWith('zh-') ? tag : (tag.split('-')[0] ?? tag)).toUpperCase();

/** A survey that keeps no names: its answers are counted, never sent to a person. */
export function isAnonymous(settings: unknown): boolean {
  return isRecord(settings) && isRecord(settings['survey']) && settings['survey']['mode'] === 'anonymous';
}

/** A moment the data kit handed back, as milliseconds; null when there is none. */
export function epochOf(value: string | null): number | null {
  if (value === null) return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : at;
}
