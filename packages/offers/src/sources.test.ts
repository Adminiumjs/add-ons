/**
 * THE SOURCES, READ AS TEXT.
 *
 * What ships is built from these files, and the words in them reach an
 * operator's screen through the manifest. This suite reads them the way the
 * release sweep reads the built bytes: no banned word, no company named, no
 * address called, no clock read in the file that decides, and no raw control
 * character that would make a file invisible to every other scan.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { impuritiesIn, offendingAddresses, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { bannedHitsIn } from './testing/lexicon.ts';

const SRC = new URL('.', import.meta.url).pathname;
const ROOT = join(SRC, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const read = (file: string) => readFileSync(file, 'utf8');
const ALL = walk(SRC).filter((file) => /\.(ts|tsx)$/.test(file));
const SHIPPED = ALL.filter((file) => !file.includes('.test.') && !file.includes(`${'testing'}/`));
/** The files whose code is compiled into the file that decides: its entry, and the folders it is built from. */
const DECIDING = ['adjust/', 'rows/'];
const SERVER = SHIPPED.filter((file) => ['server.ts', 'money.ts'].includes(relative(SRC, file)) || DECIDING.some((folder) => relative(SRC, file).startsWith(folder)));

describe('the sources carry nothing that may not ship', () => {
  it('finds the sources it is about to read', () => {
    // A walk that finds nothing asserts nothing, loudly green.
    expect(SHIPPED.length).toBeGreaterThan(1);
    expect(SERVER.length).toBeGreaterThan(0);
  });

  it('uses no banned word, in the sources or in the manifest', () => {
    for (const file of [...SHIPPED, join(ROOT, 'manifest.json')]) {
      const hits = bannedHitsIn(read(file));
      const shown = hits
        .slice(0, 5)
        .map((hit) => `${hit.word} at ${String(hit.at)}`)
        .join(', ');
      expect(hits, `${relative(ROOT, file)}: ${shown}`).toEqual([]);
    }
  });

  it('uses no raw directional control characters', () => {
    /*
     * The gate that protects every other scan in this file: one raw control
     * byte makes a file `data` to a text search, which then matches nothing in
     * it and exits clean.
     */
    const offences = SHIPPED.flatMap((file) => rawControlOffences(file, read(file)));
    expect(offences, RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('calls no address', () => {
    expect(INERT_ORIGINS).toEqual([]);
    for (const file of SHIPPED) {
      expect(offendingAddresses(read(file), INERT_ORIGINS), relative(ROOT, file)).toEqual([]);
    }
  });

  it('reads no clock and mints nothing random in the file that decides', () => {
    for (const file of SERVER) {
      const code = read(file)
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
      expect(impuritiesIn(code), relative(ROOT, file)).toEqual([]);
    }
  });
});

describe('there is nothing to keep out of a browser, and no company to name', () => {
  it('declares no secret, because the manifest declares none', () => {
    expect(NEVER_IN_A_BROWSER).toEqual([]);
    expect(manifest.addOn.connect.kind).toBe('none');
  });

  it('names no company', () => {
    expect(COMPANY_MARKS).toEqual([]);
  });
});
