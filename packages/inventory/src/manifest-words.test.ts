/**
 * THE MANIFEST'S WORDS, IN EIGHT LANGUAGES.
 *
 * The manifest is where a reader's screen gets a table's name, a column's
 * heading, a status, a button, a card's title and an email's sentences — and
 * Adminium reads each for the reader's own language tag, exactly, falling
 * back to English. So every text is there eight times or it is English to
 * somebody. This suite holds the manifest to its dictionaries
 * (`scripts/manifest-words.mjs`), and the dictionaries to the rules a
 * translation has to keep.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error a plain script, read as it runs
import { LOCALES, MANIFEST, dictionaries, listed, worded } from '../scripts/manifest-words.mjs';
import { COLUMNS, TABLES, VALUES } from './i18n/labels.ts';
import { bannedHitsIn } from './testing/lexicon.ts';

type Words = Record<string, string>;
const TAGS = LOCALES as string[];
const OTHERS = TAGS.slice(1);
const source = readFileSync(MANIFEST as string, 'utf8');
const dictionary = dictionaries() as Record<string, Words>;
// Read from the manifest as the script leaves it, so the suite says the same before and after a run of it.
const texts = listed((worded(source) as { manifest: unknown }).manifest) as Map<string, string[]>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
/** Every map of languages in the manifest, with where it stands. */
function maps(node: unknown, path: string, out: [string, Words][] = []): [string, Words][] {
  if (Array.isArray(node)) node.forEach((entry, n) => maps(entry, `${path}[${String(n)}]`, out));
  else if (isRecord(node)) {
    if (typeof node['en-US'] === 'string') out.push([path, node as Words]);
    else for (const [key, value] of Object.entries(node)) maps(value, `${path}.${key}`, out);
  }
  return out;
}
const placeholders = (text: string): string[] => [...text.matchAll(/\{\{[^}]*\}\}|\{[a-z]+\}/g)].map((found) => found[0]).sort();

