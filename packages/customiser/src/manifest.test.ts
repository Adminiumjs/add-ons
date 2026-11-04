/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install uses, then held to what a validator
 * cannot know: that the file is what `scripts/manifest.mjs` writes; that every
 * table two shop apps might share says which app a row is for, and every entry
 * is held to it; that a customer's design is saved by anyone with the files
 * they uploaded, changed only by its own link and only while a draft, read
 * through a shop's key only by its own code, by a guest the shop signed in;
 * that a design nobody ordered is let go; and that every word a person reads
 * is there in all eight languages.
 */
import { validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { TARGET, written } from '../scripts/manifest.mjs';
import { readFileSync } from 'node:fs';
import { DESIGN_BY_CODE, DESIGN_CHANGEABLE, DESIGN_OPENED, DESIGN_UPLOADS, DESIGN_WRITABLE, LINK_KEY } from './manifest/entries.ts';
import { CUSTOMER_TABLES, SHOP_TABLES } from './manifest/build.ts';
import { DESCRIPTION, LOCALES } from './manifest/words.ts';
import { OUTPUT } from '../vite.config.ts';

interface FileRule {
  accept: string[];
  maxBytes: number;
  upload?: { kinds: string[]; maxBytes: number };
}
interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  unique?: boolean;
  references?: string;
  enum?: string[];
  label?: Record<string, string>;
  rules?: {
    personal?: boolean;
    code?: { length?: number; hiddenFromStaff?: boolean };
    file?: FileRule;
    enumLabels?: { labels: Record<string, Record<string, string>> };
  };
}
interface Table {
  ref: string;
  label?: Record<string, string>;
  labelPlural?: Record<string, string>;
  columns: Column[];
  expire?: unknown;
}
interface Entry {
  table: string;
  key?: string;
  methods: string[];
  select?: string[];
  writable?: string[];
  defaults?: Record<string, unknown>;
  appColumn?: string;
  claim?: { by?: string; column?: string; own?: boolean; address?: string };
  humanCheck?: boolean;
  uploads?: string[];
  files?: string[];
  shareLink?: string;
  writableWhen?: Record<string, string[]>;
  level?: string;
  unlockBy?: Record<string, unknown>;
  anonymous?: unknown;
  filters?: { column: string; op: string; value: unknown }[];
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
const entries = manifest.publicAccess as unknown as Entry[];
const onShopKey = entries.filter((entry) => entry.key === undefined);
const roles = manifest.roles as { key: string; name: string; names: Record<string, string>; permissions: string[] }[];
const role = (key: string) => roles.find((one) => one.key === key)!;

describe('the manifest', () => {
  it('is what the script writes', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe((written as () => string)());
  });

  it('validates with the validator an install uses', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('is the Customiser: the two shop apps, no connection, filed under artwork, on the release whose words it uses', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('customiser');
    expect(manifest.name).toBe('Customiser');
    expect(manifest.addOn.attaches).toEqual([
      { app: 'maker', range: '*' },
      { app: 'printing', range: '*' },
    ]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.categories).toEqual(['artwork']);
    // 0.3.43: an add-on's entries held to each app's rows (`appColumn`), rows that expire, and apps binding into it.
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.43');
    expect(manifest.requiredSchema.prefixed).toBe(true);
    expect(manifest.addOn.settingsTable).toBe('settings');
  });

  it('names every shop screen the build writes: the set-up page, and a panel on a product and on an order line', () => {
    const addOn = manifest.addOn as unknown as { hostApi: number; pages: { ref: string; client: string; detail?: boolean; titles: Record<string, string> }[]; panels: { id: string; on: string; client: string; titles: Record<string, string> }[] };
    expect(addOn.hostApi).toBe(2);
    expect(addOn.pages.map((page) => [page.ref, page.client])).toEqual(Object.entries(OUTPUT.pages).map(([ref, file]) => [ref, file]));
    expect(addOn.pages[0]?.detail).toBe(true);
    // A product links to its base, an order line to the shopper's design: each panel sits on the table it links into.
    expect(addOn.panels.map((panel) => [panel.id, panel.on, panel.client])).toEqual([
      ['customiser-product', 'bases', OUTPUT.panels['customiser-product']],
      ['customiser-line', 'designs', OUTPUT.panels['customiser-line']],
    ]);
    for (const screen of [...addOn.pages, ...addOn.panels]) expect(Object.keys(screen.titles).sort()).toEqual([...LOCALES].sort());
  });

  it('describes itself in eight languages', () => {
    expect(manifest.description.fallback).toBe(DESCRIPTION['en-US']);
    expect(Object.keys(DESCRIPTION).sort()).toEqual([...LOCALES].sort());
    for (const tag of LOCALES) expect(DESCRIPTION[tag].trim(), tag).not.toBe('');
  });
});

