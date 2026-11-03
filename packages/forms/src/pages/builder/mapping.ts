/**
 * WHICH QUESTION MAY FILL WHICH COLUMN of the table an answer becomes a row
 * of, as Adminium's door writes it.
 *
 * Short and long answers, a hidden field and the picks of a several-choice
 * question are text (the picks' stored names joined by ", "); a one-choice
 * answer is its pick's stored name, so it fills a text column or an enum; a
 * number fills a number column, a date a date, a score or stars a whole
 * number. A file is kept with the answer and a tick is a consent: neither
 * fills a column. A link to another row is never filled from a question,
 * whatever it says: only a named survey's invitation fills one.
 */
import type { FormTable, FormTableColumn } from '../shared/host.ts';
import type { Becomes, Definition, Question } from './draft.ts';

/**
 * A column as the kit describes it, with what Adminium 0.3.41 adds.
 * TODO(0.3.41): `values`, `maxLength` and the table's `sourceColumn` are on
 * the kit's own types from 0.3.41; drop these two once the floor is there.
 */
export type KitColumn = FormTableColumn & { values?: readonly string[]; maxLength?: number };
export type KitTable = Omit<FormTable, 'columns'> & { columns: readonly KitColumn[]; sourceColumn?: string; page?: string };

const TEXT = new Set(['text', 'varchar']);
const NUMBER = new Set(['integer', 'bigint', 'decimal', 'float']);
const WHOLE = new Set(['integer', 'bigint']);

/** Whether a question of this kind can be written into a column of that kind. */
export function fits(question: Question, column: KitColumn): boolean {
  if (column.link) return false;
  switch (question.kind) {
    case 'short':
    case 'long':
    case 'hidden':
    case 'several':
      return TEXT.has(column.kind);
    case 'one':
      return TEXT.has(column.kind) || column.kind === 'enum';
    case 'number':
      return NUMBER.has(column.kind);
    case 'date':
      return column.kind === 'date';
    case 'score':
    case 'stars':
      return WHOLE.has(column.kind);
    default:
      return false;
  }
}

/** The columns a question may be put in: every writable one but a link and the fixed source's. */
/**
 * Whether "becomes" names this table: by its id here (what the builder
 * writes), or by its stored name `<app>:<table>` (what a sample file writes,
 * as it cannot know a database's ids). Adminium reads both.
 */
export const namesTable = (table: Pick<KitTable, 'id' | 'tableRef'>, named: string): boolean => table.id === named || table.tableRef === named;

export const mappable = (table: KitTable): KitColumn[] => table.columns.filter((column) => !column.link && column.name !== table.sourceColumn);

/** The questions that may fill a column. */
export const fillersOf = (d: Definition, column: KitColumn): Question[] => d.questions.filter((question) => fits(question, column));

/** The question that fills a column, if one does. */
export const fillerOf = (becomes: Becomes, column: string): string | null => Object.entries(becomes.map).find(([, filled]) => filled === column)?.[0] ?? null;

/** A one-choice question's choices that are not values of the enum it fills: an answer picking one could not be written. */
export function offEnum(question: Question | undefined, column: KitColumn): string[] {
  if (question?.kind !== 'one' || column.kind !== 'enum' || column.values === undefined) return [];
  return question.choices.filter((choice) => !column.values!.includes(choice.id)).map((choice) => choice.id);
}

/** The map kept where the new table still takes it. */
export function mapFor(d: Definition, map: Readonly<Record<string, string>>, table: KitTable): Record<string, string> {
  const columns = new Map(mappable(table).map((column) => [column.name, column]));
  return Object.fromEntries(
    Object.entries(map).filter(([id, name]) => {
      const question = d.questions.find((one) => one.id === id);
      const column = columns.get(name);
      return question !== undefined && column !== undefined && fits(question, column);
    }),
  );
}

/** The kit's tables, as this builder reads them. */
export const kitTables = (tables: readonly FormTable[]): KitTable[] => tables as unknown as KitTable[];