describe('the manifest\'s words', () => {
  it('are what the names and the dictionaries say (run `node scripts/manifest-words.mjs` when behind)', () => {
    const { text, untold } = worded(source) as { text: string; untold: Map<string, string[]> };
    expect([...untold].map(([locale, keys]) => `${locale}: ${keys.slice(0, 5).join(' · ')}`)).toEqual([]);
    expect(text === source, 'manifest.json is behind its words').toBe(true);
  });

  it('every text said in several languages is said in all eight', () => {
    const found = maps(manifest, '');
    expect(found.length).toBeGreaterThan(600);
    for (const [path, words] of found) expect(Object.keys(words), path).toEqual(TAGS);
  });

  it('every table, column and choice has a name, and no name is written for one that is not there', () => {
    const tables = manifest.requiredSchema.tables as unknown as { ref: string; label?: Words; labelPlural?: Words; columns: { ref: string; role?: string; type: string; enum?: string[]; label?: Words; rules?: { enumLabels?: { labels: Record<string, Words> } } }[] }[];
    const used = new Set<string>();
    for (const table of tables) {
      expect(table.label?.['en-US'], table.ref).toBe(TABLES[table.ref]?.[0]);
      expect(table.labelPlural?.['en-US'], table.ref).toBe(TABLES[table.ref]?.[1]);
      for (const column of table.columns) {
        if (column.role === 'pk') continue;
        const own = `${table.ref}.${column.ref}`;
        used.add(COLUMNS[own] === undefined ? column.ref : own);
        expect(column.label?.['en-US'], own).toBe(COLUMNS[own] ?? COLUMNS[column.ref]);
        for (const value of column.enum ?? []) {
          const mine = `${own}.${value}`;
          used.add(VALUES[mine] === undefined ? `${column.ref}.${value}` : mine);
          expect(column.rules?.enumLabels?.labels[value]?.['en-US'], mine).toBe(VALUES[mine] ?? VALUES[`${column.ref}.${value}`]);
        }
      }
    }
    expect(Object.keys(TABLES).sort()).toEqual(tables.map((table) => table.ref).sort());
    // A name nobody reads is a name that drifts: each entry of the two lists is some column's or some choice's.
    expect([...Object.keys(COLUMNS), ...Object.keys(VALUES)].filter((key) => !used.has(key))).toEqual([]);
  });

  it('a page, a card and a toolbar link carry their other languages beside the English', () => {
    const pages = manifest.pages as unknown as { ref: string; title: { fallback: string }; titles?: Words; config?: { layout?: { toolbar?: { links?: { label: string; labels?: Words }[] }; items?: { config: Record<string, unknown> }[] } } }[];
    for (const page of pages) {
      expect(page.titles?.['en-US'], page.ref).toBe(page.title.fallback);
      for (const link of page.config?.layout?.toolbar?.links ?? []) expect(link.labels?.['en-US'], link.label).toBe(link.label);
      for (const item of page.config?.layout?.items ?? []) {
        const config = item.config;
        for (const [plain, many] of [['title', 'titles'], ['subtitle', 'subtitles'], ['metricLabel', 'metricLabels']] as const) {
          if (typeof config[plain] === 'string') expect((config[many] as Words | undefined)?.['en-US'], `${page.ref} ${String(config[plain])}`).toBe(config[plain]);
        }
        const empty = config['emptyState'] as { titleKey?: string; titles?: Words } | undefined;
        if (empty?.titleKey !== undefined) expect(empty.titles?.['en-US']).toBe(empty.titleKey);
      }
    }
  });

  it('an email is written in all eight, with the same blocks and the same placeholders', () => {
    const templates = manifest.emailTemplates as unknown as { key: string; locales: Record<string, { subject: string; blocks: { block: string; data: Record<string, unknown> }[] }> }[];
    expect(templates.length).toBe(2);
    for (const template of templates) {
      expect(Object.keys(template.locales), template.key).toEqual(TAGS);
      const english = template.locales['en-US']!;
      for (const tag of OTHERS) {
        const other = template.locales[tag]!;
        expect(other.blocks.map((block) => block.block), `${template.key} ${tag}`).toEqual(english.blocks.map((block) => block.block));
        expect(placeholders(JSON.stringify(other)), `${template.key} ${tag}`).toEqual(placeholders(JSON.stringify(english)));
        expect(other.subject, `${template.key} ${tag}`).not.toBe(english.subject);
      }
    }
  });
});

describe('the dictionaries', () => {
  it.each(OTHERS)('%s translates every text of the manifest, and nothing else', (tag) => {
    expect(Object.keys(dictionary[tag]!).sort()).toEqual([...texts.keys()].sort());
  });

  it.each(OTHERS)('%s keeps every placeholder as it is written', (tag) => {
    for (const [key, said] of Object.entries(dictionary[tag]!)) {
      expect(placeholders(said), `${tag} ${key}`).toEqual(placeholders(key.slice(key.indexOf('|') + 1)));
    }
  });

  it.each(OTHERS)('%s holds no word the release sweep refuses', (tag) => {
    const hits = Object.entries(dictionary[tag]!).flatMap(([key, said]) => bannedHitsIn(said).map((hit) => `${key} → ${said} (${hit.word})`));
    expect(hits).toEqual([]);
  });

  it.each(OTHERS)('%s says a label in about the room the English takes', (tag) => {
    // A column heading three times the English breaks a list's layout; a sentence may run longer.
    const wide = tag.startsWith('zh') || tag === 'ar-EG' ? 1.6 : 2.6;
    const long = Object.entries(dictionary[tag]!).filter(([key, said]) => /^(column|value|table|tables|page|nav|action|widget)\|/.test(key) && said.length > Math.max(20, key.slice(key.indexOf('|') + 1).length * wide + 8));
    expect(long.map(([key, said]) => `${key} → ${said}`)).toEqual([]);
  });

  it('none of the seven is English left in place, but for the few words that are the same', () => {
    for (const tag of OTHERS) {
      const same = Object.entries(dictionary[tag]!).filter(([key, said]) => said === key.slice(key.indexOf('|') + 1));
      expect(same.length, `${tag}: ${same.map(([key]) => key).slice(0, 12).join(' · ')}`).toBeLessThan(18);
    }
  });
});
