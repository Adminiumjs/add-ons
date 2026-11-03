/**
 * THE BUILT BYTES, READ BACK.
 *
 * What ships is `dist/`, so this suite builds it for real and reads what
 * landed: the one file the manifest names is there and nothing else is, it
 * asks the browser to fetch nothing, it carries every language of its words,
 * and nothing banned is in it.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import manifest from '../manifest.json' with { type: 'json' };
import * as GERMAN from './pages/strings/de-DE.ts';
import { BUILT_FILES } from '../vite.config.ts';
import { buildForReal, DIST } from './testing/build.ts';
import { bannedHitsIn } from './testing/lexicon.ts';

function built(dir = DIST): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? built(path) : [path];
  });
}
const asRelative = (file: string) => relative(DIST, file);
const codeOf = (bytes: string) => bytes.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
/** The size the one file stays under: every screen and eight languages of their words. */
export const PAGE_MAX_BYTES = 600_000;

beforeAll(() => {
  buildForReal();
}, 180_000);

describe('the build writes what the manifest promises', () => {
  it('puts the one page file the manifest declares where it says, and nothing else', () => {
    const declared = manifest.addOn.pages.map((page) => page.client);
    expect(declared).toEqual([...BUILT_FILES]);
    for (const path of declared) expect(existsSync(join(DIST, '..', path)), path).toBe(true);
    expect(built().map(asRelative).sort()).toEqual(BUILT_FILES.map((path) => path.replace(/^dist\//, '')).sort());
  });

  it('emits no sourcemap, and no reference to one', () => {
    for (const file of built()) {
      expect(file.endsWith('.map')).toBe(false);
      expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
    }
  });
});

describe('the page file', () => {
  const file = (): string => readFileSync(join(DIST, 'pages', 'forms.js'), 'utf8');

  it('is one file with everything in it but the host, of a size a browser loads at once', () => {
    expect(codeOf(file())).not.toMatch(/^\s*import\s[^;]*\bfrom\b|^\s*import\s*['"]|\bimport\s*\(/m);
    expect(statSync(join(DIST, 'pages', 'forms.js')).size).toBeLessThan(PAGE_MAX_BYTES);
  });

  it('carries its words in every language', () => {
    const german = GERMAN.list['list.empty.forms.body'] as string;
    expect(file()).toContain(JSON.stringify(german).slice(1, -1));
    expect(file()).toContain('Make a form your website visitors can fill in.');
  });

  it('keeps nothing in the browser’s storage', () => {
    expect(file()).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
  });

  it('passes the word gate', () => {
    for (const one of built()) {
      const hits = bannedHitsIn(readFileSync(one, 'utf8'));
      expect(hits, `${asRelative(one)}: ${hits.slice(0, 5).map((hit) => `${hit.word} at ${String(hit.at)}`).join(', ')}`).toEqual([]);
    }
  });
});
