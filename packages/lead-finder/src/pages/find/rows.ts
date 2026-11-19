/**
 * WHAT ONE FOUND COMPANY'S ROW SAYS, decided apart from how it is drawn.
 *
 * - "Added": this person added it in this search.
 * - "Already here": it is a row of the table already, one this person may
 *   open (a link to it); "Already here · kept by a colleague": one they may
 *   not open, said with no link and none of its values (the door sends no
 *   key for it).
 * - "Asked not to be contacted for sales": the register says so; no tick
 *   box (its details may still be filled in on a record you already have).
 * - "Sole trader: a person": a natural person; no tick box (people are kept
 *   from a company's Fill in, where they are told at once).
 */
import type { FoundView } from '../shared/door.ts';

export type RowState = 'added' | 'here' | 'colleague' | 'no-sales' | 'sole' | null;

export function rowState(company: FoundView, added: boolean): RowState {
  if (added) return 'added';
  if (company.here !== null) return company.here.keptByColleague || company.here.key === null ? 'colleague' : 'here';
  if (company.blocked?.reason === 'no-marketing') return 'no-sales';
  if (company.blocked !== null) return 'sole';
  return null;
}

/** Whether the row has a tick box at all (a flagged row has none). */
export const hasTickBox = (state: RowState): boolean => state !== 'no-sales' && state !== 'sole';

/** Whether it may be ticked to add. */
export const tickable = (state: RowState): boolean => state === null;

/** A website as a link: an https address only, shown without its scheme. */
export function websiteOf(company: FoundView): { href: string; shown: string } | null {
  const raw = company.website?.trim();
  if (raw === undefined || raw === '') return null;
  const href = /^https:\/\//i.test(raw) ? raw : /^[a-z][a-z0-9+.-]*:/i.test(raw) ? null : `https://${raw}`;
  if (href === null) return null;
  return { href, shown: href.replace(/^https:\/\//i, '').replace(/\/$/, '') };
}