describe('the design question', () => {
  const addOn = manifest.addOn as unknown as { provides: { contract: string; version: number; server: string }[]; checker: { design: string; reads: { id: string; table: string; by: { column: string; from: string } }[] } };

  it('is answered by the built file, as design-check@1', () => {
    expect(addOn.provides).toEqual([{ contract: 'design-check', version: 1, server: OUTPUT.check }]);
  });

  it('reads, keyed from the design, the ready-made design and its parts, the base and its areas, the palettes and the app’s features', () => {
    expect(addOn.checker.design).toBe('designs');
    expect(addOn.checker.reads.map((read) => `${read.id}: ${read.table}.${read.by.column} = ${read.by.from}`)).toEqual([
      'ready: ready_designs.id = design.ready_design_id',
      'parts: ready_parts.ready_design_id = ready.id',
      'base: bases.id = design.base_id',
      'areas: base_areas.base_id = base.id',
      'palettes: palettes.ready_design_id = ready.id',
      'features: features.app = design.app',
    ]);
    // Each read starts from the design or an earlier read, on a column the table has.
    const seen = new Set(['design']);
    for (const read of addOn.checker.reads) {
      const [from, column] = read.by.from.split('.') as [string, string];
      expect(seen.has(from), read.id).toBe(true);
      const table = from === 'design' ? 'designs' : addOn.checker.reads.find((one) => one.id === from)!.table;
      columnOf(table, column);
      columnOf(read.table, read.by.column);
      seen.add(read.id);
    }
  });

  it('names the priced feature a base’s second side takes', () => {
    expect(columnOf('bases', 'back_feature_id')).toMatchObject({ type: 'fk', references: 'features', nullable: true });
    expect(entries.find((entry) => entry.table === 'bases')!.select).toContain('back_feature_id');
  });
});

