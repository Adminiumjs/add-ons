/**
 * THE SAMPLE FILE.
 *
 * Written by `scripts/sample.mjs` and never by hand: this suite holds the file
 * to the script, to the check Adminium runs before it adds a row, and every
 * form in it to the vocabulary the engine serves forms with.
 */
import { readFileSync } from 'node:fs';
import { parseForm } from '@adminium/add-on-contracts/forms';
import { sampleBundleIssues } from '@adminiumjs/manifest';
import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { TARGET, written } from '../scripts/sample.mjs';
import { buildSample, type Row } from './sample/bundle.ts';

const file = JSON.parse(readFileSync(TARGET as string, 'utf8')) as { format: string; app: string; tables: { ref: string; rows: Row[] }[] };
const forms = file.tables.find((table) => table.ref === 'forms')?.rows ?? [];

describe('the sample file', () => {
  it('is what the script writes, and the manifest ships it', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe(written(buildSample()));
    expect(file).toMatchObject({ format: 'adminium.sample/1', app: 'forms' });
    expect(manifest.sampleData).toEqual({ file: 'seeds/forms.sample.json' });
  });

  it('fits the manifest, by the check Adminium itself runs before it adds a row', () => {
    expect(sampleBundleIssues(file as never, manifest as never).map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('holds two drafts, a form and an anonymous survey, and nothing a stranger sent', () => {
    expect(file.tables.map((table) => table.ref)).toEqual(['forms']);
    expect(forms.map((row) => [row['slug'], row['kind'], row['state']])).toEqual([
      ['newsletter-sign-up', 'form', 'draft'],
      ['quick-feedback', 'survey', 'draft'],
    ]);
  });

  it('every form parses as the engine will serve it, in all eight languages', () => {
    for (const row of forms) {
      const parsed = parseForm(row['definition'], row['settings']);
      expect(parsed.ok ? [] : parsed.issues, String(row['slug'])).toEqual([]);
      if (!parsed.ok) continue;
      expect(parsed.form.definition.languages, String(row['slug'])).toHaveLength(8);
      // The name lists show is the title in the form's own default language.
      expect(row['name']).toBe(parsed.form.definition.title[parsed.form.definition.defaultLanguage]);
    }
  });

  it('keeps the newsletter’s answers only, and asks for the newsletter with a tick confirmed by e-mail', () => {
    const parsed = parseForm(forms[0]!['definition'], forms[0]!['settings']);
    if (!parsed.ok) throw new Error('the newsletter form does not parse');
    expect(parsed.form.settings.becomes).toBeNull();
    const tick = parsed.form.definition.questions.find((question) => question.kind === 'tick');
    expect(tick).toMatchObject({ purpose: 'newsletter', confirm: true, required: false });
    // A tick confirmed by e-mail needs a question that asks for the address.
    expect(parsed.form.definition.questions.some((question) => question.kind === 'short' && question.check === 'email')).toBe(true);
  });

  it('keeps no name on the feedback survey, and scores how likely it is to be recommended', () => {
    const parsed = parseForm(forms[1]!['definition'], forms[1]!['settings']);
    if (!parsed.ok) throw new Error('the feedback survey does not parse');
    expect(parsed.form.settings.survey).toEqual({ mode: 'anonymous', linkNames: false, stopAfterDays: 30 });
    expect(parsed.form.definition.questions.map((question) => question.kind)).toEqual(['score', 'long']);
  });
});
