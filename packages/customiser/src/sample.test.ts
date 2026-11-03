/**
 * THE SAMPLE FILES.
 *
 * Written by `scripts/sample.mjs` and never by hand: this suite holds each
 * file to the script, and to the check Adminium runs on an app's rows for an
 * add-on, against the manifest's own tables. A shop app that ships one names
 * it under `sampleData.addOns.customiser`; the stand-in app here names the
 * Customiser as the real ones do.
 */
import { readFileSync } from 'node:fs';
import { sampleSectionIssues } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { targetOf, written } from '../scripts/sample.mjs';
import { buildSample, SAMPLE_APPS, type Bundle, type Row } from './sample/bundle.ts';

const fileOf = (app: Bundle['app']): Bundle => JSON.parse(readFileSync((targetOf as (one: string) => string)(app), 'utf8')) as Bundle;
const rowsOf = (bundle: Bundle, ref: string): Row[] => bundle.tables.find((table) => table.ref === ref)?.rows ?? [];
/** An app as the check reads one: its key, and the Customiser among what it requires. */
const appNaming = (key: string) => ({ kind: 'app', key, requiredSchema: { tables: [] }, addOns: { requires: [{ key: 'customiser', range: '^1.0.0' }] } });

describe.each(SAMPLE_APPS)('the %s sample file', (app) => {
  const file = fileOf(app);

  it('is what the script writes, for this app and this add-on', () => {
    expect(readFileSync((targetOf as (one: string) => string)(app), 'utf8')).toBe((written as (bundle: Bundle) => string)(buildSample(app)));
    expect(file).toMatchObject({ format: 'adminium.sample/1', app, addOn: 'customiser' });
  });

  it('fits the manifest’s tables, by the check Adminium runs on an app’s rows for an add-on', () => {
    const issues = sampleSectionIssues(file as never, appNaming(app) as never, manifest as never);
    expect(issues.map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('holds each choice to its column’s values, and links each row to one this file labels', () => {
    // The load resolves links and refuses a value no column takes; the check above reads neither, so this does.
    const columns = new Map((manifest.requiredSchema.tables as unknown as { ref: string; columns: { ref: string; type: string; enum?: string[]; references?: string }[] }[]).map((table) => [table.ref, table.columns]));
    const labels = new Map(file.tables.flatMap((table) => table.rows.filter((row) => typeof row['@label'] === 'string').map((row) => [row['@label'] as string, table.ref] as const)));
    for (const table of file.tables) {
      for (const row of table.rows) {
        for (const column of columns.get(table.ref) ?? []) {
          const value = row[column.ref];
          if (value === undefined || value === null) continue;
          if (column.type === 'enum') expect(column.enum, `${table.ref}.${column.ref}`).toContain(value);
          if (column.type === 'fk') {
            const label = (value as { '@ref'?: string })['@ref'];
            expect(labels.get(label ?? ''), `${table.ref}.${column.ref} → ${String(label)}`).toBe(column.references);
          }
        }
      }
    }
  });

  it('says on every row which app it is for: this one', () => {
    for (const table of file.tables) for (const row of table.rows) expect(row['app'], table.ref).toBe(app);
  });

  it('gives every design a code of sixteen letters and digits, and no private link: Adminium makes those', () => {
    for (const row of rowsOf(file, 'designs')) {
      expect(String(row['code'])).toMatch(/^[0-9A-HJKMNP-TV-Z]{16}$/);
      expect(row['link_token']).toBeUndefined();
      expect(row['format']).toBe(1);
    }
  });

  it('shows no customer’s own words as another customer’s hint', () => {
    // The words customers chose, as their own designs hold them.
    const theirs = rowsOf(file, 'designs').flatMap((row) => Object.values((row['values'] as { parts: Record<string, { text?: string }> }).parts).map((value) => value.text).filter((text): text is string => text !== undefined));
    expect(theirs.length).toBeGreaterThan(0);
    const hints = JSON.stringify(rowsOf(file, 'base_areas').concat(rowsOf(file, 'ready_parts')).map((row) => (row['rules'] as { placeholder?: string } | undefined)?.placeholder ?? ''));
    for (const words of theirs) expect(hints, words).not.toContain(words);
  });
});

describe('Birch Row’s sample', () => {
  const file = fileOf('maker');

  it('offers the coasters, the book nook, the keyring and the board, and not yet the slate sign', () => {
    expect(rowsOf(file, 'bases').map((row) => [row['name'], row['kind'], row['state']])).toEqual([
      ['Engraved walnut coasters', 'piece', 'published'],
      ['The Little Bookshop', 'kit', 'published'],
      ['Name keyring', 'printed', 'published'],
      ['Walnut cutting board', 'piece', 'published'],
      ['Slate house sign', 'piece', 'draft'],
    ]);
  });

  it('keeps one set of materials: walnut 6 mm coasters, birch ply 3 mm for the nook, slate 5 mm, PLA', () => {
    const thickness = Object.fromEntries(rowsOf(file, 'bases').map((row) => [row['name'], [row['material'], row['thickness_mm']]]));
    expect(thickness['Engraved walnut coasters']).toEqual(['Walnut', 6]);
    expect(thickness['The Little Bookshop']).toEqual(['Birch ply', 3]);
    expect(thickness['Slate house sign']).toEqual(['Slate', 5]);
    expect(thickness['Name keyring']).toEqual(['PLA', 4]);
  });

  it('cuts the book nook from 14 pieces, and carries no model file yet', () => {
    expect(rowsOf(file, 'base_pieces').map((row) => row['code'])).toEqual(Array.from({ length: 14 }, (_, i) => String(i + 1).padStart(2, '0')));
    for (const row of rowsOf(file, 'bases')) expect(Object.keys(row).filter((key) => key.endsWith('_file')), String(row['name'])).toEqual([]);
  });

  it('has the comps’ ready-made designs: six coasters, three nooks, two keyrings', () => {
    const names = rowsOf(file, 'ready_designs').map((row) => row['name']);
    expect(names).toEqual(['Ring', 'Two lines', 'Monogram', 'Sprig', 'Badge', 'Stamp', 'Corner shop', 'Night shop', 'Reading room', 'Name', 'Name and a heart']);
  });

  it('sells the logo and the second side as priced features, named by code', () => {
    expect(rowsOf(file, 'features').map((row) => [row['code'], row['name']])).toEqual([
      ['logo', 'Your own logo'],
      ['engrave-both-sides', 'Engrave both sides'],
    ]);
  });

  it('holds the designs of BR-2288 to BR-2290: Iris’s book nook, Sam’s keyring and Tom’s coasters, each ordered', () => {
    const designs = rowsOf(file, 'designs');
    expect(designs.map((row) => [row['@label'], (row['ready_design_id'] as { '@ref': string })['@ref'], row['state']])).toEqual([
      ['design:br-2288', 'ready:nook-corner', 'ordered'],
      ['design:br-2289', 'ready:keyring-name', 'ordered'],
      ['design:br-2290', 'ready:coasters-ring', 'ordered'],
    ]);
    // BR-2288 is on its second proof: the sign set at 10 mm.
    expect(rowsOf(file, 'design_versions').filter((row) => (row['design_id'] as { '@ref': string })['@ref'] === 'design:br-2288').map((row) => row['version'])).toEqual([1, 2]);
  });
});

describe('Marlow Press’s sample', () => {
  const file = fileOf('printing');

  it('prints business cards at 85 × 55 mm with 3 mm bleed on both sides, and A5 flyers', () => {
    expect(rowsOf(file, 'bases').map((row) => [row['name'], row['width_mm'], row['height_mm'], row['bleed_mm'], row['safe_mm'], row['sides']])).toEqual([
      ['Business cards', 85, 55, 3, 4, 2],
      ['A5 flyers', 148, 210, 3, 4, 2],
    ]);
  });

  it('has the eight ready-made cards in the comp’s order, the gallery’s filters counting 3 simple, 4 bold, 1 with a photo and 3 in one colour', () => {
    const ready = rowsOf(file, 'ready_designs');
    expect(ready.map((row) => row['name'])).toEqual(['Harbour', 'Classic', 'Stripe', 'Corner', 'Monogram', 'Photo back', 'Two-tone', 'Plain']);
    const count = (tag: string) => ready.filter((row) => (row['tags'] as string[]).includes(tag)).length;
    expect([count('simple'), count('bold'), count('photo'), count('one')]).toEqual([3, 4, 1, 3]);
    // No ready-made design for flyers yet: customers start from blank or send their own file.
    expect(ready.every((row) => (row['base_id'] as { '@ref': string })['@ref'] === 'base:cards')).toBe(true);
  });

  it('gives Harbour its two layouts and three palettes, each of paper, ink and an accent', () => {
    const harbour = rowsOf(file, 'ready_designs').find((row) => row['name'] === 'Harbour')!;
    expect(harbour['layouts']).toEqual([
      { key: 'left', name: 'Logo left' },
      { key: 'top', name: 'Logo top' },
    ]);
    const palettes = rowsOf(file, 'palettes').filter((row) => (row['ready_design_id'] as { '@ref': string })['@ref'] === 'ready:harbour');
    expect(palettes.map((row) => row['name'])).toEqual(['Harbour', 'Quay', 'Sand']);
    const colours = rowsOf(file, 'palette_colours').filter((row) => (row['palette_id'] as { '@ref': string })['@ref'] === 'palette:harbour-harbour');
    expect(colours.map((row) => [row['role'], row['hex']])).toEqual([
      ['paper', '#f4efe6'],
      ['ink', '#1f2a36'],
      ['accent', '#c0562f'],
    ]);
  });

  it('holds Harbour Bakery’s design for MP-4112, its job title within the part’s 24 characters', () => {
    const [design] = rowsOf(file, 'designs');
    expect(design).toMatchObject({ '@label': 'design:mp-4112', state: 'ordered', values: { layout: 'left', palette: 'harbour' } });
    const title = rowsOf(file, 'ready_parts').find((row) => (row['ready_design_id'] as { '@ref': string })['@ref'] === 'ready:harbour' && row['layout'] === 'left' && row['code'] === 'title')!;
    expect((title['rules'] as { chars: number }).chars).toBe(24);
    expect(((design!['values'] as { parts: Record<string, { text: string }> }).parts['title']!.text).length).toBeLessThanOrEqual(24);
  });
});
