/**
 * THE ACTIVITY LISTS: complete, well-formed, in each register's own scheme,
 * and holding the comp's examples word for word.
 */
import { describe, expect, it } from 'vitest';

import { ACTIVITY_LISTS, activityLabel, activityOf, codesStartingWith } from './index.ts';

describe('the activity lists', () => {
  it('hold the comp’s examples, code and words exactly', () => {
    expect(activityOf('companies-house', '71111')?.label['en-US']).toBe('Architectural activities');
    expect(activityOf('france', '71.11Z')?.label['fr-FR']).toBe("Activités d'architecture");
    // SN2025: the comp's SN2007 "Arkitekttjenester · 71.112" finds nothing in the register now.
    expect(activityOf('norway', '71.110')?.label['nb-NO']).toBe('Arkitektvirksomhet');
    expect(activityOf('norway', '71.112')).toBeUndefined();
  });

  it('are each register’s whole list at its finest level, every code once', () => {
    expect(ACTIVITY_LISTS['companies-house'].codes).toHaveLength(731);
    expect(ACTIVITY_LISTS.france.codes).toHaveLength(732);
    expect(ACTIVITY_LISTS.norway.codes).toHaveLength(738);
    for (const [source, list] of Object.entries(ACTIVITY_LISTS)) expect(new Set(list.codes.map((one) => one.code)).size, source).toBe(list.codes.length);
  });

  it('write each code in its scheme’s own shape', () => {
    for (const one of ACTIVITY_LISTS['companies-house'].codes) expect(one.code).toMatch(/^\d{5}$/);
    for (const one of ACTIVITY_LISTS.france.codes) expect(one.code).toMatch(/^\d{2}\.\d{2}[A-Z]$/);
    for (const one of ACTIVITY_LISTS.norway.codes) expect(one.code).toMatch(/^\d{2}\.\d{3}$/);
  });

  it('give each code a label in the register’s own language, and Norway’s in English too', () => {
    for (const one of ACTIVITY_LISTS['companies-house'].codes) expect(one.label['en-US']?.trim(), one.code).toBeTruthy();
    for (const one of ACTIVITY_LISTS.france.codes) expect(one.label['fr-FR']?.trim(), one.code).toBeTruthy();
    for (const one of ACTIVITY_LISTS.norway.codes) expect(one.label['nb-NO']?.trim(), one.code).toBeTruthy();
    expect(ACTIVITY_LISTS.norway.codes.filter((one) => one.label['en-US'] === undefined)).toEqual([]);
    for (const list of Object.values(ACTIVITY_LISTS)) for (const one of list.codes) for (const label of Object.values(one.label)) expect(label.length, one.code).toBeLessThanOrEqual(300);
  });

  it('read a label in the reader’s language, else the register’s', () => {
    const architects = activityOf('norway', '71.110')!;
    expect(activityLabel(architects, 'en-US')).toBe('Architectural activities');
    expect(activityLabel(architects, 'en-GB')).toBe('Architectural activities');
    expect(activityLabel(architects, 'de-DE')).toBe('Arkitektvirksomhet');
  });

  it('find every code a prefix begins, dots and case aside', () => {
    expect(codesStartingWith('companies-house', '7111')).toEqual(['71111', '71112']);
    expect(codesStartingWith('france', '71.1')).toEqual(['71.11Z', '71.12A', '71.12B']);
    expect(codesStartingWith('france', '7112b')).toEqual(['71.12B']);
    expect(codesStartingWith('norway', '')).toEqual([]);
  });
});
