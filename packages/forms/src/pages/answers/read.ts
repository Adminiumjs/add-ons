/**
 * WHAT THE ANSWERS TAB READS OF AN ANSWER, AND HOW IT WORDS IT.
 *
 * Adminium alone writes an answer: the door checks it against the form's
 * published copy and keeps the person's name and address on the row itself.
 * This tab only reads and deletes, so everything here is reading: a row as
 * the data kit hands it back, the questions an answer was sent to, the words
 * each value is shown in, and the filters the list asks the kit for.
 *
 * Pure: no host part, no read. The screens call these and the tests hold them.
 */
import { visibleQuestions } from '@adminium/add-on-contracts/forms/check';

import type { AddOnTranslate, DataFilter, DataRow, FormTable } from '../shared/host.ts';
import { epochOf, jsonOf, type FormRow } from '../shared/row.ts';

/** The answers table's own columns this tab reads; never the browser or the network address a tick keeps. */
export const ANSWER_COLUMNS = ['id', 'submitted_at', 'language', 'values', 'email', 'name', 'became_table', 'became_key', 'confirm', 'consent_purpose', 'consent_wording', 'consent_version', 'sent_from'] as const;
/** What the CSV holds: the same columns, as the export gives them to this reader. */
export const EXPORT_COLUMNS = ['submitted_at', 'name', 'email', 'became_table', 'became_key', 'language', 'values'] as const;
export const FILE_COLUMNS = ['id', 'answer_id', 'file_id', 'question', 'name', 'size', 'kind'] as const;
/** One page of the list. */
export const PAGE_SIZE = 50;

export type Confirm = 'none' | 'pending' | 'confirmed' | 'expired';

export interface Answer {
  id: string;
  submittedAt: string | null;
  language: string;
  values: Readonly<Record<string, unknown>>;
  email: string | null;
  name: string | null;
  becameTable: string | null;
  becameKey: string | null;
  confirm: Confirm;
  consentWording: string | null;
  consentVersion: number | null;
  sentFrom: string | null;
}

export interface AnswerFile {
  id: string;
  answerId: string;
  /** The upload's id: what staff open the file by. */
  fileId: string;
  question: string;
  name: string;
  size: number | null;
}

const textOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : typeof value === 'number' ? String(value) : null);
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function answerOf(row: DataRow): Answer {
  const values = jsonOf(row['values']);
  const confirm = row['confirm'];
  const version = Number(row['consent_version']);
  return {
    id: String(row['id']),
    submittedAt: textOf(row['submitted_at']),
    language: textOf(row['language']) ?? '',
    values: isRecord(values) ? values : {},
    email: textOf(row['email']),
    name: textOf(row['name']),
    becameTable: textOf(row['became_table']),
    becameKey: textOf(row['became_key']),
    confirm: confirm === 'pending' || confirm === 'confirmed' || confirm === 'expired' ? confirm : 'none',
    consentWording: textOf(row['consent_wording']),
    consentVersion: row['consent_version'] === null || row['consent_version'] === undefined || Number.isNaN(version) ? null : version,
    sentFrom: textOf(row['sent_from']),
  };
}

export function fileOf(row: DataRow): AnswerFile {
  const size = Number(row['size']);
  return {
    id: String(row['id']),
    answerId: String(row['answer_id']),
    fileId: textOf(row['file_id']) ?? '',
    question: textOf(row['question']) ?? '',
    name: textOf(row['name']) ?? '',
    size: row['size'] === null || row['size'] === undefined || Number.isNaN(size) ? null : size,
  };
}

/* ── the questions an answer was sent to ───────────────────────────────── */

type Words = Readonly<Record<string, string>>;

/** A question as this tab reads it from a definition: leniently, the published copy having passed the vocabulary's check. */
export interface Question {
  id: string;
  kind: string;
  label: Words;
  role?: string;
  check?: string;
  choices: readonly { id: string; label: Words }[];
  showIf?: { question: string; is?: string | number; includes?: string; atLeast?: number; atMost?: number };
  wordingVersion?: number;
}

