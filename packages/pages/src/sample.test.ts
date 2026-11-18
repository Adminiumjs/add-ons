/**
 * THE SAMPLE FILE.
 *
 * Written by `scripts/sample.mjs` and never by hand: this suite holds the file
 * to the script, to the check Adminium runs before it adds a row, and to what
 * it promises: a live page and a draft in two languages, each a page document
 * the landing vocabulary takes whole, the live one published as it is with no
 * mark of Milo's on it, and a funnel whose step is the live page.
 */
import { readFileSync } from 'node:fs';
import { hasMiloMarks, isLandingSlug, parseLandingPage } from '@adminium/add-on-contracts/landing';
import { sampleBundleIssues } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { TARGET, written } from '../scripts/sample.mjs';
import { buildSample, type Row } from './sample/bundle.ts';

const file = JSON.parse(readFileSync(TARGET as string, 'utf8')) as { format: string; app: string; tables: { ref: string; rows: Row[] }[] };
const rowsOf = (ref: string): Row[] => file.tables.find((table) => table.ref === ref)?.rows ?? [];

describe('the sample file', () => {
  it('is what the script writes, and the manifest ships it', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe(written(buildSample()));
    expect(file).toMatchObject({ format: 'adminium.sample/1', app: 'pages' });
    expect(manifest.sampleData).toEqual({ file: 'seeds/pages.sample.json' });
  });

  it('fits the manifest, by the check Adminium itself runs before it adds a row', () => {
    expect(sampleBundleIssues(file as never, manifest as never).map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('holds two pages in two languages: one live, one a draft', () => {
    expect(rowsOf('pages').map((row) => [row['state'], row['language']])).toEqual([
      ['live', 'en-US'],
      ['draft', 'de-DE'],
    ]);
  });

  it('writes every page as a document the landing vocabulary takes, at an address the slug rule takes', () => {
    for (const row of rowsOf('pages')) {
      const parsed = parseLandingPage(row['draft']);
      expect(parsed.ok ? [] : parsed.issues, String(row['name'])).toEqual([]);
      expect(isLandingSlug(row['slug']), String(row['slug'])).toBe(true);
      // A sample slug never starts with the letters a per-month price is written with.
      expect(String(row['slug']).startsWith('mo')).toBe(false);
    }
  });

  it('publishes the live page as it is, with no mark of Milo’s, and leaves the draft unpublished', () => {
    const [live, draft] = rowsOf('pages');
    const published = parseLandingPage(live?.['published']);
    expect(published.ok).toBe(true);
    if (published.ok) expect(hasMiloMarks(published.page)).toBe(false);
    expect(live?.['published']).toEqual(live?.['draft']);
    expect(draft?.['published']).toBeNull();
    expect(draft?.['published_at']).toBeNull();
  });

  it('holds a funnel whose one step is the live page, by its key, and links no rule', () => {
    expect(rowsOf('funnels')).toEqual([expect.objectContaining({ name: 'Open day', rule_id: null, steps: [{ kind: 'page', key: { '@ref': 'page:open-day' } }] })]);
  });
});
