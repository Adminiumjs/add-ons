/**
 * THE MANIFEST, HELD TO WHAT IT PROMISES.
 *
 * Validated with the validator an install uses, then held to what a
 * validator cannot know: that its four forms tables carry every column
 * Adminium reads and writes, as the engine names them; that nobody of the
 * add-on writes an answer or a stranger's file; that each survey invitation
 * is mailed for the Surveys purpose with its own link; and that every word a
 * person reads is there in all eight languages.
 */
import { ANSWER_INVITATION_COLUMN, FORMS_COLUMNS, validateManifest } from '@adminiumjs/manifest';
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
  rules?: { personal?: boolean; enumLabels?: { labels: Record<string, Record<string, string>> }; options?: { values: { value: string; label: Record<string, string> }[] }; stamp?: unknown };
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
const allPages = [...manifest.pages.map((page) => page.ref), ...manifest.addOn.pages.map((page) => page.ref)];

describe('the manifest', () => {
  it('validates with the validator an install uses, and names the one file the build writes', () => {
    // TODO(0.3.41): validate the whole manifest once the pin is 0.3.41. The "Send a survey" step speaks
    // 0.3.41's words (a person input, a record named by its slug, help lines, the record tokens), which the
    // pinned 0.3.40 validator does not know; it is held to its shape in `survey-step.test.ts` until then.
    const { steps: _laterWords, ...readable } = manifest.addOn as typeof manifest.addOn & { steps?: unknown };
    void _laterWords;
    const result = validateManifest({ ...manifest, addOn: readable });
    expect(result.ok ? [] : result.issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
    expect(manifest.addOn.pages.map((page) => page.client)).toEqual([OUTPUT.pages.forms]);
    for (const page of manifest.addOn.pages) expect(BUILT_FILES).toContain(page.client);
  });

  it('is the forms add-on: every app, no connection, filed under marketing, on the release that sends surveys', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.key).toBe('forms');
    expect(manifest.addOn.attaches).toEqual([{ app: '*', range: '*' }]);
    expect(manifest.addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.categories).toEqual(['marketing']);
    // 0.3.41: the release whose rules can send a survey to a person (the step's words).
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.41');
    expect(manifest.requiredSchema.prefixed).toBe(true);
    // No code of its own runs on a server: Adminium draws, checks and keeps every form.
    expect((manifest.addOn as Record<string, unknown>)['provides']).toBeUndefined();
  });

  it('opens one code page, `forms`, in the Library, that takes a path of its own', () => {
    expect(manifest.addOn.pages).toEqual([expect.objectContaining({ ref: 'forms', detail: true, icon: 'clipboard-list', client: 'dist/pages/forms.js', nav: { group: 'library', order: 20 } })]);
  });
});

describe('the forms tables', () => {
  it('name the four parts as the engine reads them', () => {
    expect(manifest.addOn.forms).toEqual({ forms: 'forms', answers: 'answers', invitations: 'invitations', files: 'answer_files' });
  });

  it('carry every column Adminium reads and writes, of its kind', () => {
    const parts = manifest.addOn.forms as Record<string, string>;
    for (const [part, contract] of Object.entries(FORMS_COLUMNS)) {
      for (const [name, want] of Object.entries(contract)) {
        const column = columnOf(parts[part]!, name);
        expect(want.types, `${part}.${name}`).toContain(column.type);
        if (want.nullable === true) expect(column.nullable, `${part}.${name}`).toBe(true);
        if (want.unique === true) expect(column.unique, `${part}.${name}`).toBe(true);
        if (want.values !== undefined) expect([...(column.enum ?? [])].sort(), `${part}.${name}`).toEqual([...want.values].sort());
        if (want.links !== undefined) expect(column.references, `${part}.${name}`).toBe(parts[want.links]);
        if (want.atLeast !== undefined && column.maxLength !== undefined) expect(column.maxLength, `${part}.${name}`).toBeGreaterThanOrEqual(want.atLeast);
      }
    }
    expect(columnOf('answers', ANSWER_INVITATION_COLUMN)).toMatchObject({ type: 'fk', references: 'invitations', nullable: true });
  });

  it('keep beside them what the screens read: a name, when it changed and closed, who made it, and what an invitation was about', () => {
    expect(columnOf('forms', 'name')).toMatchObject({ type: 'text', maxLength: 200 });
    expect(columnOf('forms', 'updated_at')).toMatchObject({ type: 'timestamptz', role: 'updated_at' });
    expect(columnOf('forms', 'closed_at').rules?.stamp).toEqual({ set: 'now', on: { column: 'state', values: ['closed'] } });
    expect(columnOf('forms', 'created_by_id').rules?.stamp).toEqual({ set: 'user-id', on: 'create' });
    for (const name of ['about', 'company', 'rule_name']) expect(columnOf('invitations', name), name).toMatchObject({ type: 'text', maxLength: 200, nullable: true });
    // The record a survey is about is named by its table's stored name, which Adminium rewrites when the table is renamed.
    expect(columnOf('invitations', 'record_table').rules).toEqual({ tableRef: true });
  });

  it('every column Adminium never fills on the answers and the files may be left empty', () => {
    for (const part of ['answers', 'answer_files'] as const) {
      const contract = FORMS_COLUMNS[part === 'answers' ? 'answers' : 'files'];
      for (const column of tableOf(part).columns) {
        if (contract[column.ref] !== undefined || column.role === 'pk' || column.ref === ANSWER_INVITATION_COLUMN) continue;
        expect(column.nullable === true || column.default !== undefined, `${part}.${column.ref}`).toBe(true);
      }
    }
  });

  it('number the outbox's own rows: Adminium writes them, and fills no text key of a row it writes there', () => {
    expect(columnOf('invitation_mails', 'id')).toEqual({ ref: 'id', type: 'int', role: 'pk' });
  });

  it('mark as personal every column that holds who answered and what they wrote', () => {
    const personal = (table: string, column: string): boolean => columnOf(table, column).rules?.personal === true;
    for (const name of ['email', 'name', 'values', 'ip', 'user_agent', 'consent_wording', 'sent_from']) expect(personal('answers', name), `answers.${name}`).toBe(true);
    for (const name of ['email', 'name', 'company']) expect(personal('invitations', name), `invitations.${name}`).toBe(true);
    expect(personal('invitation_mails', 'to_address')).toBe(true);
  });

  it('move a form from draft to live, live to closed and closed to live again, and delete a draft only', () => {
    expect(tableOf('forms').states).toEqual({ column: 'state', initial: 'draft', moves: { draft: ['live'], live: ['closed'], closed: ['live'] }, noDelete: { when: ['live', 'closed'] } });
    expect(columnOf('forms', 'state').default).toBe('draft');
  });

  it('keep one settings row: answers kept 24 months unless set, chosen from the months the keeping page offers', () => {
    expect(manifest.addOn.settingsTable).toBe('settings');
    const months = columnOf('settings', 'answers_months');
    expect(months).toMatchObject({ type: 'int', nullable: true, default: 24 });
    expect(months.rules?.options?.values.map((one) => one.value)).toEqual(['3', '6', '12', '24', '36']);
  });
});

