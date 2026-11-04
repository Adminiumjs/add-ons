import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { gather, render, SECTIONS, TARGET } from '../../scripts/page-strings.mjs';
import * as strings from './strings/index.ts';

/** Every language's sections, put back together by tag for the checks below. */
const BY_SECTION: Record<string, strings.InEveryLanguage> = { shared: strings.SHARED, setup: strings.SETUP, designs: strings.DESIGNS, panel: strings.PANEL };
const LOCALES: Record<string, Record<string, Record<string, string>>> = Object.fromEntries(strings.LOCALE_TAGS.map((tag) => [tag, Object.fromEntries(Object.entries(BY_SECTION).map(([section, all]) => [section, { ...(all[tag] ?? {}) }]))]));

const PAGES = new URL('.', import.meta.url).pathname;
const walk = (dir: string): string[] => readdirSync(dir).flatMap((entry) => (statSync(join(dir, entry)).isDirectory() ? walk(join(dir, entry)) : [join(dir, entry)]));
const SCREENS = [...walk(PAGES), ...walk(new URL('../panels/', import.meta.url).pathname)].filter((file) => file.endsWith('.tsx') && !file.includes('.test.') && !file.includes('/testing/'));

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
   * kit's parts, each one the dashboard uses itself (taken from the forms
   * add-on's lists, found in the 0.3.40 dashboard's built stylesheet; the
   * design editor's, each found in the 0.3.43 dashboard's and kit's sources).
   * A new one here must be found in the dashboard's sources first.
   */
  const KNOWN = ['bg-accent-soft', 'bg-surface', 'bg-surface-2', 'bg-surface-3', 'border', 'border-accent', 'border-b', 'border-border', 'border-border-strong', 'border-dashed', 'flex', 'flex-1', 'flex-col', 'flex-wrap', 'font-bold', 'font-extrabold', 'font-mono', 'gap-0.5', 'gap-1', 'gap-1.5', 'gap-2', 'gap-2.5', 'gap-3', 'h-[38px]', 'hover:bg-surface-2', 'hover:border-accent', 'inline-flex', 'items-center', 'justify-center', 'leading-[normal]', 'leading-relaxed', 'list-none', 'm-0', 'min-w-0', 'overflow-hidden', 'p-3', 'pb-4', 'px-1.5', 'px-3', 'px-4', 'px-5', 'py-2.5', 'py-3', 'py-4', 'rounded-[10px]', 'rounded-full', 'rounded-xl', 'size-[26px]', 'sr-only', 'text-[10.5px]', 'text-[11px]', 'text-[12.5px]', 'text-[12px]', 'text-[13px]', 'text-[14px]', 'text-accent', 'text-center', 'text-danger', 'text-fg', 'text-fg-muted', 'text-fg-subtle', 'text-info', 'text-start', 'w-[120px]', 'w-full', 'bg-accent', 'bg-fg', 'border-0', 'border-t', 'gap-4', 'grid', 'grid-cols-2', 'items-end', 'items-start', 'p-0', 'p-2', 'p-4', 'pt-3', 'px-2', 'py-1.5', 'py-2', 'size-2.5', 'size-[22px]', 'sm:w-[280px]', 'text-[10px]', 'text-[11.5px]', 'text-[13.5px]', 'text-[14.5px]', 'text-bg', 'text-warn', 'w-5', 'w-[42px]', 'w-[52px]',
    // The 3D previews' (each found in the 0.3.43 dashboard's or kit's sources).
    'absolute', 'aspect-square', 'cursor-grab', 'inset-0', 'justify-end', 'ms-auto', 'p-6', 'place-items-center', 'px-2.5', 'relative', 'rounded-2xl', 'rounded-[7px]', 'rounded-[9px]', 'select-none', 'self-start', 'size-[15px]', 'size-[34px]', 'size-full', 'touch-none',
    // A kit's set-up: its files, its model and Mark faces (each found in the 0.3.43 dashboard's or kit's sources).
    'bg-danger-soft', 'bg-pos-soft', 'border-[1.5px]', 'cursor-pointer', 'gap-[18px]', 'gap-px', 'last:border-b-0', 'leading-normal', 'max-h-[260px]', 'md:grid-cols-2', 'min-h-11', 'mt-0.5', 'overflow-y-auto', 'pointer-events-none', 'px-0', 'py-0.5', 'py-1', 'rounded-[11px]', 'rounded-[13px]', 'shrink-0', 'size-[13px]', 'size-[17px]', 'sm:grid-cols-2', 'start-2.5', 'text-pos', 'top-2.5', 'truncate', 'whitespace-nowrap', 'aria-pressed:border-accent', 'aria-pressed:bg-accent-soft'];

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
