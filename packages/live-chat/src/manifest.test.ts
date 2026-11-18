/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install of Adminium 0.3.64 uses, then held
 * to what a validator cannot see at a glance: that its four chat tables and
 * its settings table carry every column Adminium reads and writes, as the
 * engine names them; that every table is numbered; that nobody of the add-on
 * writes a conversation's messages or the answerer's choices; and that every
 * word a person reads is there in all eight languages.
 */
import { CHAT_COLUMNS, CHAT_SETTINGS_COLUMNS, validateManifest } from '@adminiumjs/manifest';
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
  references?: string;
  enum?: string[];
  label?: Record<string, string>;
  rules?: { personal?: boolean; enumLabels?: { labels: Record<string, Record<string, string>> }; options?: { values: { value: string; label: Record<string, string> }[] } };
}
interface Table {
  ref: string;
  columns: Column[];
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
const chat = manifest.addOn.chat as Record<string, string>;

/** One column held to the engine's contract for it. */
function holds(table: string, name: string, want: { types: readonly string[]; nullable?: boolean; unique?: boolean; values?: readonly string[]; links?: string; atLeast?: number }): void {
  const column = columnOf(table, name);
  const where = `${table}.${name}`;
  expect(want.types, where).toContain(column.type);
  expect(column.nullable === true, where).toBe(want.nullable === true);
  if (want.unique === true) expect(column.unique, where).toBe(true);
  if (want.values !== undefined) expect([...(column.enum ?? [])].sort(), where).toEqual([...want.values].sort());
  if (want.links !== undefined) expect(column.references, where).toBe(chat[want.links]);
  if (want.atLeast !== undefined && column.maxLength !== undefined) expect(column.maxLength, where).toBeGreaterThanOrEqual(want.atLeast);
}

describe('the manifest', () => {
  it('validates with the validator an Adminium 0.3.64 install uses, and names the one file the build writes', () => {
    const result = validateManifest(manifest);
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
    expect(manifest.addOn.pages.map((page) => page.client)).toEqual([OUTPUT.pages['live-chat']]);
    for (const page of manifest.addOn.pages) expect(BUILT_FILES).toContain(page.client);
  });

  it('is the live chat add-on: every app, no connection, filed under marketing, on the release that serves chats', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('live-chat');
    expect(manifest.name).toBe('Live chat');
    expect(manifest.addOn.attaches).toEqual([{ app: '*', range: '*' }]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.categories).toEqual(['marketing']);
    // 0.3.64: the release that knows `addOn.chat`, serves the chat's window and its staff routes.
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.64');
    expect(manifest.requiredSchema.prefixed).toBe(true);
    // No code of its own runs on a server: Adminium keeps every conversation.
    expect((manifest.addOn as Record<string, unknown>)['provides']).toBeUndefined();
  });

  it('opens one code page, `live-chat`, in the Library, that takes a path of its own (the settings)', () => {
    expect(manifest.addOn.pages).toEqual([expect.objectContaining({ ref: 'live-chat', detail: true, icon: 'message-circle', client: 'dist/pages/live-chat.js', nav: { group: 'library', order: 22 } })]);
  });
});