describe('the roles', () => {
  it('are a manager and a reader', () => {
    expect(roles.map((one) => one.key)).toEqual(['manager', 'reader']);
  });

  it('let nobody of the add-on write an answer or a stranger’s file: Adminium alone does', () => {
    for (const one of roles) {
      for (const table of ['answers', 'answer_files']) for (const action of ['create', 'update', 'import']) expect(one.permissions, `${one.key} ${action} ${table}`).not.toContain(`table:@${table}:${action}`);
    }
  });

  it('give the manager the forms, the answers to read and delete, the invitations and their mails to read, and the settings', () => {
    expect(role('manager').permissions).toEqual(
      expect.arrayContaining([
        ...['read', 'create', 'update', 'delete'].map((action) => `table:@forms:${action}`),
        'table:@answers:read',
        'table:@answers:delete',
        'table:@invitations:read',
        'table:@answer_files:read',
        'table:@invitation_mails:read',
        'table:@settings:read',
        'table:@settings:update',
      ]),
    );
  });

  it('let the reader read and change nothing', () => {
    expect(role('reader').permissions.filter((grant) => grant.startsWith('table:') && !grant.endsWith(':read'))).toEqual([]);
  });

  it('open every page to the widest role, and give every page a grant in some role', () => {
    for (const ref of allPages) expect(role('manager').permissions, ref).toContain(`page:@${ref}:view`);
    expect(role('reader').permissions).toContain('page:@forms:view');
    // The keeping time is a manager's: the reader is not shown its page.
    expect(role('reader').permissions).not.toContain('page:@forms-settings:view');
  });
});

describe('the invitations’ mail', () => {
  const outbox = manifest.outbox as unknown as { kinds: Record<string, string>; classes: Record<string, string>; purposes: Record<string, string>; surveyLinks: string[]; producers: { kind: string; onCreate: { table: string; where: { column: string; eq: string } } }[] };

  it('classes every kind, gives each the Surveys purpose, and prints each one’s own link', () => {
    expect(Object.keys(outbox.kinds).sort()).toEqual(['invite-marketing', 'invite-service']);
    expect(outbox.classes).toEqual({ 'invite-marketing': 'marketing', 'invite-service': 'service' });
    expect(outbox.purposes).toEqual({ 'invite-marketing': 'surveys', 'invite-service': 'surveys' });
    expect([...outbox.surveyLinks].sort()).toEqual(['invite-marketing', 'invite-service']);
  });

  it('queues one mail for each invitation as it is made, by its class', () => {
    expect(outbox.producers.map((producer) => [producer.kind, producer.onCreate.table, producer.onCreate.where.eq])).toEqual([
      ['invite-marketing', 'invitations', 'marketing'],
      ['invite-service', 'invitations', 'service'],
    ]);
  });

  it('is one template in eight languages, with the link, the greeting by name and what it is about', () => {
    const template = manifest.emailTemplates.find((one) => one.key === 'forms-invite')!;
    expect(Object.keys(template.locales).sort()).toEqual([...LOCALES].sort());
    for (const [tag, content] of Object.entries(template.locales)) {
      const text = JSON.stringify(content);
      expect(text, tag).toContain('{{survey_link}}');
      expect(text, tag).toContain('{{recipient.name}}');
      expect(text, tag).toContain('{{invitation.about}}');
    }
  });
});

describe('every word a person reads', () => {
  const inEight = (words: unknown, where: string): void => {
    expect(Object.keys(words as object).sort(), where).toEqual([...LOCALES].sort());
    for (const [tag, text] of Object.entries(words as Record<string, string>)) expect(text.trim(), `${where} ${tag}`).not.toBe('');
  };

  it('is in eight languages: columns, their choices, roles, pages and the template’s name', () => {
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
    for (const page of [...manifest.pages, ...manifest.addOn.pages]) inEight(page.titles, page.ref);
    for (const template of manifest.emailTemplates) inEight(template.name, template.key);
  });
});
