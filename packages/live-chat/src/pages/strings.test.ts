import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// @ts-expect-error — a build script, plain JavaScript with no types of its own.
import { gather, render, SECTIONS, TARGET } from '../../scripts/page-strings.mjs';
import * as strings from './strings/index.ts';

/** Every language's sections, put back together by tag for the checks below. */
const BY_SECTION: Record<string, strings.InEveryLanguage> = { shared: strings.SHARED, inbox: strings.INBOX, thread: strings.THREAD, rail: strings.RAIL, settings: strings.SETTINGS, answers: strings.ANSWERS };
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
  // Each found in the dashboard's built stylesheet of the 0.3.64 line (the W3 engine lane, 2026-11-18) before it was put here.
  const KNOWN = ['[overflow-wrap:anywhere]', 'basis-64', 'basis-full', 'bg-accent', 'bg-accent-soft', 'bg-border-strong', 'bg-fg-muted', 'bg-info-soft', 'bg-pos-soft', 'bg-surface', 'bg-surface-2', 'bg-surface-3', 'bg-transparent', 'bg-warn', 'bg-warn-soft', 'bg-white', 'block', 'border', 'border-0', 'border-accent', 'border-b', 'border-b-border', 'border-border', 'border-border-strong', 'border-dashed', 'border-e', 'border-s', 'border-s-[3px]', 'border-s-accent', 'border-s-transparent', 'border-t', 'cursor-not-allowed', 'flex', 'flex-1', 'flex-col', 'flex-wrap', 'font-bold', 'font-extrabold', 'font-mono', 'font-semibold', 'gap-0.5', 'gap-1', 'gap-1.5', 'gap-2', 'gap-2.5', 'gap-3', 'gap-3.5', 'gap-4', 'gap-[18px]', 'gap-[3px]', 'gap-[5px]', 'gap-[7px]', 'gap-[9px]', 'gap-x-2.5', 'gap-x-3', 'gap-x-4', 'gap-y-1', 'gap-y-2', 'gap-y-2.5', 'h-1.5', 'h-10', 'h-11', 'h-6', 'h-8', 'h-9', 'h-[22px]', 'h-[34px]', 'h-[38px]', 'h-[560px]', 'h-full', 'hover:bg-surface-2', 'hover:bg-surface-3', 'inline-flex', 'items-baseline', 'items-center', 'items-end', 'items-start', 'justify-center', 'justify-end', 'leading-[normal]', 'leading-normal', 'm-0', 'max-w-[360px]', 'max-w-[760px]', 'max-w-[80%]', 'max-w-full', 'min-h-0', 'min-w-0', 'min-w-24', 'min-w-8', 'min-w-[18px]', 'min-w-[220px]', 'ms-4', 'mt-1', 'my-1', 'opacity-50', 'outline-none', 'overflow-auto', 'overflow-hidden', 'p-0.5', 'p-5', 'p-[22px]', 'pb-1', 'pb-3', 'pb-4', 'pe-1', 'pe-1.5', 'ps-2.5', 'ps-3', 'pt-0.5', 'pt-3', 'pt-3.5', 'pt-4', 'pt-[18px]', 'pt-px', 'px-1.5', 'px-2', 'px-2.5', 'px-3', 'px-3.5', 'px-4', 'px-5', 'px-[11px]', 'px-[7px]', 'py-0.5', 'py-1', 'py-1.5', 'py-2', 'py-2.5', 'py-3', 'py-3.5', 'py-7', 'py-[13px]', 'py-[3px]', 'resize-none', 'resize-y', 'rounded-[10px]', 'rounded-[14px]', 'rounded-[20px]', 'rounded-ee-sm', 'rounded-es-sm', 'rounded-full', 'rounded-lg', 'rounded-md', 'rtl:-scale-x-100', 'self-center', 'self-end', 'shadow-sm', 'shrink-0', 'size-11', 'size-2', 'size-3.5', 'size-4', 'size-5', 'size-6', 'size-7', 'size-9', 'size-full', 'sr-only', 'text-[10.5px]', 'text-[10px]', 'text-[11.5px]', 'text-[12.5px]', 'text-[13px]', 'text-[14.5px]', 'text-[14px]', 'text-[16px]', 'text-[18px]', 'text-accent', 'text-accent-fg', 'text-body', 'text-center', 'text-danger', 'text-fg', 'text-fg-muted', 'text-fg-subtle', 'text-info', 'text-pos', 'text-start', 'text-warn', 'tracking-[-0.01em]', 'tracking-[-0.02em]', 'tracking-[0.05em]', 'truncate', 'underline', 'uppercase', 'w-10', 'w-24', 'w-64', 'w-72', 'w-8', 'w-[200px]', 'w-[290px]', 'w-[400px]', 'w-[76px]', 'w-full', 'whitespace-nowrap'];

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