describe('the chat tables', () => {
  it('name the four parts, and the settings table beside them', () => {
    expect(manifest.addOn.chat).toEqual({ conversations: 'conversations', messages: 'messages', answers: 'answers', choices: 'choices' });
    expect(manifest.addOn.settingsTable).toBe('settings');
  });

  it('carry every column Adminium reads and writes, of its kind, width and emptiness', () => {
    for (const [part, contract] of Object.entries(CHAT_COLUMNS)) for (const [name, want] of Object.entries(contract)) holds(chat[part]!, name, want);
    for (const [name, want] of Object.entries(CHAT_SETTINGS_COLUMNS)) holds('settings', name, want);
  });

  it('are numbered, each by its own key: the messages’ key is the cursor a visitor’s window reads from', () => {
    for (const table of [...Object.values(chat), 'settings']) {
      const key = tableOf(table).columns.find((column) => column.role === 'pk');
      expect(key?.type, table).toMatch(/^(int|bigint)$/);
    }
  });

  it('let a message and a "came from" be as long as Adminium keeps them: no width the engine could cut', () => {
    expect(columnOf('messages', 'body').maxLength).toBeUndefined();
    expect(columnOf('conversations', 'came_from').maxLength).toBeUndefined();
  });

  it('keep the json settings empty until set, and conversations a year unless set', () => {
    for (const name of ['hours', 'welcome', 'outside_words', 'tell']) expect(columnOf('settings', name).nullable, name).toBe(true);
    expect(columnOf('settings', 'transcripts_months')).toMatchObject({ type: 'int', nullable: true, default: 12 });
    expect(columnOf('settings', 'transcripts_months').rules?.options?.values.map((one) => one.value)).toEqual(['3', '6', '12', '24']);
    expect(columnOf('settings', 'automatic').default).toBe(false);
    expect(columnOf('settings', 'daily_tokens').default).toBe(0);
    expect(columnOf('settings', 'milo_drafts').default).toBe(false);
    expect(columnOf('settings', 'theme').default).toBe('light');
  });

  it('every other column of a table Adminium alone writes may be left out of its insert', () => {
    for (const part of ['conversations', 'messages', 'choices'] as const) {
      const contract = CHAT_COLUMNS[part];
      for (const column of tableOf(chat[part]!).columns) {
        if (contract[column.ref] !== undefined || column.role === 'pk') continue;
        expect(column.nullable === true || column.default !== undefined, `${part}.${column.ref}`).toBe(true);
      }
    }
  });

  it('mark as personal what a visitor typed: their name, e-mail, the page and their words', () => {
    for (const [table, name] of [['conversations', 'name'], ['conversations', 'email'], ['conversations', 'came_from'], ['messages', 'body']] as const) expect(columnOf(table, name).rules?.personal, `${table}.${name}`).toBe(true);
  });
});

describe('the roles', () => {
  it('are an agent and a settings manager', () => {
    expect(roles.map((one) => one.key)).toEqual(['agent', 'settings-manager']);
  });

  it('let the agent read all four tables, answer the conversations, and write the answers', () => {
    expect(role('agent').permissions).toEqual(
      expect.arrayContaining([
        ...['conversations', 'messages', 'answers', 'choices'].map((table) => `table:@${table}:read`),
        'table:@conversations:read_pii',
        'table:@messages:read_pii',
        'table:@conversations:update',
        ...['create', 'update', 'delete'].map((action) => `table:@answers:${action}`),
        'page:@live-chat:view',
      ]),
    );
  });

  it('let nobody of the add-on write a message or a choice, nor make or import a conversation: Adminium alone does', () => {
    for (const one of roles) {
      for (const table of ['messages', 'choices']) for (const action of ['create', 'update', 'import']) expect(one.permissions, `${one.key} ${action} ${table}`).not.toContain(`table:@${table}:${action}`);
      for (const action of ['create', 'import']) expect(one.permissions, `${one.key} ${action} conversations`).not.toContain(`table:@conversations:${action}`);
    }
  });

  it('let the settings manager change the settings, and read them and the answers', () => {
    expect(role('settings-manager').permissions).toEqual(expect.arrayContaining(['table:@settings:read', 'table:@settings:update', 'table:@answers:read', 'page:@live-chat:view']));
    expect(role('settings-manager').permissions.filter((grant) => grant.includes(':update') || grant.includes(':create') || grant.includes(':delete'))).toEqual(['table:@settings:update']);
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
        for (const option of column.rules?.options?.values ?? []) inEight(option.label, `${table.ref}.${column.ref}=${option.value}`);
      }
      for (const column of table.columns.filter((one) => one.type === 'enum')) expect(Object.keys(column.rules?.enumLabels?.labels ?? {}).sort(), `${table.ref}.${column.ref}`).toEqual([...(column.enum ?? [])].sort());
    }
    for (const one of roles) inEight(one.names, one.key);
    for (const page of manifest.addOn.pages) inEight(page.titles, page.ref);
  });
});
