/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an Adminium 0.3.66 install uses (the one that
 * knows `lead-source@1`, `addOn.sources` and `addOn.leads`), then held to
 * what a validator cannot see at a glance: every source as the plan rules
 * it, each key a secret of its own, the two tables Adminium alone writes with
 * every column it reads and writes, nobody of the add-on writing them, the
 * tell mail as service mail with no purpose, and every word in eight languages.
 */
import { LEADS_COLUMNS, LEADS_SETTINGS_COLUMNS, validateManifest } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import { OUTPUT } from '../vite.config.ts';
import * as arEG from './pages/strings/ar-EG.ts';
import * as csCZ from './pages/strings/cs-CZ.ts';
import * as daDK from './pages/strings/da-DK.ts';
import * as deDE from './pages/strings/de-DE.ts';
import * as enUS from './pages/strings/en-US.ts';
import * as frFR from './pages/strings/fr-FR.ts';
import * as zhCN from './pages/strings/zh-CN.ts';
import * as zhTW from './pages/strings/zh-TW.ts';

/** The screens' words, by language: what the manifest's names for the action and the sources must say. */
const STRINGS: Record<string, { source: Readonly<Record<string, string>>; fill: Readonly<Record<string, string>> }> = { 'en-US': enUS, 'de-DE': deDE, 'fr-FR': frFR, 'da-DK': daDK, 'cs-CZ': csCZ, 'ar-EG': arEG, 'zh-CN': zhCN, 'zh-TW': zhTW };

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];

interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  maxLength?: number;
  references?: string;
  enum?: string[];
  label?: Record<string, string>;
  rules?: { personal?: boolean; tableRef?: boolean; enumLabels?: { labels: Record<string, Record<string, string>> }; options?: { values: { value: string; label: Record<string, string> }[] } };
}
interface Table {
  ref: string;
  columns: Column[];
  unique?: string[][];
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
const issuesOf = (doc: unknown) => {
  const result = validateManifest(doc);
  return result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`);
};

describe('the manifest', () => {
  it('validates with the validator an Adminium 0.3.66 install uses', () => {
    expect(issuesOf(manifest)).toEqual([]);
  });

  it('says it needs 0.3.66: an older floor is refused for the words it uses', () => {
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.66');
    const older = issuesOf({ ...manifest, compatibility: { ...manifest.compatibility, minAdminiumVersion: '0.3.65' } }).join('\n');
    for (const word of ['addOn.sources', 'addOn.leads', 'lead-source']) expect(older).toContain(word);
  });

  it('is Lead finder: every app, no connection of its own, under marketing, online only', () => {
    expect(manifest).toMatchObject({ kind: 'add-on', key: 'lead-finder', name: 'Lead finder', categories: ['marketing'] });
    expect(manifest.addOn.attaches).toEqual([{ app: '*', range: '*' }]);
    // Keys are kept per source by the engine; the generic connect form is not for it.
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.capabilities).toEqual(['outbound-http']);
    expect(manifest.compatibility.requires).toEqual(['outbound-http']);
  });

  it('provides lead-source@1 once, from the one file the build writes', () => {
    expect(manifest.addOn.provides).toEqual([{ contract: 'lead-source', version: 1, server: OUTPUT.server }]);
  });
});

describe('the sources', () => {
  const sources = manifest.addOn.sources as { id: string; hosts?: string[]; key?: string; reads?: string; gives: string[]; window?: { calls: number; seconds: number }; paid?: boolean }[];
  /** A source as the engine reaches it: its name in words is held to the screens' strings below. */
  const source = (id: string) => {
    const found = sources.find((one) => one.id === id) as (Record<string, unknown> & { id: string }) | undefined;
    if (found === undefined) return undefined;
    const { label: _label, labels: _labels, ...rest } = found;
    return rest;
  };

  it('name each source in eight languages, in the words the screens use, so the record page says where a detail came from', () => {
    const KEYS: Record<string, string> = { website: 'source.website.name', 'companies-house': 'source.companiesHouse.name', france: 'source.france.name', norway: 'source.norway.name', opencorporates: 'source.opencorporates.name', hunter: 'source.hunter.name' };
    for (const one of sources as unknown as { id: string; label: { key: string; fallback: string }; labels: Record<string, string> }[]) {
      expect(one.label, one.id).toEqual({ key: KEYS[one.id], fallback: STRINGS['en-US']!.source[KEYS[one.id]!] });
      expect(one.labels, one.id).toEqual(Object.fromEntries(LOCALES.map((tag) => [tag, STRINGS[tag]!.source[KEYS[one.id]!]])));
    }
    expect(Object.values(KEYS).map((key) => STRINGS['en-US']!.source[key])).toEqual(['Website reader', 'Companies House (UK)', 'Register of France', 'Register of Norway', 'OpenCorporates', 'Hunter']);
  });

  it('are the six the plan rules: no Google anywhere', () => {
    expect(sources.map((one) => one.id)).toEqual(['website', 'companies-house', 'france', 'norway', 'opencorporates', 'hunter']);
    expect(JSON.stringify(manifest).toLowerCase()).not.toContain('google');
  });

  it('the website is the engine’s reader: no hosts, no key, fill only', () => {
    expect(source('website')).toEqual({ id: 'website', reads: 'website', gives: ['fill'] });
  });

  it('Companies House finds and fills, with its own key and its published window, at no cost', () => {
    expect(source('companies-house')).toEqual({ id: 'companies-house', hosts: ['api.company-information.service.gov.uk'], key: 'companies_house_key', gives: ['find', 'fill'], window: { calls: 600, seconds: 300 }, paid: false });
  });

  it('France finds and fills with no key, through the register and the town service, seven calls a second', () => {
    expect(source('france')).toEqual({ id: 'france', hosts: ['recherche-entreprises.api.gouv.fr', 'geo.api.gouv.fr'], gives: ['find', 'fill'], window: { calls: 7, seconds: 1 } });
  });

  it('Norway finds and fills with no key, through its register alone', () => {
    expect(source('norway')).toEqual({ id: 'norway', hosts: ['data.brreg.no'], gives: ['find', 'fill'] });
  });

  it('OpenCorporates fills only, with a paid key', () => {
    expect(source('opencorporates')).toEqual({ id: 'opencorporates', hosts: ['api.opencorporates.com'], key: 'opencorporates_key', gives: ['fill'], paid: true });
  });

  it('Hunter gives people only, with a paid key', () => {
    // Hunter's published limit (15 a second): the engine keeps to it, whoever presses.
    expect(source('hunter')).toEqual({ id: 'hunter', hosts: ['api.hunter.io'], key: 'hunter_key', gives: ['people'], window: { calls: 15, seconds: 1 }, paid: true });
  });

  it('may reach exactly its sources’ hosts', () => {
    expect([...manifest.addOn.network.allow].sort()).toEqual([...new Set(sources.flatMap((one) => one.hosts ?? []))].sort());
  });

  it('keeps each key in a secret setting of its own', () => {
    const keys = sources.flatMap((one) => (one.key === undefined ? [] : [one.key]));
    expect(manifest.settings.map((setting) => setting.key).sort()).toEqual([...keys].sort());
    for (const setting of manifest.settings) expect(setting, setting.key).toMatchObject({ type: 'string', secret: true });
    expect(manifest.settings.some((setting) => (setting as { required?: boolean }).required === true)).toBe(false);
  });
});

describe('the tables Adminium alone writes', () => {
  it('are named by addOn.leads, beside the settings table', () => {
    expect(manifest.addOn.leads).toEqual({ foundPeople: 'found_people', fieldSources: 'field_sources' });
    expect(manifest.addOn.settingsTable).toBe('settings');
  });

  it('carry every column the engine reads and writes, of its kind, width and emptiness', () => {
    const parts = { foundPeople: 'found_people', fieldSources: 'field_sources' } as const;
    for (const [part, ref] of Object.entries(parts)) {
      for (const [name, want] of Object.entries(LEADS_COLUMNS[part as keyof typeof parts])) {
        const column = columnOf(ref, name);
        expect(want.types, `${ref}.${name}`).toContain(column.type);
        expect(column.nullable === true, `${ref}.${name}`).toBe(want.nullable === true);
        if (want.atLeast !== undefined && column.maxLength !== undefined) expect(column.maxLength, `${ref}.${name}`).toBeGreaterThanOrEqual(want.atLeast);
        if (want.values !== undefined) expect([...(column.enum ?? [])].sort(), `${ref}.${name}`).toEqual([...want.values].sort());
      }
    }
    for (const [name, want] of Object.entries(LEADS_SETTINGS_COLUMNS)) {
      expect(want.types).toContain(columnOf('settings', name).type);
      expect(columnOf('settings', name).nullable === true, name).toBe(want.nullable === true);
    }
  });

  it('are numbered by the engine’s own increment', () => {
    for (const table of tables) expect(table.columns.find((column) => column.role === 'pk')?.type, table.ref).toBe('int');
  });

  it('keep a person’s pages as text, one address a line, never JSON, and unbounded', () => {
    expect(columnOf('found_people', 'source_pages')).toMatchObject({ type: 'text', nullable: true });
    expect(columnOf('found_people', 'source_pages').maxLength).toBeUndefined();
    for (const ref of ['found_people', 'field_sources']) expect(tableOf(ref).columns.filter((column) => column.type === 'json').map((column) => column.ref), ref).toEqual([]);
  });

  it('name each filled field once', () => {
    expect(tableOf('field_sources').unique).toEqual([['table_ref', 'row_key', 'column_name']]);
  });

  it('hold table names Adminium keeps up to date when a table is renamed', () => {
    for (const [table, name] of [['found_people', 'person_table'], ['found_people', 'company_table'], ['field_sources', 'table_ref']] as const) expect(columnOf(table, name).rules?.tableRef, `${table}.${name}`).toBe(true);
  });

  it('mark as personal what is about a person: the pages they were seen on, their address', () => {
    for (const [table, name] of [['found_people', 'source_pages'], ['found_people', 'email'], ['tell_mails', 'to_address']] as const) expect(columnOf(table, name).rules?.personal, `${table}.${name}`).toBe(true);
  });

  it('keep people off until turned on, with no purpose written, for three years unless set', () => {
    expect(columnOf('settings', 'people_on')).toMatchObject({ type: 'bool', default: false });
    expect(columnOf('settings', 'purpose')).toMatchObject({ type: 'json', nullable: true });
    expect(columnOf('settings', 'purpose').default).toBeUndefined();
    expect(columnOf('settings', 'keep_years')).toMatchObject({ type: 'int', default: 3 });
    expect(columnOf('settings', 'keep_years').rules?.options?.values.map((one) => one.value)).toEqual(['1', '2', '3']);
  });
});

describe('the tell mail', () => {
  const outbox = manifest.outbox;

  it('is the outbox kind "tell", service mail with no purpose, linked to the found person', () => {
    expect(outbox.kinds).toEqual({ tell: 'lead-finder-tell' });
    expect(outbox.classes).toEqual({ tell: 'service' });
    expect((outbox as Record<string, unknown>)['purposes']).toBeUndefined();
    expect(outbox.links).toEqual({ found_person: 'found_person_id' });
    expect(columnOf('tell_mails', 'found_person_id')).toMatchObject({ type: 'fk', references: 'found_people', nullable: true });
  });

  it('is queued by Adminium when it keeps a person: nothing of the add-on produces one', () => {
    expect((outbox as Record<string, unknown>)['producers']).toBeUndefined();
  });

  it('opens with a heading, a greeting and what is kept, in eight languages, and leaves the rest to Adminium', () => {
    const [template] = manifest.emailTemplates;
    expect(Object.keys(template!.locales).sort()).toEqual([...LOCALES].sort());
    for (const [locale, content] of Object.entries(template!.locales)) {
      const text = JSON.stringify(content);
      // The source, the date, the purpose, the keeping time, the rights and the Object link are the engine's fixed sentences.
      for (const engines of ['object_link', 'hunter', 'Art', '6(1)(f)', 'http']) expect(text, `${locale}: ${engines}`).not.toContain(engines);
      expect(text, locale).toContain('{{company}}');
    }
    expect(template!.locales['en-US'].subject).toBe('Why we have your details');
  });
});

describe('the roles', () => {
  it('are a company finder and a settings manager', () => {
    expect(roles.map((one) => one.key)).toEqual(['finder', 'settings-manager']);
  });

  it('let the finder open the page, read what was found and the tell mails, and send a failed tell mail again, and change nothing else', () => {
    expect(roles[0]!.permissions).toEqual(['table:@found_people:read', 'table:@found_people:read_pii', 'table:@field_sources:read', 'table:@tell_mails:read', 'table:@tell_mails:read_pii', 'table:@settings:read', 'table:@tell_mails:update', 'page:@lead-finder:view']);
  });

  it('let nobody of the add-on write a found person or a field’s source, or make or remove a tell mail: Adminium alone does', () => {
    for (const one of roles) {
      for (const table of ['found_people', 'field_sources']) for (const action of ['create', 'update', 'delete', 'import']) expect(one.permissions, `${one.key} ${action} ${table}`).not.toContain(`table:@${table}:${action}`);
      // A tell mail's row is the outbox's: a person may only move a failed one back to queued (the outbox's own rule), never make, remove or reword one.
      for (const action of ['create', 'delete', 'import']) expect(one.permissions, `${one.key} ${action} tell_mails`).not.toContain(`table:@tell_mails:${action}`);
      expect(one.permissions.some((grant) => grant.startsWith('table:@*:'))).toBe(false);
    }
  });

  it('let the settings manager change the settings and open the page, and nothing else', () => {
    expect(roles[1]!.permissions).toEqual(['table:@settings:read', 'table:@settings:update', 'page:@lead-finder:view']);
  });
});

describe('the screens', () => {
  it('are one page in the Library, from the file the build writes, which needs the data kit (host API 2)', () => {
    expect(manifest.addOn.hostApi).toBe(2);
    expect(manifest.addOn.pages).toMatchObject([{ ref: 'lead-finder', client: OUTPUT.pages['lead-finder'], nav: { group: 'library' }, icon: 'scan-search' }]);
    expect(Object.keys(manifest.addOn.pages[0]!.titles).sort()).toEqual([...LOCALES].sort());
  });

  it('fill a company record’s actions from the record action file, and nothing else', () => {
    expect(manifest.addOn.slots).toEqual([
      {
        slot: 'record.actions',
        client: OUTPUT.client,
        order: 10,
        // Drawn by Adminium's record page on a table an app declares as companies, before the add-on's code runs.
        on: 'companies',
        label: { key: 'fill.title', fallback: 'Fill in details' },
        labels: Object.fromEntries(LOCALES.map((tag) => [tag, STRINGS[tag]!.fill['fill.title']])),
        icon: 'scan-search',
      },
    ]);
  });
});

describe('every word a person reads', () => {
  const inEight = (words: unknown, where: string): void => {
    expect(Object.keys(words as object).sort(), where).toEqual([...LOCALES].sort());
    for (const [tag, text] of Object.entries(words as Record<string, string>)) expect(text.trim(), `${where} ${tag}`).not.toBe('');
  };

  it('is in eight languages: columns, their choices, roles and the template’s name', () => {
    for (const table of tables) {
      for (const column of table.columns) {
        if (column.role === 'pk') continue;
        inEight(column.label, `${table.ref}.${column.ref}`);
        for (const [value, words] of Object.entries(column.rules?.enumLabels?.labels ?? {})) inEight(words, `${table.ref}.${column.ref}=${value}`);
        for (const option of column.rules?.options?.values ?? []) inEight(option.label, `${table.ref}.${column.ref}=${option.value}`);
      }
      for (const column of table.columns.filter((one) => one.type === 'enum')) expect(Object.keys(column.rules?.enumLabels?.labels ?? {}).sort(), `${table.ref}.${column.ref}`).toEqual([...(column.enum ?? [])].sort());
    }
    for (const one of roles) inEight(one.names, one.key);
    inEight(manifest.emailTemplates[0]!.name, 'the tell mail');
  });
});
