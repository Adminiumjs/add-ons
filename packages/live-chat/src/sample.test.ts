/**
 * THE SAMPLE FILE.
 *
 * Written by `scripts/sample.mjs` and never by hand: this suite holds the file
 * to the script, to the check Adminium runs before it adds a row, and to what
 * it promises: three chats in three states, four answers in two languages,
 * nothing that could mail anybody, and nothing that spends a token.
 */
import { readFileSync } from 'node:fs';
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
    expect(file).toMatchObject({ format: 'adminium.sample/1', app: 'live-chat' });
    expect(manifest.sampleData).toEqual({ file: 'seeds/live-chat.sample.json' });
  });

  it('fits the manifest, by the check Adminium itself runs before it adds a row', () => {
    expect(sampleBundleIssues(file as never, manifest as never).map((issue) => `${String(issue.path)}: ${issue.message}`)).toEqual([]);
  });

  it('holds three chats, one with the automatic answers, one waiting for a person, one closed', () => {
    expect(rowsOf('conversations').map((row) => row['state'])).toEqual(['bot', 'waiting', 'closed']);
  });

  it('holds four answers, each written in English and in German', () => {
    const answers = rowsOf('answers');
    expect(answers).toHaveLength(4);
    for (const answer of answers) {
      const versions = answer['versions'] as Record<string, { title: string; text: string; examples: string[] }>;
      expect(Object.keys(versions).sort(), String(answer['ref'])).toEqual(['de-DE', 'en-US']);
      for (const version of Object.values(versions)) expect(version.title !== '' && version.text !== '', String(answer['ref'])).toBe(true);
    }
  });

  it('gives each automatic message the answer it was, word for word, by its ref', () => {
    const answers = new Map(rowsOf('answers').map((answer) => [answer['ref'], answer['versions'] as Record<string, { text: string }>]));
    for (const message of rowsOf('messages').filter((row) => row['kind'] === 'automatic')) expect(message['body']).toBe(answers.get(message['answer_ref'])?.['en-US']?.text);
  });

  it('can mail nobody and spends no token: no visitor left an e-mail, and no setting is changed', () => {
    for (const row of rowsOf('conversations')) expect(row['email'] ?? null).toBeNull();
    expect(file.tables.map((table) => table.ref)).not.toContain('settings');
  });
});