describe('the tables', () => {
  it('are the ones every other piece builds on, by these names', () => {
    expect(tables.map((table) => table.ref)).toEqual(['settings', 'bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features', 'designs', 'design_versions']);
    expect([...SHOP_TABLES, ...CUSTOMER_TABLES, 'settings'].sort()).toEqual(tables.map((table) => table.ref).sort());
  });

  it('say, every one two shop apps might share, which app a row is for', () => {
    for (const table of tables.filter((one) => one.ref !== 'settings')) expect(columnOf(table.ref, 'app'), table.ref).toMatchObject({ type: 'text', nullable: true });
  });

  it('take four kinds of base, and a base is offered only once it is published', () => {
    expect(columnOf('bases', 'kind').enum).toEqual(['page', 'piece', 'kit', 'printed']);
    expect(columnOf('bases', 'state')).toMatchObject({ enum: ['draft', 'published'], default: 'draft' });
  });

  it('keep the shop’s ready-made designs in a table of their own, apart from the designs customers save', () => {
    expect(columnOf('ready_parts', 'ready_design_id')).toMatchObject({ type: 'fk', references: 'ready_designs' });
    expect(columnOf('designs', 'ready_design_id')).toMatchObject({ type: 'fk', references: 'ready_designs', nullable: true });
    expect(columnOf('ready_parts', 'kind').enum).toEqual(['text', 'picture', 'colour', 'choice', 'shape']);
  });

  it('name a priced feature by a code each app keeps once, and keep no price: the app prices it', () => {
    expect(columnOf('features', 'code')).toMatchObject({ type: 'text' });
    expect((tableOf('features') as { unique?: string[][] }).unique).toEqual([['app', 'code']]);
    expect(tableOf('features').columns.map((column) => column.ref).filter((ref) => /price|amount|cost/.test(ref))).toEqual([]);
  });

  it('give a design a code of sixteen characters, which the order line finds it by, and a private link staff never see', () => {
    expect(columnOf('designs', 'code').rules?.code).toEqual({ length: 16 });
    expect(columnOf('designs', 'code').unique).toBe(true);
    expect(columnOf('designs', 'link_token').rules?.code).toEqual({ length: 16, hiddenFromStaff: true });
  });

  it('save a design as data, with the version of its shape, never as a picture', () => {
    expect(columnOf('designs', 'format')).toMatchObject({ type: 'int', default: 1 });
    expect(columnOf('designs', 'values').type).toBe('json');
    // A customer's own files sit in file columns of the design, where the design question is handed them.
    const ten = 10 * 1024 * 1024;
    // "SVG, PDF, PNG or JPEG, up to 10 MB": a logo the customer uploads, an SVG kept only as Adminium cleans it.
    expect(columnOf('designs', 'logo_file').rules?.file).toEqual({ accept: ['svg', 'pdf', 'png', 'jpeg'], maxBytes: ten, upload: { kinds: ['svg', 'pdf', 'png', 'jpg'], maxBytes: ten } });
    // A photo is a picture.
    expect(columnOf('designs', 'photo_file').rules?.file).toEqual({ accept: ['png', 'jpeg'], maxBytes: ten, upload: { kinds: ['png', 'jpg'], maxBytes: ten } });
  });

  it('let a design nobody ordered go 90 days after its last change', () => {
    expect(columnOf('designs', 'updated_at')).toMatchObject({ type: 'timestamptz', role: 'updated_at' });
    expect(tableOf('designs').expire).toEqual({ after: 'updated_at', days: 90, unless: { column: 'state', equals: 'ordered' } });
    expect(columnOf('designs', 'state')).toMatchObject({ enum: ['draft', 'ordered'], default: 'draft' });
    // Nothing of the add-on points at a draft design, or it would never go: only an ordered design has versions.
    const pointing = tables.flatMap((table) => table.columns.filter((column) => column.references === 'designs').map((column) => `${table.ref}.${column.ref}`));
    expect(pointing).toEqual(['design_versions.design_id']);
  });

  it('mark as personal every column that holds what a customer wrote, sent or where to reach them', () => {
    for (const ref of ['values', 'email', 'logo_file', 'photo_file']) expect(columnOf('designs', ref).rules?.personal, `designs.${ref}`).toBe(true);
    expect(columnOf('design_versions', 'values').rules?.personal).toBe(true);
  });

  it('keep one settings row, made from its defaults', () => {
    for (const column of tableOf('settings').columns) {
      if (column.role === 'pk') continue;
      expect(column.default !== undefined || column.nullable === true, `settings.${column.ref}`).toBe(true);
    }
  });
});

