/**
 * THE CUSTOMER'S EDITOR'S WORDS, IN EIGHT LANGUAGES.
 *
 * The same holds as for the shop's screens (`src/pages/strings.test.ts`):
 * the English file is the sentences written in the editor, every language has
 * every key and no other, the same names, every plural form its language has,
 * and is truly translated; and the formatter fills a sentence in as the
 * language counts.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { BROWSER_SECTIONS, BROWSER_TARGET, gatherBrowser, render } from '../../scripts/page-strings.mjs';
import { format, localeOf, LOCALES, shortWhen, translator } from './i18n.ts';
import * as arEG from './strings/ar-EG.ts';
import * as csCZ from './strings/cs-CZ.ts';
import * as daDK from './strings/da-DK.ts';
import * as deDE from './strings/de-DE.ts';
import * as enUS from './strings/en-US.ts';
import * as frFR from './strings/fr-FR.ts';
import * as zhCN from './strings/zh-CN.ts';
import * as zhTW from './strings/zh-TW.ts';

const ALL: Record<string, Readonly<Record<string, string>>> = { 'en-US': enUS.editor, 'de-DE': deDE.editor, 'fr-FR': frFR.editor, 'da-DK': daDK.editor, 'cs-CZ': csCZ.editor, 'ar-EG': arEG.editor, 'zh-CN': zhCN.editor, 'zh-TW': zhTW.editor };
const english = enUS.editor;
const others = Object.entries(ALL).filter(([tag]) => tag !== 'en-US');
const HERE = new URL('.', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
const SOURCES = walk(HERE).filter((file) => /\.tsx?$/.test(file) && !file.includes('.test.') && !file.includes('/testing/') && !file.includes('/strings/'));

/** The names a sentence takes, plural arguments among them (as the shop's screens' test reads them). */
const names = (message: string): string[] => {
  const out = new Set<string>();
  let depth = 0;
  let at = '';
  for (const char of message) {
    if (char === '{') {
      depth += 1;
      at = '';
    } else if (char === '}' || char === ',') {
      if (depth % 2 === 1 && /^\s*[a-zA-Z]+\s*$/.test(at)) out.add(at.trim());
      if (char === '}') depth -= 1;
      at = '#';
    } else at += char;
  }
  return [...out].sort();
};
const branches = (message: string): string[][] => [...message.matchAll(/\{\s*\w+\s*,\s*plural\s*,((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}/g)].map((match) => [...(match[1] as string).matchAll(/(=\d+|\w+)\s*\{/g)].map((branch) => branch[1] as string));

describe("the editor's words", () => {
  it('are the sentences written in the editor, and the English file is not behind them', () => {
    expect(readFileSync(BROWSER_TARGET as string, 'utf8')).toBe(render(gatherBrowser(), BROWSER_SECTIONS));
  });

  it('are never looked up by a key put together while the editor runs', () => {
    expect(SOURCES.length).toBeGreaterThan(5);
    for (const file of SOURCES) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bt\(\s*`/);
  });

  it('are eight languages, each with every key of the English and no other', () => {
    expect(Object.keys(ALL).sort()).toEqual([...LOCALES].sort());
    for (const [tag, words] of others) expect(Object.keys(words), tag).toEqual(Object.keys(english));
  });

  it('take the same names as the English sentence does', () => {
    for (const [tag, words] of others) for (const [key, sentence] of Object.entries(english)) expect(names(words[key] ?? ''), `${tag} · ${key}`).toEqual(names(sentence));
  });

  it('say a counted thing in every form its language has, and balance their braces', () => {
    for (const [tag, words] of Object.entries(ALL)) {
      const forms = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
      for (const [key, sentence] of Object.entries(words)) {
        expect([...sentence].filter((char) => char === '{').length, `${tag} · ${key}`).toBe([...sentence].filter((char) => char === '}').length);
        for (const given of branches(sentence)) {
          for (const form of forms.filter((one) => one !== 'many' || tag.startsWith('ar'))) expect(given, `${tag} · ${key} · ${form}`).toContain(form);
          for (const form of given) expect(form.startsWith('=') || forms.includes(form as Intl.LDMLPluralRule), `${tag} · ${key} · ${form}`).toBe(true);
        }
        if (sentence.includes(', plural,')) expect(sentence, `${tag} · ${key}`).not.toContain("'");
        expect(sentence.trim(), `${tag} · ${key}`).not.toBe('');
      }
    }
  });

  it('are translated: next to nothing reads as the English does', () => {
    for (const [tag, words] of others) {
      const same = Object.entries(english).filter(([key, sentence]) => words[key] === sentence);
      expect(same.length, `${tag}: ${same.map(([key]) => key).join(' ')}`).toBeLessThanOrEqual(10);
      for (const [key, sentence] of same) expect(sentence.replace(/\{[^}]*\}/g, '').replace(/[^A-Za-z]/g, '').length, `${tag} · ${key} is still English: ${sentence}`).toBeLessThanOrEqual(8);
    }
  });

  it('fill in every sentence in every language without leaving a name unfilled', () => {
    const vars = { n: 3, part: 'P', name: 'N', design: 'D', product: 'X', shop: 'S', size: '6 mm', limit: 22, count: 4, email: 'a@b.c', when: 'w', price: '£1', date: 'd', colour: 'Ink', chips: 'c', query: 'q', trim: 't', sides: 's', px: '1 × 2', dpi: 1, w: 1, h: 2, needs: 150, bleed: 3, value: 'v', material: 'walnut', side: 'Front', safe: 4 };
    for (const [tag, words] of Object.entries(ALL)) {
      const t = translator(localeOf(tag));
      for (const key of Object.keys(words)) expect(t(key, english[key]!, vars), `${tag} · ${key}`).not.toMatch(/\{[a-z]+[,}]/i);
    }
  });
});

describe('the formatter', () => {
  it('chooses the plural each language asks for', () => {
    const message = '{n, plural, one {# thing} few {# things few} many {# things many} other {# things}}';
    expect(format(message, { n: 1 }, 'en-US')).toBe('1 thing');
    expect(format(message, { n: 2 }, 'en-US')).toBe('2 things');
    expect(format(message, { n: 3 }, 'cs-CZ')).toBe('3 things few');
    expect(format(message, { n: 11 }, 'ar-EG')).toMatch(/things many$/);
    expect(format('{n, plural, =0 {none} other {# of them}}', { n: 0 }, 'en-US')).toBe('none');
  });

  it('fills names inside a branch, and leaves a name it was not given as written', () => {
    expect(format('{n, plural, one {# design for {product}} other {# designs for {product}}}', { n: 2, product: 'coasters' }, 'en-US')).toBe('2 designs for coasters');
    expect(format('Hello {who}', {}, 'en-US')).toBe('Hello {who}');
  });

  it('answers the nearest language shipped', () => {
    expect(localeOf('de')).toBe('de-DE');
    expect(localeOf('zh-Hant-TW')).toBe('zh-TW');
    expect(localeOf('zh')).toBe('zh-CN');
    expect(localeOf('ar')).toBe('ar-EG');
    expect(localeOf('pt-BR')).toBe('en-US');
    expect(localeOf(undefined)).toBe('en-US');
  });

  it('writes a moment with its weekday, as the comps do', () => {
    expect(shortWhen('2026-08-06T16:12:00Z', 'en-US')).toMatch(/^Thu 6 Aug · \d\d:12$/);
    expect(shortWhen(null, 'en-US')).toBe('');
  });
});