export interface Questions {
  list: readonly Question[];
  languages: readonly string[];
  defaultLanguage: string | null;
  /** The definition as stored, for the vocabulary's own "which are shown". */
  definition: Record<string, unknown> | null;
}

const wordsOf = (value: unknown): Words => (isRecord(value) ? (Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) as Words) : {});

function questionOf(value: unknown): Question | null {
  if (!isRecord(value) || typeof value['id'] !== 'string' || typeof value['kind'] !== 'string') return null;
  const showIf = value['showIf'];
  return {
    id: value['id'],
    kind: value['kind'],
    label: wordsOf(value['label']),
    ...(typeof value['role'] === 'string' ? { role: value['role'] } : {}),
    ...(typeof value['check'] === 'string' ? { check: value['check'] } : {}),
    choices: Array.isArray(value['choices']) ? value['choices'].flatMap((choice) => (isRecord(choice) && typeof choice['id'] === 'string' ? [{ id: choice['id'], label: wordsOf(choice['label']) }] : [])) : [],
    ...(isRecord(showIf) && typeof showIf['question'] === 'string' ? { showIf: showIf as Question['showIf'] & object } : {}),
    ...(typeof value['wordingVersion'] === 'number' ? { wordingVersion: value['wordingVersion'] } : {}),
  };
}

/**
 * The questions strangers are answering: the published copy's, or, before a
 * form was ever published, the draft's (it has no answers then anyway).
 */
export function questionsOf(form: Pick<FormRow, 'published' | 'definition'>): Questions {
  const published = isRecord(form.published) ? form.published['definition'] : undefined;
  const definition = isRecord(published) ? published : isRecord(form.definition) ? form.definition : null;
  if (definition === null) return { list: [], languages: [], defaultLanguage: null, definition: null };
  const languages = Array.isArray(definition['languages']) ? definition['languages'].filter((one): one is string => typeof one === 'string') : [];
  return {
    list: Array.isArray(definition['questions']) ? definition['questions'].flatMap((one) => questionOf(one) ?? []) : [],
    languages,
    defaultLanguage: typeof definition['defaultLanguage'] === 'string' ? definition['defaultLanguage'] : (languages[0] ?? null),
    definition,
  };
}

/** The table the form's answers become rows of, by the id the kit names it with; null when it keeps answers only. */
export function becomesOf(form: Pick<FormRow, 'published' | 'settings'>): string | null {
  const published = isRecord(form.published) ? form.published['settings'] : undefined;
  const settings = isRecord(published) ? published : form.settings;
  const becomes = isRecord(settings) ? settings['becomes'] : null;
  return isRecord(becomes) && typeof becomes['table'] === 'string' ? becomes['table'] : null;
}

/** The question whose answer is the person's address: the one marked so, else the first checked as an address. */
export const emailQuestion = (questions: Questions): Question | undefined => questions.list.find((one) => one.role === 'email') ?? questions.list.find((one) => one.kind === 'short' && one.check === 'email');
export const companyQuestion = (questions: Questions): Question | undefined => questions.list.find((one) => one.role === 'company');

/**
 * Words in the reader's language when the form has it, else in the language
 * the answer was sent in, else the form's own; null when there are none.
 */
export function wordsIn(words: Words, order: readonly (string | null)[]): string | null {
  for (const tag of order) if (tag !== null && typeof words[tag] === 'string' && words[tag] !== '') return words[tag];
  const any = Object.values(words).find((one) => one !== '');
  return any ?? null;
}

/* ── what the list asks the kit for ────────────────────────────────────── */

export type When = '7' | '30' | 'all';
const DAY_MS = 86_400_000;

/** The earliest moment "When" keeps, to the minute so the list asks the same thing while it stays open; null for all time. */
export function sinceOf(when: When, now: number): string | null {
  if (when === 'all') return null;
  const minute = Math.floor(now / 60_000) * 60_000;
  return new Date(minute - Number(when) * DAY_MS).toISOString();
}

/**
 * The column a search looks in. The data kit's filters all hold together (one
 * AND), and an answer's questions are kept as JSON, which a text search
 * cannot read on every database: so a search finds a name, or an address
 * when what was typed has an @ in it.
 */