describe('the public entries', () => {
  it('serve the shop’s outlines, pieces and fonts to every visitor as files, each an SVG or a WOFF2 of up to 2 MB', () => {
    const served = entries.filter((entry) => (entry as { assets?: string[] }).assets !== undefined).map((entry) => [entry.table, (entry as { assets?: string[] }).assets]);
    expect(served).toEqual([
      ['bases', ['outline_file']],
      ['base_pieces', ['file']],
      ['fonts', ['file']],
    ]);
    expect(columnOf('bases', 'outline_file').rules?.file).toEqual({ accept: ['svg'], maxBytes: 2 * 1024 * 1024 });
    expect(columnOf('base_pieces', 'file').rules?.file).toEqual({ accept: ['svg'], maxBytes: 2 * 1024 * 1024 });
    expect(columnOf('fonts', 'file').rules?.file).toEqual({ accept: ['woff2'], maxBytes: 2 * 1024 * 1024 });
    // Each read only, on the shop's own key, the column among what it reads.
    for (const entry of entries.filter((one) => (one as { assets?: string[] }).assets !== undefined)) {
      expect(entry.methods, entry.table).toEqual(['GET']);
      expect(entry.key, entry.table).toBeUndefined();
      for (const column of (entry as { assets?: string[] }).assets ?? []) expect(entry.select, entry.table).toContain(column);
    }
  });

  it('ride each app’s own key and are held to that app’s rows — all but the fonts, which every shop shares', () => {
    for (const entry of onShopKey) {
      if (entry.table === 'fonts') continue;
      expect(entry.appColumn, `${entry.table} ${entry.methods.join(',')}`).toBe('app');
    }
    // The starter fonts are written for no app; a font is a typeface and its licence, and a design offers only the fonts its parts name.
    expect(onShopKey.find((entry) => entry.table === 'fonts')?.appColumn).toBeUndefined();
  });

  it('let every visitor read what a shop offers, and only what it published or shows', () => {
    const reads = onShopKey.filter((entry) => entry.methods.join() === 'GET' && entry.table !== 'designs').map((entry) => entry.table);
    expect(reads).toEqual(['bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features']);
    for (const table of ['bases', 'ready_designs']) expect(onShopKey.find((entry) => entry.table === table)?.filters, table).toEqual([{ column: 'state', op: 'eq', value: 'published' }]);
  });

  it('let anyone save a design behind the human check and a stranger’s limits, with the files they uploaded, answering its code, its own link and nothing personal', () => {
    const create = onShopKey.filter((entry) => entry.table === 'designs' && entry.methods.includes('POST'));
    expect(create).toHaveLength(1);
    expect(create[0]).toMatchObject({ methods: ['POST'], humanCheck: true, appColumn: 'app' });
    expect(create[0]!.anonymous).toBeDefined();
    expect(create[0]!.writable).toEqual([...DESIGN_WRITABLE]);
    // Adminium decides these: the app, the state, the code and the link are never a browser's to write.
    for (const ref of ['app', 'state', 'code', 'link_token', 'updated_at']) expect(create[0]!.writable, ref).not.toContain(ref);
    expect(create[0]!.defaults).toBeUndefined();
    expect(create[0]!.select).toEqual(['id', 'code', 'format', 'state']);
    expect(create[0]!.uploads).toEqual([...DESIGN_UPLOADS]);
    for (const ref of DESIGN_UPLOADS) expect(create[0]!.writable, ref).toContain(ref);
    // The reply hands the new design's own link to whoever saved it, once.
    expect(create[0]!.shareLink).toBe('link_token');
  });

  it('let nobody read a customer’s design through a shop’s key but by its own code, signed in by the shop', () => {
    const reads = onShopKey.filter((one) => CUSTOMER_TABLES.includes(one.table as (typeof CUSTOMER_TABLES)[number]) && one.methods.includes('GET'));
    expect(reads.map((one) => one.table)).toEqual(['designs']);
    // One design, by the code its order line holds, for a guest the shop signed in: never a list, never the code shown back.
    expect(reads[0]).toMatchObject({ methods: ['GET'], appColumn: 'app', level: 'lookup', unlockBy: { header: true, column: 'code', self: true, length: 16 } });
    expect(reads[0]!.select).toEqual([...DESIGN_BY_CODE]);
    // The code read still returns what the customer chose, though it is personal: a 16-character self-code read through the shop's sign-in shows personal columns.
    expect(reads[0]!.select).toContain('values');
    expect(columnOf('designs', 'values').rules?.personal).toBe(true);
    for (const ref of ['code', 'link_token', 'email', 'logo_file', 'photo_file']) expect(reads[0]!.select, ref).not.toContain(ref);
    expect(reads[0]!.files).toBeUndefined();
  });

  it('open a saved design again only by its own link: that one design, changed only while it is a draft, never its address', () => {
    expect(Object.keys(manifest.publicKeys)).toEqual([LINK_KEY]);
    const opened = entries.filter((entry) => entry.key === LINK_KEY);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ table: 'designs', methods: ['GET', 'PATCH'], claim: { by: 'token', column: 'link_token', own: true, address: 'email' } });
    expect(opened[0]!.select).toEqual([...DESIGN_OPENED]);
    expect(opened[0]!.select).not.toContain('link_token');
    expect(opened[0]!.select).not.toContain('email');
    expect(opened[0]!.writable).toEqual([...DESIGN_CHANGEABLE]);
    for (const ref of ['app', 'state', 'code', 'link_token', 'email', 'updated_at']) expect(opened[0]!.writable, ref).not.toContain(ref);
    // An ordered design is the order's.
    expect(opened[0]!.writableWhen).toEqual({ state: ['draft'] });
    // The customer uploads a new logo or photo through it, and downloads what they sent.
    expect(opened[0]!.uploads).toEqual([...DESIGN_UPLOADS]);
    expect(opened[0]!.files).toEqual([...DESIGN_UPLOADS]);
  });

  it('never serve a customer’s file to every visitor', () => {
    for (const entry of entries) for (const ref of DESIGN_UPLOADS) expect((entry as { assets?: string[] }).assets ?? [], `${entry.table} ${ref}`).not.toContain(ref);
  });
});

