/**
 * THE "SEND A SURVEY" STEP AND THE "SURVEY" RECORD TAB, HELD TO WHAT THEY PROMISE.
 *
 * A rule's step writes one invitation: the survey named by its slug (only a
 * live survey), the person the rule's record is about (their address, name,
 * language and company, and their row as the consent log names it), the
 * record itself as other rows name it, the rule, and the kind of mail. The
 * outbox mails it with the person's own link. The record tab shows those
 * invitations on the record they were about.
 *
 * `manifest.test.ts` validates the whole manifest with the pinned validator;
 * the shape checks here are what a validator cannot know.
 */
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };

const LOCALES = ['en-US', 'de-DE', 'fr-FR', 'da-DK', 'cs-CZ', 'ar-EG', 'zh-CN', 'zh-TW'];

interface Column {
  ref: string;
  type: string;
  role?: string;
  nullable?: boolean;
  default?: unknown;
  enum?: string[];
  rules?: Record<string, unknown>;
}
type Words = Record<string, string>;
interface Input {
  key: string;
  kind: string;
  required?: boolean;
  label: Words;
  help?: Words;
  table?: string;
  by?: string;
  where?: { column: string; eq: unknown }[];
  options?: { value: string; label: Words; help?: Words }[];
}
interface Step {
  key: string;
  name: Words;
  does: Words;
  inputs: Input[];
  writes: { table: string; values: Record<string, Record<string, string>> };
}
interface Tab {
  id: string;
  label: { key: string; fallback: string };
  labels: Words;
  table: string;
  match: { table: string; row: string };
  on: string | string[];
  columns: string[];
  empty: { key: string; fallback: string };
  empties: Words;
}

const addOn = manifest.addOn as typeof manifest.addOn & { steps?: Step[]; recordTabs?: Tab[] };
const steps = addOn.steps ?? [];
const tabs = addOn.recordTabs ?? [];
const step = steps.find((one) => one.key === 'send-survey') as Step;
const tab = tabs.find((one) => one.id === 'survey') as Tab;
const tables = manifest.requiredSchema.tables as unknown as { ref: string; columns: Column[] }[];
const columnsOf = (table: string): Column[] => tables.find((one) => one.ref === table)?.columns ?? [];
const columnOf = (table: string, ref: string): Column | undefined => columnsOf(table).find((column) => column.ref === ref);
const input = (key: string): Input => step.inputs.find((one) => one.key === key) as Input;

/** Every word a person reads, in all eight languages, within the length the step's contract allows. */
function inEveryLanguage(words: Words | undefined, max: number, at: string): void {
  expect(Object.keys(words ?? {}).sort(), at).toEqual([...LOCALES].sort());
  for (const [tag, text] of Object.entries(words ?? {})) {
    expect(text.trim(), `${at} ${tag}`).not.toBe('');
    expect(text.length, `${at} ${tag}`).toBeLessThanOrEqual(max);
  }
  // Translated, not English copied: only a word the languages share may read the same.
  const english = (words ?? {})['en-US'];
  const same = Object.entries(words ?? {}).filter(([tag, text]) => tag !== 'en-US' && text === english);
  expect(same.length, `${at}: ${same.map(([tag]) => tag).join(' ')}`).toBeLessThanOrEqual(1);
}