export const searchColumnOf = (typed: string): 'email' | 'name' => (typed.includes('@') ? 'email' : 'name');

export function filtersOf(formId: string, choice: { language: string; since: string | null; search: string }): DataFilter[] {
  const search = choice.search.trim();
  return [
    { column: 'form_id', op: 'eq', value: /^\d+$/.test(formId) ? Number(formId) : formId },
    ...(choice.language === 'all' ? [] : [{ column: 'language', op: 'eq' as const, value: choice.language }]),
    ...(choice.since === null ? [] : [{ column: 'submitted_at', op: 'gte' as const, value: choice.since }]),
    ...(search === '' ? [] : [{ column: searchColumnOf(search), op: 'contains' as const, value: search }]),
  ];
}

/* ── words ─────────────────────────────────────────────────────────────── */

const MB = 1024 * 1024;

/** A file's size as people read one: "2.1 MB", "840 KB" (a megabyte is 1024², as the door counts it). */
export function sizeOf(bytes: number | null, locale: string): string | null {
  if (bytes === null || bytes < 0) return null;
  const format = (value: number, unit: string): string => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value)} ${unit}`;
  if (bytes >= MB) return format(bytes / MB, 'MB');
  return format(Math.max(1, Math.round(bytes / 1024)), 'KB');
}

/** When an answer came, short ("28 Jul, 09:12") and whole ("Tue 28 Jul 2026, 09:12"), in the reader's language. */
export function whenOf(at: string | null, locale: string, whole = false): string {
  const epoch = epochOf(at);
  if (epoch === null) return '—';
  const options: Intl.DateTimeFormatOptions = whole ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
  return new Intl.DateTimeFormat(locale, options).format(epoch);
}

/** A key short enough for a cell: a long one (a UUID) keeps its first eight characters. */
export const shortKey = (key: string): string => (key.length > 12 ? `${key.slice(0, 8)}…` : key);

/** The row an answer became, as the reader may know it. */
export interface Became {
  /** The table's name as its app gives it; the stored name when no app opens it to forms any more. */
  table: string;
  key: string;
  /** Where the row opens, when the reader may open a page of that table. */
  to: string | null;
}

/** A table the kit lists, with the page Adminium 0.3.41 names for it (absent from an older host). */
export type OpenedTable = FormTable & { page?: string };

export function becameOf(answer: Pick<Answer, 'becameTable' | 'becameKey'>, tables: readonly OpenedTable[]): Became | null {
  if (answer.becameTable === null || answer.becameKey === null) return null;
  const table = tables.find((one) => one.tableRef === answer.becameTable);
  const stored = answer.becameTable.includes(':') ? answer.becameTable.slice(answer.becameTable.indexOf(':') + 1) : answer.becameTable;
  return {
    table: table?.label ?? stored,
    key: answer.becameKey,
    to: table?.page === undefined ? null : `/p/${encodeURIComponent(table.page)}/r/${encodeURIComponent(answer.becameKey)}`,
  };
}

/** One answer to one question, in words. `mono` for an address, a day and a number. */
export interface Shown {
  text: string;
  mono: boolean;
  /** A question the answer was never asked (its "show if" did not hold). */
  notAsked?: true;
}

const NUMBERED = new Set(['number', 'score', 'stars']);

/** The choice's label, in the order of languages given. */
function choiceLabel(question: Question, id: string, order: readonly (string | null)[]): string {
  const choice = question.choices.find((one) => one.id === id);
  return choice === undefined ? id : (wordsIn(choice.label, order) ?? id);
}

/** Why a question was not asked, worded from its "show if": "Not asked. “Seating” wasn’t picked." */
export function notAskedOf(t: AddOnTranslate, question: Question, questions: Questions, values: Readonly<Record<string, unknown>>, order: readonly (string | null)[]): string {
  const showIf = question.showIf;
  const earlier = showIf === undefined ? undefined : questions.list.find((one) => one.id === showIf.question);
  if (showIf === undefined || earlier === undefined) return t('answers.notAsked.plain', 'Not asked.');
  const asked = wordsIn(earlier.label, order) ?? earlier.id;
  if (values[earlier.id] === undefined) return t('answers.notAsked.unanswered', 'Not asked. “{question}” had no answer.', { question: asked });
  if (showIf.includes !== undefined) return t('answers.notAsked.picked', 'Not asked. “{choice}” wasn’t picked.', { choice: choiceLabel(earlier, showIf.includes, order) });
  if (typeof showIf.is === 'string') return t('answers.notAsked.picked', 'Not asked. “{choice}” wasn’t picked.', { choice: choiceLabel(earlier, showIf.is, order) });
  if (typeof showIf.is === 'number') return t('answers.notAsked.is', 'Not asked. “{question}” wasn’t {value}.', { question: asked, value: showIf.is });
  if (showIf.atLeast !== undefined) return t('answers.notAsked.below', 'Not asked. “{question}” was below {value}.', { question: asked, value: showIf.atLeast });
  if (showIf.atMost !== undefined) return t('answers.notAsked.above', 'Not asked. “{question}” was above {value}.', { question: asked, value: showIf.atMost });
  return t('answers.notAsked.plain', 'Not asked.');
}

/** The ids of the questions an answer was shown, by the vocabulary's own rule. */
export function askedOf(questions: Questions, values: Readonly<Record<string, unknown>>): ReadonlySet<string> {
  if (questions.definition === null) return new Set();
  try {
    return new Set(visibleQuestions({ definition: questions.definition as never }, values).map((one) => one.id));
  } catch {
    return new Set(questions.list.map((one) => one.id));
  }
}

/** An answer to a question, as the sheet shows it. Files and the tick have rows of their own. */
export function shownOf(t: AddOnTranslate, question: Question | undefined, value: unknown, order: readonly (string | null)[], locale: string): Shown {
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) return { text: t('answers.sheet.none', 'No answer'), mono: false };
  if (question === undefined) return { text: Array.isArray(value) ? value.map(String).join(', ') : String(value), mono: false };
  switch (question.kind) {
    case 'one':
      return { text: choiceLabel(question, String(value), order), mono: false };
    case 'several':
      return { text: (Array.isArray(value) ? value : [value]).map((one) => choiceLabel(question, String(one), order)).join(', '), mono: false };
    case 'date': {
      const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
      const text = day === null ? String(value) : new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3])));
      return { text, mono: true };
    }
    case 'stars':
      return { text: t('answers.sheet.stars', '{value} of 5', { value: String(value) }), mono: true };
    case 'score':
      return { text: t('answers.sheet.score', '{value} of 10', { value: String(value) }), mono: true };
    default: {
      if (NUMBERED.has(question.kind)) {
        const n = Number(value);
        return { text: Number.isFinite(n) ? new Intl.NumberFormat(locale).format(n) : String(value), mono: true };
      }
      const mono = question.check === 'email' || question.role === 'email';
      return { text: Array.isArray(value) ? value.map(String).join(', ') : String(value), mono };
    }
  }
}

/** The tick's line: whether it was ticked, the words' version, and where the confirmation stands. */
export function tickOf(t: AddOnTranslate, answer: Pick<Answer, 'confirm' | 'consentVersion' | 'submittedAt'>, question: Question, ticked: boolean, locale: string): string {
  if (!ticked) return t('answers.tick.not', 'Not ticked.');
  const version = answer.consentVersion ?? question.wordingVersion ?? null;
  const words = version === null ? t('answers.tick.ticked', 'Ticked.') : t('answers.tick.version', 'Ticked, words v{version}.', { version });
  switch (answer.confirm) {
    case 'pending':
      return `${words} ${t('answers.tick.pending', 'Confirmation mail sent {when}. Not confirmed yet.', { when: whenOf(answer.submittedAt, locale) })}`;
    case 'confirmed':
      return `${words} ${t('answers.tick.confirmed', 'Confirmed by e-mail.')}`;
    case 'expired':
      return `${words} ${t('answers.tick.expired', 'Not confirmed in time.')}`;
    default:
      return words;
  }
}