describe('the roles', () => {
  it('are a designer and a reader', () => {
    expect(roles.map((one) => one.key)).toEqual(['designer', 'reader']);
  });

  it('give the designer the shop’s tables, the designs to read, the versions to make, and the settings', () => {
    expect(role('designer').permissions).toEqual(
      expect.arrayContaining([
        ...SHOP_TABLES.flatMap((table) => ['read', 'create', 'update', 'delete'].map((action) => `table:@${table}:${action}`)),
        'table:@designs:read',
        'table:@designs:read_pii',
        'table:@design_versions:create',
        'table:@design_versions:update',
        'table:@settings:update',
      ]),
    );
  });

  it('let nobody of the add-on type in or delete a customer’s design: customers make them', () => {
    for (const one of roles) for (const action of ['create', 'update', 'delete', 'import']) expect(one.permissions, `${one.key} ${action}`).not.toContain(`table:@designs:${action}`);
  });

  it('let the reader read and change nothing, and open the set-up and both panels', () => {
    expect(role('reader').permissions.filter((grant) => !grant.endsWith(':read') && !grant.endsWith(':read_pii') && !grant.endsWith(':view'))).toEqual([]);
    for (const one of roles) expect(one.permissions.filter((grant) => grant.startsWith('page:')).sort(), one.key).toEqual(['page:@customiser-line:view', 'page:@customiser-product:view', 'page:@customiser:view']);
  });
});

describe('every word a person reads', () => {
  const inEight = (words: unknown, where: string): void => {
    expect(Object.keys((words ?? {}) as object).sort(), where).toEqual([...LOCALES].sort());
    for (const [tag, text] of Object.entries(words as Record<string, string>)) expect(text.trim(), `${where} ${tag}`).not.toBe('');
  };

  it('is in eight languages: tables, columns, their choices and the roles', () => {
    for (const table of tables) {
      inEight(table.label, `${table.ref} label`);
      inEight(table.labelPlural, `${table.ref} labelPlural`);
      for (const column of table.columns) {
        if (column.role === 'pk') continue;
        inEight(column.label, `${table.ref}.${column.ref}`);
        for (const [value, words] of Object.entries(column.rules?.enumLabels?.labels ?? {})) inEight(words, `${table.ref}.${column.ref}=${value}`);
      }
      for (const column of table.columns.filter((one) => one.type === 'enum')) expect(Object.keys(column.rules?.enumLabels?.labels ?? {}).sort(), `${table.ref}.${column.ref}`).toEqual([...(column.enum ?? [])].sort());
    }
    for (const one of roles) inEight(one.names, one.key);
  });
});