describe('the "Send a survey" step', () => {
  it('is the add-on’s one step, named and described in eight languages, on the release that runs it', () => {
    expect(steps.map((one) => one.key)).toEqual(['send-survey']);
    expect(step.name['en-US']).toBe('Send a survey');
    expect(step.does['en-US']).toBe('Sends one of your surveys to a person, with their own link');
    inEveryLanguage(step.name, 60, 'name');
    inEveryLanguage(step.does, 160, 'does');
    expect(manifest.compatibility.minAdminiumVersion).toBe('0.3.41');
  });

  it('asks for the survey by its slug, offering live surveys only, then whom to send it to and as which mail', () => {
    expect(step.inputs.map((one) => [one.key, one.kind, one.required])).toEqual([
      ['survey', 'record', true],
      ['to', 'person', true],
      ['class', 'choice', true],
    ]);
    const survey = input('survey');
    expect(survey).toMatchObject({ table: 'forms', by: 'slug' });
    // A rule shipped in an app names its survey by slug: the slug is unique, so it names one row.
    expect(columnOf('forms', 'slug')).toMatchObject({ unique: true });
    expect(survey.where).toEqual([
      { column: 'kind', eq: 'survey' },
      { column: 'state', eq: 'live' },
    ]);
    for (const condition of survey.where ?? []) expect(columnOf('forms', condition.column)?.enum, condition.column).toContain(condition.eq);
    expect(survey.help?.['en-US']).toBe('Only live surveys are listed.');
    for (const one of step.inputs) inEveryLanguage(one.label, 60, `${one.key}.label`);
    inEveryLanguage(survey.help, 160, 'survey.help');
  });

  it('offers marketing mail first, as the default, and says what each kind of mail does', () => {
    const mail = input('class');
    expect(mail.label['en-US']).toBe('Kind of mail');
    expect(mail.options?.map((option) => [option.value, option.label['en-US'], option.help?.['en-US']])).toEqual([
      ['marketing', 'Marketing mail (default)', 'Goes only to people who may be e-mailed for Surveys, with an unsubscribe link.'],
      ['service', 'Service mail', 'Use only for mail about work you did for them. People who said no to surveys are still skipped.'],
    ]);
    // The two kinds are exactly what an invitation's class holds, and what the outbox mails each as.
    expect(mail.options?.map((option) => option.value).sort()).toEqual([...(columnOf('invitations', 'class')?.enum ?? [])].sort());
    for (const option of mail.options ?? []) {
      inEveryLanguage(option.label, 60, `class.${option.value}.label`);
      inEveryLanguage(option.help, 160, `class.${option.value}.help`);
    }
  });

  it('writes one invitation: the survey, the person, the record it is about, the rule, the mail and when', () => {
    expect(step.writes.table).toBe(addOn.forms.invitations);
    expect(step.writes.values).toEqual({
      form_id: { input: 'survey' },
      email: { person: 'to', field: 'email' },
      name: { person: 'to', field: 'name' },
      language: { person: 'to', field: 'language' },
      company: { person: 'to', field: 'company' },
      person_table: { person: 'to', field: 'table' },
      person_key: { person: 'to', field: 'key' },
      record_table: { token: 'recordTable' },
      record_key: { token: 'recordKey' },
      about: { token: 'recordLabel' },
      rule_name: { token: 'ruleName' },
      class: { input: 'class' },
      invited_at: { token: 'now' },
    });
  });

  it('fills every invitation column a row cannot be saved without, and leaves the link, its end and the answer to Adminium', () => {
    const filled = new Set(Object.keys(step.writes.values));
    for (const column of columnsOf('invitations')) {
      if (column.role === 'pk' || column.nullable === true || column.default !== undefined) continue;
      expect(filled.has(column.ref), `invitations.${column.ref}`).toBe(true);
    }
    // The link is made when the mail is sent, and spent when the person answers: never by the rule.
    for (const ref of ['token_hash', 'expires_at', 'answered_at']) expect(filled.has(ref), ref).toBe(false);
    for (const ref of filled) expect(columnOf('invitations', ref), ref).toBeDefined();
  });

  it('puts a person’s address, name and company only into columns kept personal', () => {
    for (const [ref, value] of Object.entries(step.writes.values)) {
      if (value['person'] === undefined || !['email', 'name', 'company'].includes(value['field'] ?? '')) continue;
      expect(columnOf('invitations', ref)?.rules?.['personal'], ref).toBe(true);
    }
  });

  it('names the record it is about as a record tab matches it: a table’s stored name and the row’s key, as text', () => {
    expect(columnOf('invitations', 'record_table')).toMatchObject({ type: 'text', rules: { tableRef: true } });
    expect(columnOf('invitations', 'record_key')).toMatchObject({ type: 'text' });
  });
});

describe('the "Survey" record tab', () => {
  it('lists, on the record a rule sent a survey about, which survey went, when, whether it was answered and as which mail', () => {
    expect(tabs.map((one) => one.id)).toEqual(['survey']);
    expect(tab).toMatchObject({ table: 'invitations', match: { table: 'record_table', row: 'record_key' }, on: 'linked', columns: ['form_id', 'invited_at', 'answered_at', 'class'] });
    for (const column of tab.columns) expect(columnOf('invitations', column), column).toBeDefined();
    // Nobody's address or name shows on another table's record.
    for (const column of tab.columns) expect(columnOf('invitations', column)?.rules?.['personal'], column).not.toBe(true);
    expect(tab).not.toHaveProperty('edit');
    expect(tab).not.toHaveProperty('add');
    expect(tab).not.toHaveProperty('remove');
  });

  it('is named and empty in eight languages', () => {
    expect(tab.label).toEqual({ key: 'addon.forms.tab.survey', fallback: 'Survey' });
    expect(tab.empty).toEqual({ key: 'addon.forms.tab.survey.empty', fallback: 'No survey sent yet' });
    expect(tab.labels['en-US']).toBe(tab.label.fallback);
    expect(tab.empties['en-US']).toBe(tab.empty.fallback);
    inEveryLanguage(tab.labels, 60, 'labels');
    inEveryLanguage(tab.empties, 160, 'empties');
  });
});

describe('the row an answer became', () => {
  it('is named by its table’s stored name, which Adminium rewrites when that table is renamed', () => {
    expect(columnOf('answers', 'became_table')).toMatchObject({ type: 'text', rules: { tableRef: true } });
  });

  it('while the person an invitation names is kept by the table id the consent log keys on, which is not a stored name', () => {
    expect(columnOf('invitations', 'person_table')?.rules?.['tableRef']).toBeUndefined();
  });
});
