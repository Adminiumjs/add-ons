import { describe, expect, it } from 'vitest';

import { draftValues } from '../forms/newForm.ts';
import { mapProblems, publishProblems, type Problem } from './checks.ts';
import { addLanguage, addQuestion, draftOf, mapColumn, newQuestion, type Draft } from './draft.ts';
import { fillersOf, fits, mappable, mapFor, offEnum, type KitTable } from './mapping.ts';
import { isFormSlug, readableSlug, slugAtPublish } from './slug.ts';
import { startingWords } from './starting.ts';

const t = (_key: string, english: string): string => english;

function draft(kinds: Parameters<typeof newQuestion>[1][] = ['short', 'long']): Draft {
  const values = draftValues(t, 'form', 'en-US', 'form-abc234');
  let d = draftOf(values['definition'], values['settings'], 'form', 'en-US');
  for (const kind of kinds) d = { ...d, definition: addQuestion(d.definition, newQuestion(d.definition, kind, 'en-US', startingWords('en-US'), '2026-11-03')) };
  return d;
}

const ENQUIRIES: KitTable = {
  id: 'tbl-enquiries',
  tableRef: 'crm:enquiries',
  label: 'Enquiries',
  app: 'Sales CRM',
  sourceColumn: 'from_form',
  columns: [
    { name: 'person', label: 'Name', kind: 'text', required: false, link: false },
    { name: 'company_name', label: 'Company', kind: 'varchar', required: true, link: false },
    { name: 'wanted_on', label: 'Wanted on', kind: 'date', required: false, link: false },
    { name: 'brochure', label: 'Brochure', kind: 'enum', required: false, link: false, values: ['yes', 'no'] },
    { name: 'seats', label: 'Seats', kind: 'integer', required: false, link: false },
    { name: 'contact_id', label: 'Contact', kind: 'text', required: false, link: true },
    { name: 'from_form', label: 'From form', kind: 'text', required: false, link: false },
  ],
};

describe('publishing’s checks', () => {
  it('refuse while the privacy notice is unset, first of all', () => {
    expect(publishProblems(draft(), { notice: false, tables: [], slug: 'form-abc234' })[0]).toEqual({ where: { at: 'form' }, code: 'notice-unset' });
    expect(publishProblems(draft(), { notice: true, tables: [], slug: 'form-abc234' })).toEqual([]);
    // Not known (an older server): Adminium itself still refuses at the move.
    expect(publishProblems(draft(), { notice: null, tables: [], slug: 'form-abc234' })).toEqual([]);
  });

  it('refuse a draft with no question', () => {
    expect(publishProblems(draft([]), { notice: true, tables: [], slug: 'form-abc234' })).toEqual([{ where: { at: 'form' }, code: 'too_small', field: 'other' }]);
  });

  it('place a missing translation at its question, with the language', () => {
    let d = draft(['short']);
    d = { ...d, definition: addLanguage(d.definition, 'de-DE') };
    d = { ...d, definition: addQuestion(d.definition, newQuestion(d.definition, 'long', 'en-US', startingWords('en-US'), '2026-11-03')) };
    expect(publishProblems(d, { notice: true, tables: [], slug: 'form-abc234' })).toEqual([{ where: { at: 'question', id: 'q2' }, code: 'words-missing', field: 'label', lang: 'de-DE' }]);
  });

  it('place a tick that wants an e-mail it cannot have in the tick’s settings', () => {
    const problems = publishProblems(draft(['tick']), { notice: true, tables: [], slug: 'form-abc234' });
    expect(problems).toEqual([{ where: { at: 'settings', section: 'tick' }, code: 'tick-confirm-email', field: 'other', question: 'q1' }]);
  });

  it('refuse a link name Adminium would not serve', () => {
    expect(publishProblems(draft(), { notice: true, tables: [], slug: 'surveys' })).toEqual([{ where: { at: 'form' }, code: 'slug' }]);
  });
});

