/**
 * The guard on the repair that made a seeded line true in the shop that shows
 * it.
 *
 * WHAT IT IS ACTUALLY DEFENDING. Before `resolveActivity`, an add-on authored
 * `iso`, `hour`, `minute` and `ref` itself, and the host printed all four
 * verbatim: with the personalizer registered in Marlow Press — pinned to
 * Wednesday 5 August, 10:20 — the Add-ons drawer listed Birch Row's Thursday
 * the 6th against `BR-2284`, a reference Marlow Press has never issued. Nothing
 * threw and nothing was red, because nothing anywhere compared the two.
 *
 * The property below is the one that could not previously be stated: the SAME
 * declared entry, resolved in two shops, produces each shop's own day and each
 * shop's own paperwork.
 */

import { describe, expect, it } from 'vitest';

import { resolveActivity, type SeededActivityEntry } from './host.ts';

/** What an add-on declares, once, for every host it is ever registered in. */
const SEED: readonly SeededActivityEntry[] = [
  { minutesAgo: 22, refIndex: 0, messageKey: 'addon.x.act.1' },
  { minutesAgo: 25, messageKey: 'addon.x.act.2' },
  { minutesAgo: 1_158, refIndex: 1, messageKey: 'addon.x.act.3' },
];

const MARLOW = {
  now: { iso: '2026-08-05', hour: 10, minute: 20 },
  refs: ['MP-4119', 'MP-4116'],
};

const BIRCH_ROW = {
  now: { iso: '2026-08-06', hour: 16, minute: 40 },
  refs: ['BR-2284', 'BR-2281'],
};

describe('resolveActivity', () => {
  it('dates one declared seed into each shop’s own day and paperwork', () => {
    expect(resolveActivity(SEED, MARLOW)).toEqual([
      { iso: '2026-08-05', hour: 9, minute: 58, ref: 'MP-4119', messageKey: 'addon.x.act.1' },
      { iso: '2026-08-05', hour: 9, minute: 55, ref: '', messageKey: 'addon.x.act.2' },
      { iso: '2026-08-04', hour: 15, minute: 2, ref: 'MP-4116', messageKey: 'addon.x.act.3' },
    ]);

    expect(resolveActivity(SEED, BIRCH_ROW)).toEqual([
      { iso: '2026-08-06', hour: 16, minute: 18, ref: 'BR-2284', messageKey: 'addon.x.act.1' },
      { iso: '2026-08-06', hour: 16, minute: 15, ref: '', messageKey: 'addon.x.act.2' },
      { iso: '2026-08-05', hour: 21, minute: 22, ref: 'BR-2281', messageKey: 'addon.x.act.3' },
    ]);
  });

  /**
   * The line the old shape could not avoid printing: a shop with less history
   * than the add-on assumed got a timestamp against a blank reference. Dropping
   * it is the only honest answer — the add-on cannot know how much history a
   * host has, and an empty `ref` in a message that reads "· {ref}" is a
   * dangling separator.
   */
  it('drops a line naming a reference the host has not got', () => {
    const resolved = resolveActivity(SEED, { now: MARLOW.now, refs: ['MP-4119'] });
    expect(resolved.map((e) => e.messageKey)).toEqual(['addon.x.act.1', 'addon.x.act.2']);

    expect(resolveActivity(SEED, { now: MARLOW.now, refs: [] }).map((e) => e.messageKey)).toEqual([
      'addon.x.act.2',
    ]);
  });

  it('walks backwards across midnight, a month end and a leap day', () => {
    const oneDay: readonly SeededActivityEntry[] = [{ minutesAgo: 1_440, messageKey: 'k' }];
    const at = (iso: string) => resolveActivity(oneDay, { now: { iso, hour: 0, minute: 30 }, refs: [] })[0];

    expect(at('2026-08-01')).toMatchObject({ iso: '2026-07-31', hour: 0, minute: 30 });
    expect(at('2027-01-01')).toMatchObject({ iso: '2026-12-31', hour: 0, minute: 30 });
    expect(at('2028-03-01')).toMatchObject({ iso: '2028-02-29', hour: 0, minute: 30 });
    expect(at('2027-03-01')).toMatchObject({ iso: '2027-02-28', hour: 0, minute: 30 });
  });

  it('crosses midnight by the minute rather than by the day', () => {
    const [entry] = resolveActivity([{ minutesAgo: 31, messageKey: 'k' }], {
      now: { iso: '2026-08-05', hour: 0, minute: 10 },
      refs: [],
    });
    expect(entry).toEqual({
      iso: '2026-08-04',
      hour: 23,
      minute: 39,
      ref: '',
      messageKey: 'k',
    });
  });

  it('is empty for an add-on that seeds nothing', () => {
    expect(resolveActivity(undefined, MARLOW)).toEqual([]);
    expect(resolveActivity([], MARLOW)).toEqual([]);
  });

  /**
   * Determinism, said as a property rather than trusted. Every date in this
   * system is a function of a pinned clock (24 D11); a seeded history that
   * moved between two calls would be a demo nobody can screenshot.
   */
  it('gives the same answer twice', () => {
    expect(resolveActivity(SEED, MARLOW)).toEqual(resolveActivity(SEED, MARLOW));
  });
});
