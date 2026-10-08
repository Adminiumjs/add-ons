import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { gather, render, SECTIONS, TARGET } from '../../scripts/page-strings.mjs';
import * as strings from './strings/index.ts';

/** Every language's sections, put back together by tag for the checks below. */
const BY_SECTION: Record<string, strings.InEveryLanguage> = { shared: strings.SHARED, refusal: strings.REFUSAL, discounts: strings.DISCOUNTS, lookup: strings.LOOKUP, issue: strings.ISSUE, rules: strings.RULES };
const LOCALES: Record<string, Record<string, Record<string, string>>> = Object.fromEntries(strings.LOCALE_TAGS.map((tag) => [tag, Object.fromEntries(Object.entries(BY_SECTION).map(([section, all]) => [section, { ...(all[tag] ?? {}) }]))]));

const PAGES = new URL('.', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
const SCREENS = walk(PAGES).filter((file) => file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('/testing/'));

describe("the screens' words", () => {
  it('are the sentences written in the screens, and the English file is not behind them', () => {
    expect(readFileSync(TARGET as string, 'utf8')).toBe(render(gather()));
  });

  it('are split into the sections a screen registers, and English has every one', () => {
    expect(Object.keys(LOCALES['en-US'] ?? {}).sort()).toEqual([...(SECTIONS as string[])].sort());
    for (const section of SECTIONS as string[]) expect(Object.keys((LOCALES['en-US'] as Record<string, Record<string, string>>)[section] ?? {}).length, section).toBeGreaterThan(0);
  });

  it('are never looked up by a key put together while the screen runs', () => {
    // A key built from a variable is one the English file cannot hold, so it would read as its fallback in every language.
    for (const file of SCREENS) expect(readFileSync(file, 'utf8'), file).not.toMatch(/\bt\(\s*`/);
  });
});

describe("the screens' looks", () => {
  /*
   * An add-on ships no stylesheet: a class is drawn only if the dashboard's
   * own CSS already carries it. These are the few the screens use beside the
   * kit's parts, each one the dashboard uses itself. A new one here must be
   * found in the dashboard's sources first.
   */
  // (`flex-1`, `overflow-*`, `max-w-full`, `px-5`, `py-4`: found in the dashboard's built stylesheet, 2026-10-08 — a sheet's one pane, and a row of choices wider than a phone.)
  const KNOWN = ['flex', 'flex-1', 'flex-col', 'font-semibold', 'leading-[normal]', 'max-w-full', 'min-h-0', 'min-w-0', 'overflow-x-auto', 'overflow-y-auto', 'px-5', 'py-4', 'size-4', 'sr-only', 'text-body-sm', 'text-fg', 'text-fg-muted'];

  it('use no class the dashboard does not already draw', () => {
    const used = new Set<string>();
    for (const file of SCREENS) for (const match of readFileSync(file, 'utf8').matchAll(/className="([^"]+)"/g)) for (const name of (match[1] as string).split(/\s+/)) used.add(name);
    expect([...used].filter((name) => !KNOWN.includes(name)).sort()).toEqual([]);
    // And none is put together at run time, where this list could not see it.
    for (const file of SCREENS) expect(readFileSync(file, 'utf8'), file).not.toMatch(/className=\{/);
  });
});

describe("the screens' words in eight languages", () => {
  const english = LOCALES['en-US'] as Record<string, Record<string, string>>;
  const others = Object.entries(LOCALES).filter(([tag]) => tag !== 'en-US') as [string, Record<string, Record<string, string>>][];
  /** The names a sentence takes, plural arguments among them. */
  const names = (message: string): string[] => {
    const out = new Set<string>();
    let depth = 0;
    let at = '';
    for (const char of message) {
      if (char === '{') {
        depth += 1;
        at = '';
      } else if (char === '}' || char === ',') {
        // Only what opens at an odd depth is a name: inside a plural's branch (even) the words are the sentence's own.
        if (depth % 2 === 1 && /^\s*[a-zA-Z]+\s*$/.test(at)) out.add(at.trim());
        if (char === '}') depth -= 1;
        at = '#';
      } else at += char;
    }
    return [...out].sort();
  };
  const branches = (message: string): string[][] => [...message.matchAll(/\{\s*\w+\s*,\s*plural\s*,((?:[^{}]|\{[^{}]*\})*)\}/g)].map((match) => [...(match[1] as string).matchAll(/(=\d+|\w+)\s*\{/g)].map((branch) => branch[1] as string));

  it('are eight, and each has every key of the English, section by section, and no other', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['ar-EG', 'cs-CZ', 'da-DK', 'de-DE', 'en-US', 'fr-FR', 'zh-CN', 'zh-TW']);
    for (const [tag, words] of others) {
      for (const section of SECTIONS as string[]) expect(Object.keys(words[section] ?? {}), `${tag} · ${section}`).toEqual(Object.keys(english[section] ?? {}));
    }
  });

  it('take the same names as the English sentence does, whatever order they come in', () => {
    for (const [tag, words] of others) {
      for (const section of SECTIONS as string[]) {
        for (const [key, sentence] of Object.entries(english[section] ?? {})) expect(names(words[section]?.[key] ?? ''), `${tag} · ${key}`).toEqual(names(sentence));
      }
    }
  });

  it('say a counted thing in every form its language has, and balance their braces', () => {
    for (const [tag, words] of Object.entries(LOCALES) as [string, Record<string, Record<string, string>>][]) {
      const forms = new Intl.PluralRules(tag).resolvedOptions().pluralCategories;
      for (const section of SECTIONS as string[]) {
        for (const [key, sentence] of Object.entries(words[section] ?? {})) {
          expect([...sentence].filter((char) => char === '{').length, `${tag} · ${key}`).toBe([...sentence].filter((char) => char === '}').length);
          for (const given of branches(sentence)) {
            // "many" outside Arabic is the form of millions and of fractions: `other` stands in for it, as the formatter does.
            for (const form of forms.filter((one) => one !== 'many' || tag.startsWith('ar'))) expect(given, `${tag} · ${key} · ${form}`).toContain(form);
            for (const form of given) expect(form.startsWith('=') || forms.includes(form as Intl.LDMLPluralRule), `${tag} · ${key} · ${form}`).toBe(true);
          }
          // An apostrophe opens a quoted stretch in a counted sentence: a typed one would swallow the words after it.
          if (sentence.includes(', plural,')) expect(sentence, `${tag} · ${key}`).not.toContain("'");
          expect(sentence.trim(), `${tag} · ${key}`).not.toBe('');
        }
      }
    }
  });

  it('are translated: next to nothing reads as the English does, and what does is a name both languages share', () => {
    // A screen left in English passes every check above. Here each language is held to a handful of sentences that
    // are the same in both — a word the languages share ("Code", "Status"), or a pattern with no words in it.
    for (const [tag, words] of others) {
      const same = (SECTIONS as string[]).flatMap((section) => Object.entries(english[section] ?? {}).filter(([key, sentence]) => words[section]?.[key] === sentence));
      expect(same.length, `${tag}: ${same.map(([key]) => key).join(' ')}`).toBeLessThanOrEqual(16);
      for (const [key, sentence] of same) expect(sentence.replace(/\{[^}]*\}/g, '').replace(/[^A-Za-z]/g, '').length, `${tag} · ${key} is still English: ${sentence}`).toBeLessThanOrEqual(8);
    }
  });
});
