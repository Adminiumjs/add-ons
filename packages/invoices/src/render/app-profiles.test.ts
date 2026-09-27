/**
 * The profiles three apps ship against this add-on, held to the outline and
 * to the subjects the rendering suites draw.
 *
 * Adminium checks a profile's columns against the app's tables, but a slot id
 * it maps that this add-on's outline does not have is dropped when the
 * document is drawn, and nothing warns. So the check that a profile names
 * only real slots — and, inside a list, only real columns — can only live
 * here, beside the outline. The second half ties each subject the suites
 * render to its profile: a subject may carry only what its profile maps, so a
 * drawn figure is one an app can really send.
 */

import type { DocumentSubject } from '@adminium/add-on-host/contracts';
import { describe, expect, it } from 'vitest';

import { describe as outlineOf } from '../kinds.ts';
import {
  FOLIO_PROFILE,
  folioSubject,
  KITCHEN_RECEIPT_PROFILE,
  orderSubject,
  TICKET_RECEIPT_PROFILE,
  ticketSubject,
  type AppProfile,
  type ProfileMapping,
} from '../testing/app-documents.ts';

const CASES: [string, AppProfile, DocumentSubject][] = [
  ['a guest house’s folio', FOLIO_PROFILE, folioSubject()],
  ['a lunch counter’s receipt', KITCHEN_RECEIPT_PROFILE, orderSubject()],
  ['a ticket office’s receipt', TICKET_RECEIPT_PROFILE, ticketSubject()],
];

/** The slot columns a list mapping names, over every source it reads. */
function columnsOf(mapping: ProfileMapping): string[] {
  if ('collection' in mapping) return Object.keys(mapping.collection.columns);
  if ('collections' in mapping) return [...new Set(mapping.collections.flatMap((source) => Object.keys(source.columns)))];
  return [];
}

describe.each(CASES)('%s', (_, profile, subject) => {
  const slots = outlineOf(profile.kind).slots;

  it('maps only slots this add-on draws', () => {
    const unknown = Object.keys(profile.mapping).filter((id) => !slots.some((slot) => slot.id === id));
    expect(unknown).toEqual([]);
  });

  it('maps a list only onto a list, and only onto its columns', () => {
    for (const [id, mapping] of Object.entries(profile.mapping)) {
      const slot = slots.find((entry) => entry.id === id)!;
      const isList = 'collection' in mapping || 'collections' in mapping;
      expect(slot.type === 'collection', id).toBe(isList);
      const unknown = columnsOf(mapping).filter((column) => !(slot.columns ?? []).some((entry) => entry.id === column));
      expect(unknown, id).toEqual([]);
    }
  });

  it('maps every slot the kind requires that Adminium does not fill itself', () => {
    const needed = slots.filter((slot) => slot.required && slot.default === undefined).map((slot) => slot.id);
    expect(needed.filter((id) => profile.mapping[id] === undefined)).toEqual([]);
  });

  it('is drawn from a subject carrying only what the profile maps', () => {
    expect(Object.keys(subject.fields).filter((id) => profile.mapping[id] === undefined)).toEqual([]);
    for (const [id, rows] of Object.entries(subject.collections)) {
      const mapping = profile.mapping[id];
      expect(mapping, id).toBeDefined();
      const columns = columnsOf(mapping!);
      for (const row of rows) expect(Object.keys(row).filter((column) => !columns.includes(column)), id).toEqual([]);
    }
  });
});

describe('the folio’s lines', () => {
  it('read the nights, then the extras switched on, then the charges not voided — one list, in that order', () => {
    const items = FOLIO_PROFILE.mapping.items!;
    expect('collections' in items).toBe(true);
    if (!('collections' in items)) return;
    expect(items.collections.map((source) => ('nightly' in source ? `nightly ${source.nightly}` : source.table))).toEqual([
      'nightly room_total',
      'stay_extras',
      'charges',
    ]);
  });
});