describe('the map of an answer onto a row', () => {
  const d = draft(['short', 'one', 'several', 'date', 'score', 'file', 'tick', 'hidden']);

  it('never offers a link column to any question', () => {
    const link = ENQUIRIES.columns.find((column) => column.link)!;
    for (const question of d.definition.questions) expect(fits(question, link)).toBe(false);
    expect(mappable(ENQUIRIES).map((column) => column.name)).not.toContain('contact_id');
  });

  it('offers no column to a file or a tick, and keeps the source column for the fixed value', () => {
    expect(mappable(ENQUIRIES).map((column) => column.name)).not.toContain('from_form');
    const text = ENQUIRIES.columns[0]!;
    expect(fillersOf(d.definition, text).map((one) => one.kind)).toEqual(['short', 'one', 'several', 'hidden']);
    expect(fillersOf(d.definition, ENQUIRIES.columns[2]!).map((one) => one.kind)).toEqual(['date']);
    expect(fillersOf(d.definition, ENQUIRIES.columns[4]!).map((one) => one.kind)).toEqual(['score']);
    expect(fillersOf(d.definition, ENQUIRIES.columns[3]!).map((one) => one.kind)).toEqual(['one']);
  });

  it('says which choices are not an enum’s values', () => {
    expect(offEnum(d.definition.questions[1], ENQUIRIES.columns[3]!)).toEqual(['choice-1', 'choice-2']);
  });

  it('fills a column with one question, and a question fills one column', () => {
    let becomes = { table: ENQUIRIES.id, map: {} as Record<string, string> };
    becomes = mapColumn(becomes, 'person', 'q1');
    becomes = mapColumn(becomes, 'company_name', 'q1');
    expect(becomes.map).toEqual({ q1: 'company_name' });
    becomes = mapColumn(becomes, 'company_name', 'q8');
    expect(becomes.map).toEqual({ q8: 'company_name' });
    expect(mapFor(d.definition, { q8: 'company_name', q5: 'person' }, ENQUIRIES)).toEqual({ q8: 'company_name' });
  });

  it('flags a table gone, a column gone or turned into a link, an unfilled required column and an enum mismatch', () => {
    const at = (map: Record<string, string>, tables = [ENQUIRIES]): Problem[] => mapProblems({ ...d, settings: { ...d.settings, becomes: { table: ENQUIRIES.id, map } } }, tables);
    expect(at({}, [])).toEqual([{ where: { at: 'settings', section: 'becomes' }, code: 'table-gone' }]);
    expect(at({ q8: 'company_name' })).toEqual([]);
    expect(at({}).map((problem) => problem.code)).toEqual(['column-required']);
    expect(at({ q8: 'company_name', q1: 'gone' }).map((problem) => problem.code)).toEqual(['column-gone']);
    expect(at({ q8: 'company_name', q1: 'contact_id' }).map((problem) => problem.code)).toEqual(['column-link']);
    expect(at({ q8: 'company_name', q2: 'brochure' })).toEqual([{ where: { at: 'settings', section: 'becomes' }, code: 'column-values', column: 'Brochure', names: ['choice-1', 'choice-2'], values: ['yes', 'no'] }]);
  });
});

describe('the link name at the first publish', () => {
  it('reads the title as ASCII letters and digits', () => {
    expect(readableSlug('Book a showroom visit')).toBe('book-a-showroom-visit');
    expect(readableSlug('Größe & Maße — Café')).toBe('grosse-masse-cafe');
    expect(readableSlug('预约参观')).toBeNull();
    expect(readableSlug('API')).toBeNull();
    expect(readableSlug(`${'x'.repeat(79)} y`)).toBe('x'.repeat(79));
  });

  it('is taken only at the first publish, and never when another form has it', () => {
    expect(slugAtPublish('form-abc234', true, 'Showroom visit', () => false)).toBe('showroom-visit');
    expect(slugAtPublish('form-abc234', true, 'Showroom visit', () => true)).toBe('form-abc234');
    expect(slugAtPublish('form-abc234', false, 'Showroom visit', () => false)).toBe('form-abc234');
    expect(slugAtPublish('form-abc234', true, 'Surveys', () => false)).toBe('form-abc234');
  });

  it('holds the door’s rule', () => {
    expect(isFormSlug('form-abc234')).toBe(true);
    for (const bad of ['', '-a', 'a-', 'A', 'api', 'surveys', 'x'.repeat(81), 'a b']) expect(isFormSlug(bad), bad).toBe(false);
  });
});
