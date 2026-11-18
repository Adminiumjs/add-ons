/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install of Adminium 0.3.65 uses, then held
 * to what a validator cannot see at a glance: that its two landing tables
 * carry every column Adminium reads, as the engine names them; that both are
 * numbered; that the reader writes nothing; and that every word a person
 * reads is there in all eight languages.
 */
import { LANDING_COLUMNS, landingBlockIssues, validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { BUILT_FILES, OUTPUT } from '../vite.config.ts';

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];

interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  maxLength?: number;
  unique?: boolean;
  enum?: string[];
  label?: Record<string, string>;
  rules?: { stamp?: unknown; enumLabels?: { labels: Record<string, Record<string, string>> } };
}
interface Table {
  ref: string;
  columns: Column[];
  states?: { column: string; initial: string; moves: Record<string, string[]>; noDelete?: { when: string[] } };
}

const tables = manifest.requiredSchema.tables as unknown as Table[];
const tableOf = (ref: string): Table => {
  const found = tables.find((table) => table.ref === ref);
  if (found === undefined) throw new Error(`no table "${ref}"`);
  return found;
};
const columnOf = (table: string, ref: string): Column => {
  const found = tableOf(table).columns.find((column) => column.ref === ref);
  if (found === undefined) throw new Error(`no column "${table}.${ref}"`);
  return found;
};
const roles = manifest.roles as { key: string; name: string; names: Record<string, string>; permissions: string[] }[];
const role = (key: string) => roles.find((one) => one.key === key)!;
const landing = (manifest.addOn as unknown as { landing: Record<'pages' | 'funnels', string> }).landing;
const WRITES = ['create', 'update', 'delete', 'import'];

describe('the manifest', () => {
  it('validates with the validator an Adminium 0.3.65 install uses, and names the one file the build writes', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
    expect(manifest.addOn.pages.map((page) => page.client)).toEqual([OUTPUT.pages.pages]);
    for (const page of manifest.addOn.pages) expect(BUILT_FILES).toContain(page.client);
  });

  it('is the landing pages add-on: every app, no connection, filed under marketing, on the release that draws landing pages', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('pages');
    expect(manifest.name).toBe('Landing pages');
    expect(manifest.addOn.attaches).toEqual([{ app: '*', range: '*' }]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.categories).toEqual(['marketing']);
    // 0.3.65: the release that knows `addOn.landing`, draws a live page for a stranger and seals its publishing.
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.65');
    expect(manifest.requiredSchema.prefixed).toBe(true);
    // No code of its own runs on a server: Adminium draws every page.
    expect((manifest.addOn as Record<string, unknown>)['provides']).toBeUndefined();
  });

  it('opens one code page, `pages`, in the Library, that takes a path of its own (a page, a funnel)', () => {
    expect(manifest.addOn.pages).toEqual([expect.objectContaining({ ref: 'pages', detail: true, icon: 'panels-top-left', client: 'dist/pages/pages.js', nav: { group: 'library', order: 23 } })]);
    expect(manifest.addOn.pages[0]?.title).toEqual({ key: 'addon.pages.page.pages', fallback: 'Landing pages' });
  });

  it('declares no forms and no chat beside its pages: one stranger’s door to a package', () => {
    const block = manifest.addOn as Record<string, unknown>;
    expect(block['forms']).toBeUndefined();
    expect(block['chat']).toBeUndefined();
    expect((manifest as Record<string, unknown>)['publicAccess']).toBeUndefined();
  });
});

