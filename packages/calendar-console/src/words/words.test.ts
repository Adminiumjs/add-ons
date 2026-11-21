import { describe, expect, it } from 'vitest';

import { EN, WORDS, fill, wordsFor } from './index.ts';

const LOCALES = ['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW'];
const slots = (text: string): string[] => [...new Set(text.match(/\{[a-zA-Z]+\}/g) ?? [])].sort();
/** The labels people must find on Google's and Microsoft's own pages, in English in every language. */
const THEIR_LABELS: readonly [keyof typeof EN, string][] = [
  ['g2Warn', 'Testing'],
  ['g2PickGmail', 'Publish app'],
  ['g3Body', 'Add or Remove Scopes'],
  ['g4Body', 'Authorized redirect URIs'],
  ['g5Body', 'Add Secret'],
  ['m2PickSingle', 'Single tenant only'],
  ['m2PickMixed', 'Any Entra ID Tenant + Personal Microsoft accounts'],
  ['m3Admin', 'Grant admin consent for'],
  ['m4Body', 'Add Redirect URI'],
  ['m5Body', 'Certificates & secrets'],
];

describe('the words', () => {
  it('ships in all eight languages', () => {
    expect(Object.keys(WORDS).sort()).toEqual(LOCALES);
  });

  it.each(LOCALES)('%s has every key, filled, with the same slots', (tag) => {
    const words = WORDS[tag]!;
    expect(Object.keys(words).sort()).toEqual(Object.keys(EN).sort());
    for (const key of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(words[key].trim(), `${tag}.${key}`).not.toBe('');
      expect(slots(words[key]), `${tag}.${key}`).toEqual(slots(EN[key]));
    }
  });

  it.each(LOCALES)('%s keeps the providers’ own labels in English', (tag) => {
    for (const [key, label] of THEIR_LABELS) expect(WORDS[tag]![key], `${tag}.${key}`).toContain(label);
  });

  it('says the polling gap as ruled, and promises no Google warning that no longer exists', () => {
    expect(EN.instantPollingTwo).toContain('about 12 minutes');
    expect(EN.g2NoteGmail).not.toMatch(/unverified|100/);
    expect(JSON.stringify(EN)).not.toContain('Copy both again');
  });

  it('offers no paid grade in English, and names the one permission that spells the word', () => {
    const text = Object.values(EN).join(' ').replaceAll('calendar.events.freebusy', '');
    expect(text).not.toMatch(/pricing|\bplans?\b|\btier|billing|upgrade|premium|\bfree\b/i);
  });

  it('falls back by language, then to English, and fills slots', () => {
    expect(wordsFor('de-AT')).toBe(WORDS['de-DE']);
    expect(wordsFor('xx-XX')).toBe(EN);
    expect(fill('{a} and {b}', { a: 1 })).toBe('1 and {b}');
  });
});
