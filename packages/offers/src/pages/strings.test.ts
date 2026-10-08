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
  const KNOWN = ['font-semibold', 'leading-[normal]', 'min-w-0', 'size-4', 'sr-only', 'text-body-sm', 'text-fg', 'text-fg-muted'];

  it('use no class the dashboard does not already draw', () => {
    const used = new Set<string>();
    for (const file of SCREENS) for (const match of readFileSync(file, 'utf8').matchAll(/className="([^"]+)"/g)) for (const name of (match[1] as string).split(/\s+/)) used.add(name);
    expect([...used].filter((name) => !KNOWN.includes(name)).sort()).toEqual([]);
    // And none is put together at run time, where this list could not see it.
    for (const file of SCREENS) expect(readFileSync(file, 'utf8'), file).not.toMatch(/className=\{/);
  });
});