describe('the landing tables', () => {
  it('name the pages and the funnels', () => {
    expect(landing).toEqual({ pages: 'pages', funnels: 'funnels' });
  });

  it('pass the engine’s own check of the landing word', () => {
    expect(landingBlockIssues(landing, { tables: tables as never, categories: manifest.categories })).toEqual([]);
  });

  it('carry every column Adminium reads, of its kind, width and emptiness', () => {
    for (const [part, contract] of Object.entries(LANDING_COLUMNS)) {
      for (const [name, want] of Object.entries(contract)) {
        const column = columnOf(landing[part as 'pages' | 'funnels'], name);
        const where = `${part}.${name}`;
        expect(want.types, where).toContain(column.type);
        expect(column.nullable === true, where).toBe(want.nullable === true);
        if (want.values !== undefined) expect([...(column.enum ?? [])].sort(), where).toEqual([...want.values].sort());
        if (want.atLeast !== undefined) expect(column.maxLength ?? Number.POSITIVE_INFINITY, where).toBeGreaterThanOrEqual(want.atLeast);
      }
    }
  });

  it('are numbered, each by its own key: a funnel’s step and a page’s link name a row by it', () => {
    for (const table of Object.values(landing)) {
      const key = tableOf(table).columns.find((column) => column.role === 'pk');
      expect(key?.type, table).toMatch(/^(int|bigint)$/);
    }
  });

  it('give every other column a value Adminium does not have to write', () => {
    for (const [part, table] of Object.entries(landing)) {
      const contract = LANDING_COLUMNS[part as 'pages' | 'funnels'];
      for (const column of tableOf(table).columns) {
        if (contract[column.ref] !== undefined || column.role !== undefined) continue;
        expect(column.nullable === true || column.default !== undefined || column.rules?.stamp !== undefined, `${table}.${column.ref}`).toBe(true);
      }
    }
  });

  it('keep a page’s address unique, and a page starts as a draft that is published, switched off and back on', () => {
    expect(columnOf('pages', 'slug')).toMatchObject({ unique: true, maxLength: 80 });
    expect(columnOf('pages', 'state').default).toBe('draft');
    expect(tableOf('pages').states).toEqual({ column: 'state', initial: 'draft', moves: { draft: ['live'], live: ['off'], off: ['live'] }, noDelete: { when: ['live'] } });
  });
});

describe('the roles', () => {
  it('are an editor and a reader', () => {
    expect(roles.map((one) => one.key)).toEqual(['editor', 'reader']);
  });

  it('let the editor read, make, change and delete pages and funnels, and open the page', () => {
    expect([...role('editor').permissions].sort()).toEqual(
      [...['pages', 'funnels'].flatMap((table) => ['read', 'create', 'update', 'delete'].map((action) => `table:@${table}:${action}`)), 'page:@pages:view'].sort(),
    );
  });

  it('let the reader read both tables and open the page, and write nothing', () => {
    expect([...role('reader').permissions].sort()).toEqual(['page:@pages:view', 'table:@funnels:read', 'table:@pages:read']);
    for (const table of ['pages', 'funnels']) for (const action of WRITES) expect(role('reader').permissions, `${action} ${table}`).not.toContain(`table:@${table}:${action}`);
  });
});

describe('every word a person reads', () => {
  const inEight = (words: unknown, where: string): void => {
    expect(Object.keys(words as object).sort(), where).toEqual([...LOCALES].sort());
    for (const [tag, text] of Object.entries(words as Record<string, string>)) expect(text.trim(), `${where} ${tag}`).not.toBe('');
  };

  it('is in eight languages: columns, their choices, roles and the page', () => {
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.role === 'pk') continue;
        inEight(column.label, `${table.ref}.${column.ref}`);
        for (const [value, words] of Object.entries(column.rules?.enumLabels?.labels ?? {})) inEight(words, `${table.ref}.${column.ref}=${value}`);
      }
      for (const column of table.columns.filter((one) => one.type === 'enum')) expect(Object.keys(column.rules?.enumLabels?.labels ?? {}).sort(), `${table.ref}.${column.ref}`).toEqual([...(column.enum ?? [])].sort());
    }
    for (const one of roles) inEight(one.names, one.key);
    for (const page of manifest.addOn.pages) inEight(page.titles, page.ref);
  });
});
