/**
 * THE BUILT BYTES, READ BACK.
 *
 * What ships is `dist/`, so this suite builds it for real and reads what
 * landed: the file the manifest names is there and nothing else is, nothing
 * banned is in it, and it is the kind of file Adminium can run — a classic
 * script that assigns `module.exports`, asks for no module, reads no clock and
 * stays under the size a server will load.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { impuritiesIn } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { BUILT_FILES } from '../vite.config.ts';
import { buildForReal, DIST } from './testing/build.ts';
import { bannedHitsIn } from './testing/lexicon.ts';
import { builtProvider, builtServer, FILE_MAX_BYTES, providerFrom } from './testing/vm.ts';

/** Every built file the manifest names. */
const DECLARED_ENTRY_POINTS = manifest.addOn.provides.map((entry) => entry.server);

/** Every file under `dist/`. */
function built(dir = DIST): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? built(path) : [path];
  });
}

const asRelative = (file: string) => relative(DIST, file);

/** The code with its comments taken out: what runs. */
const codeOf = (bytes: string) => bytes.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');

beforeAll(() => {
  buildForReal();
}, 180_000);

describe('the build writes what the manifest promises', () => {
  it('puts a real file at every entry point the manifest declares', () => {
    expect(DECLARED_ENTRY_POINTS.length).toBeGreaterThan(0);
    for (const path of new Set(DECLARED_ENTRY_POINTS)) {
      expect(BUILT_FILES, `${path} is declared but the build does not write it`).toContain(path);
      expect(existsSync(join(DIST, '..', path)), `${path} is declared but not built`).toBe(true);
    }
  });

  it('ships the files the build names, and no other', () => {
    expect(built().map(asRelative).sort()).toEqual(BUILT_FILES.map((path) => path.replace(/^dist\//, '')).sort());
  });

  it('emits no sourcemap, and no reference to one', () => {
    expect(built().filter((file) => file.endsWith('.map')).map(asRelative)).toEqual([]);
    for (const file of built()) expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
  });
});

describe('the built bytes pass the release sweep', () => {
  it('the built bytes pass the word gate', () => {
    for (const file of built()) {
      const hits = bannedHitsIn(readFileSync(file, 'utf8'));
      const shown = hits
        .slice(0, 5)
        .map((hit) => `${hit.word} at ${String(hit.at)}`)
        .join(', ');
      expect(hits, `${asRelative(file)}: ${shown}`).toEqual([]);
    }
  });
});

describe('the deciding file is one Adminium can run', () => {
  it('the deciding file is a classic script with no require, import, process, Date or fetch', () => {
    const code = codeOf(builtServer());
    expect(code).toMatch(/module\.exports\s*=/);
    expect(code).not.toMatch(/^\s*export\s/m);
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\bimport\s*\(/);
    for (const name of ['process', 'Date', 'fetch', 'setTimeout', 'setInterval', 'XMLHttpRequest']) expect(code, name).not.toMatch(new RegExp(`\\b${name}\\b`));
    expect(code).not.toContain('react');
  });

  it('reads no clock and mints nothing random, checked on the BYTES', () => {
    expect(impuritiesIn(codeOf(builtServer()))).toEqual([]);
  });

  it('stays under the size a server will load', () => {
    expect(statSync(join(DIST, 'server.js')).size).toBeLessThanOrEqual(FILE_MAX_BYTES);
  });

  it('answers both questions in the bare context a save runs it in', () => {
    const provider = builtProvider();
    const rows = provider.rows({
      contract: 'posting-rows@1',
      ledger: 'value',
      action: 'spend',
      posting: 'none',
      phase: 'post',
      mode: 'dry',
      origin: 'staff',
      now: '2026-01-05T10:00:00.000Z',
      today: '2026-01-05',
      zone: 'UTC',
      currency: null,
      source: { table: 'offers:gift_cards', row: '1' },
      lines: [],
      reads: {},
      settings: {},
      written: {},
      version: manifest.version,
    } as never);
    expect(rows).toEqual({ rows: [] });
    const adjusted = provider.adjust({
      contract: 'price-adjust@1',
      mode: 'dry',
      point: 'line',
      origin: 'staff',
      now: '2026-01-05T10:00:00.000Z',
      today: '2026-01-05',
      weekday: 1,
      time: '10:00',
      zone: 'UTC',
      currency: 'USD',
      scale: 2,
      locale: 'en-US',
      lines: ['p0:1', 'p0:2'].map((key, index) => ({ key, part: 0, index, price: '4.00', quantity: '1', amount: '4.00', what: [], excluded: false, paidBy: null, kept: true })),
      codes: [],
      customer: null,
      guest: true,
      staff: null,
      offers: {},
      settings: {},
      explain: false,
      version: manifest.version,
    } as never);
    // One entry for every line handed in, and no other.
    expect(adjusted.lines.map((line) => line.key)).toEqual(['p0:1', 'p0:2']);
    // No offer, no code, nobody's hand: nothing off, written with the order's own decimals.
    expect(adjusted).toEqual({ lines: [{ key: 'p0:1', discount: '0.00' }, { key: 'p0:2', discount: '0.00' }], order: { discount: '0.00' }, applied: [], uses: [], refused: [] });
  });

  it('is refused by the loader when it reaches for a clock, and when it exports no such question', () => {
    expect(() => providerFrom('module.exports = { rows: function () { return { rows: [], at: new Date().toISOString() }; } };').rows({} as never)).toThrow();
    expect(() => providerFrom('module.exports = { rows: function () { return { rows: [] }; } };').adjust({} as never)).toThrow('the file exports no adjust()');
  });
});
