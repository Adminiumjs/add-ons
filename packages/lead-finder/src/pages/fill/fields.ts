/**
 * THE SHEET'S ROWS, from what a look-up found: one row per detail that would
 * change, with what the record holds now and what was found, and which
 * source found it.
 *
 * - A detail found the same as the record holds is no row: nothing changes.
 * - Two sources finding one detail: a register's word wins for what a
 *   register keeps (the name, the number, the address, the activity); the
 *   website's for what a website says best (about, phone, the website).
 * - Ticked at first: every row, but "What they do" when the record already
 *   says what the company does (a register's code words seldom read better
 *   than a person's own).
 * - A second look-up (the picker's "Use this one") adds its rows to what the
 *   website found the first time; the door still holds both.
 */
import type { LeadField, LookupReply } from '../shared/door.ts';

export interface FieldRow {
  field: LeadField;
  column: string;
  now: string | null;
  found: string;
  source: string;
}

/** Details a website tells better than a register. */
const WEBSITE_FIRST: ReadonlySet<LeadField> = new Set(['about', 'phone', 'website']);

const same = (a: string | null, b: string): boolean => (a ?? '').trim() === b.trim();

export function rowsOf(fields: LookupReply['fields'], website: string): FieldRow[] {
  const out: FieldRow[] = [];
  for (const one of fields) {
    if (one.found.length === 0) continue;
    const fromSite = one.found.find((found) => found.source === website);
    const fromRegister = one.found.find((found) => found.source !== website);
    const pick = WEBSITE_FIRST.has(one.field) ? (fromSite ?? fromRegister) : (fromRegister ?? fromSite);
    if (pick === undefined || same(one.now, pick.value)) continue;
    out.push({ field: one.field, column: one.column, now: one.now, found: pick.value, source: pick.source });
  }
  return out;
}

/** The rows ticked when they are first shown. */
export function firstTicks(rows: readonly FieldRow[]): Set<LeadField> {
  return new Set(rows.filter((row) => !(row.field === 'activity' && (row.now ?? '').trim() !== '')).map((row) => row.field));
}

/** A second look-up's fields put over the first's: the first's found values kept, the second's added. */
export function mergeFields(first: LookupReply['fields'], second: LookupReply['fields']): LookupReply['fields'] {
  const byField = new Map(first.map((one) => [one.field, { ...one, found: [...one.found] }]));
  for (const one of second) {
    const known = byField.get(one.field);
    if (known === undefined) {
      byField.set(one.field, { ...one, found: [...one.found] });
      continue;
    }
    known.now = one.now;
    for (const found of one.found) if (!known.found.some((was) => was.source === found.source)) known.found.push(found);
  }
  return [...byField.values()];
}
