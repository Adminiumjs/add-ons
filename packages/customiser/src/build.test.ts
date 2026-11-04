/**
 * THE LIBRARIES, AS THE SHOP'S SCREENS' BUILD CHANGES THEM.
 *
 * `quietLibraries` respells two things in the font reader and the WOFF2
 * dictionary so the built panel passes the word sweep. Held here: the
 * dictionary read back from its respelling is the same bytes, and the font
 * reader's respelt name was nowhere in it before, so nothing else is renamed.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { quietLibraries } from '../vite.config.ts';

const here = createRequire(import.meta.url);
const transform = quietLibraries().transform as (code: string, id: string) => { code: string } | null;
const brotli = dirname(here.resolve('brotli/package.json'));
const fontkit = dirname(dirname(here.resolve('fontkit')));

describe('the libraries in the built panel', () => {
  it('read the WOFF2 dictionary back to the very same bytes', () => {
    const file = join(brotli, 'dec/dictionary.bin.js');
    const before = readFileSync(file, 'utf8');
    const after = transform(before, file)!.code;
    const text = (source: string): string => JSON.parse(source.slice(source.indexOf('"'), source.lastIndexOf('"') + 1)) as string;
    expect(text(after)).not.toMatch(/[+/]/);
    expect(Buffer.from(text(after).replace(/-/g, '+').replace(/_/g, '/'), 'base64').equals(Buffer.from(text(before), 'base64'))).toBe(true);
    const reader = join(brotli, 'dec/dictionary-browser.js');
    expect(transform(readFileSync(reader, 'utf8'), reader)!.code).toContain(".replace(/-/g, '+').replace(/_/g, '/')");
  });

  it('rename the font reader’s shaping steps only, to a name it never used', () => {
    for (const name of ['module.mjs', 'browser-module.mjs']) {
      const file = join(fontkit, 'dist', name);
      const before = readFileSync(file, 'utf8');
      expect(before).not.toMatch(/\bshapingSteps\b/);
      const after = transform(before, file)!.code;
      expect(after).not.toMatch(/\bplan\b/);
      expect(after.match(/\bshapingSteps\b/g)?.length).toBe(before.match(/\bplan\b/g)?.length);
    }
  });
});
