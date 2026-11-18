/**
 * A PAGE'S ROW, READ ONCE FOR THE EDITOR.
 *
 * The pages table holds the working copy and the published copy as JSON, and
 * a database hands a JSON column back as text or as an object depending on
 * which one it is; this reads either. Nothing here holds a draft to the
 * vocabulary (`doc.ts` reads it leniently).
 */
import type { DataRow } from '../shared/host.ts';
import { LOCALE_TAGS } from '../strings/index.ts';
import type { PageRow } from './store.ts';

const textOf = (value: unknown): string => (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '');

/** The eight languages a page may be written in: the languages Adminium itself speaks. */
export const PAGE_LANGUAGES: readonly string[] = LOCALE_TAGS;

/** The language a new page starts in: the person's own, when it is one of the eight, else English. */
export function startingLanguage(locale: string): string {
  if (PAGE_LANGUAGES.includes(locale)) return locale;
  const base = locale.split('-')[0];
  return PAGE_LANGUAGES.find((tag) => tag.split('-')[0] === base) ?? 'en-US';
}

/** Whether a language is written right to left. */
export const isRightToLeft = (tag: string): boolean => tag.split('-')[0] === 'ar';

/** A language's own name ("English", "Deutsch", "العربية"), as the language writes itself. */
export function languageName(tag: string): string {
  const asked = tag === 'zh-CN' ? 'zh-Hans' : tag === 'zh-TW' ? 'zh-Hant' : (tag.split('-')[0] ?? tag);
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(asked);
    return name === undefined || name === asked ? tag : name.charAt(0).toLocaleUpperCase(tag) + name.slice(1);
  } catch {
    return tag;
  }
}

export function pageRowOf(row: DataRow): PageRow {
  const state = row['state'];
  return {
    key: textOf(row['id']),
    name: textOf(row['name']),
    slug: textOf(row['slug']),
    state: state === 'live' || state === 'off' ? state : 'draft',
    language: textOf(row['language']) === '' ? 'en-US' : textOf(row['language']),
    draft: row['draft'] ?? null,
    published: row['published'] ?? null,
    publishedAt: textOf(row['published_at']) === '' ? null : textOf(row['published_at']),
  };
}
