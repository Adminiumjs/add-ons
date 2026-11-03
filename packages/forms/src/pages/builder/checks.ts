/**
 * WHAT STOPS A FORM GOING LIVE, before it is asked to.
 *
 * Publishing runs every check Adminium runs when a form goes live and lists
 * what fails, each at the place it belongs (a question, a section of the form
 * settings, the form itself): the vocabulary's own parse of the definition
 * and the settings (`parseForm`, the same code the engine publishes and draws
 * with), the privacy notice, the table an answer becomes a row of and each
 * column it fills, and the link name. A code and where; `words.ts` words it.
 *
 * Pure: no I/O.
 */
import { FORM_LANGUAGES, parseForm, type FormIssue } from '@adminium/add-on-contracts/forms';

import type { Definition, Draft, Lang } from './draft.ts';
import { fillerOf, fits, mappable, namesTable, offEnum, type KitTable } from './mapping.ts';
import { isFormSlug } from './slug.ts';

/** The form settings' sections, by the name `?settings=` opens them with. */
export const SETTINGS_SECTIONS = ['becomes', 'tick', 'after', 'tell', 'limits', 'files'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number] | 'survey';

export type Where = { at: 'form' } | { at: 'question'; id: string } | { at: 'section'; id: string } | { at: 'settings'; section: SettingsSection };

/** What a text is, for a sentence that names it. */
export type Field = 'title' | 'intro' | 'section' | 'label' | 'wording' | 'help' | 'choice' | 'ending' | 'source' | 'other';

export interface Problem {
  where: Where;
  /** The vocabulary's code, Zod's, or one of this file's own (below). */
  code: string;
  field?: Field;
  /** The language a text is missing in, or wrong in. */
  lang?: Lang;
  /** A choice's or a section's place, counted from 1. */
  n?: number;
  /** The question a problem shown in the form settings is about (a tick, a file question). */
  question?: string;
  /** A column, and what it says. */
  column?: string;
  names?: readonly string[];
  values?: readonly string[];
}

/** The codes this file adds to the vocabulary's. */
export const BUILDER_CODES = ['notice-unset', 'table-gone', 'column-gone', 'column-link', 'column-required', 'column-values', 'slug'] as const;

const isLang = (part: unknown): part is Lang => typeof part === 'string' && (FORM_LANGUAGES as readonly string[]).includes(part);

/** A vocabulary issue, placed: which question or section, which text, which language. */
export function placed(issue: FormIssue, d: Definition): Problem {
  const [under, first, second, ...rest] = issue.path;
  const lang = isLang(issue.path.at(-1)) ? (issue.path.at(-1) as Lang) : undefined;
  const base = { code: issue.code, ...(lang === undefined ? {} : { lang }) };
  if (under === 'settings') {
    const section: SettingsSection = first === 'becomes' ? 'becomes' : first === 'tell' || first === 'tellWhen' ? 'tell' : first === 'limits' ? 'limits' : 'survey';
    return { ...base, where: { at: 'settings', section }, ...(first === 'becomes' && second === 'source' ? { field: 'source' as const } : {}) };
  }
  if (first === 'questions' && typeof second === 'number') {
    const question = d.questions[second];
    if (question === undefined) return { ...base, where: { at: 'form' } };
    const part = rest[0];
    const field: Field = part === 'label' ? (question.kind === 'tick' ? 'wording' : 'label') : part === 'help' ? 'help' : part === 'choices' && rest[2] === 'label' ? 'choice' : 'other';
    const where: Where = question.kind === 'tick' && (part === 'purpose' || part === 'confirm' || part === 'label') ? { at: 'settings', section: 'tick' } : question.kind === 'file' && (part === 'maxMb' || part === 'kinds') ? { at: 'settings', section: 'files' } : { at: 'question', id: question.id };
    return { ...base, where, field, ...(field === 'choice' && typeof rest[1] === 'number' ? { n: rest[1] + 1 } : {}), ...(where.at === 'settings' ? { question: question.id } : {}) };
  }
  if (first === 'sections' && typeof second === 'number') {
    const section = d.sections?.[second];
    return { ...base, where: section === undefined ? { at: 'form' } : { at: 'section', id: section.id }, field: 'section', n: second + 1 };
  }
  if (first === 'ending') return { ...base, where: { at: 'settings', section: 'after' }, field: 'ending' };
  return { ...base, where: { at: 'form' }, field: first === 'title' ? 'title' : first === 'intro' ? 'intro' : 'other' };
}

export interface PublishFacts {
  /** Whether the privacy notice is set; null while it is not known. */
  notice: boolean | null;
  /** The tables apps open to forms; null while they are not known. */
  tables: readonly KitTable[] | null;
  /** The link name the form goes live with. */
  slug: string;
}

/** Everything that keeps this draft from going live, in the order it is fixed in. */
export function publishProblems(draft: Draft, facts: PublishFacts): Problem[] {
  const out: Problem[] = [];
  if (facts.notice === false) out.push({ where: { at: 'form' }, code: 'notice-unset' });
  const parsed = parseForm(draft.definition, draft.settings);
  if (!parsed.ok) out.push(...parsed.issues.map((issue) => placed(issue, draft.definition)));
  out.push(...mapProblems(draft, facts.tables));
  if (!isFormSlug(facts.slug)) out.push({ where: { at: 'form' }, code: 'slug' });
  return out;
}

/** The table an answer becomes a row of, held to what the app opens of it now. */
export function mapProblems(draft: Draft, tables: readonly KitTable[] | null): Problem[] {
  const becomes = draft.settings.becomes;
  if (becomes === null || becomes === undefined || tables === null) return [];
  const where: Where = { at: 'settings', section: 'becomes' };
  const table = tables.find((one) => namesTable(one, becomes.table));
  if (table === undefined) return [{ where, code: 'table-gone' }];
  const out: Problem[] = [];
  const columns = new Map(table.columns.map((column) => [column.name, column]));
  for (const [id, name] of Object.entries(becomes.map)) {
    const column = columns.get(name);
    if (column === undefined) out.push({ where, code: 'column-gone', column: name });
    else if (column.link) out.push({ where, code: 'column-link', column: column.label });
    else {
      const question = draft.definition.questions.find((one) => one.id === id);
      const off = offEnum(question, column);
      if (off.length > 0) out.push({ where, code: 'column-values', column: column.label, names: off, values: column.values ?? [] });
      else if (question !== undefined && !fits(question, column)) out.push({ where, code: 'column-gone', column: column.label });
    }
  }
  for (const column of mappable(table)) {
    if (column.required && fillerOf(becomes, column.name) === null) out.push({ where, code: 'column-required', column: column.label });
  }
  return out;
}

/** The problems that belong on one question's card. */
export const problemsAt = (problems: readonly Problem[], id: string): Problem[] => problems.filter((problem) => problem.where.at === 'question' && problem.where.id === id);
