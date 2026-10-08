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
import * as GERMAN from './pages/strings/de-DE.ts';
import { BUILT_FILES } from '../vite.config.ts';
import { buildForReal, DIST } from './testing/build.ts';
import { bannedHitsIn } from './testing/lexicon.ts';
import { builtProvider, builtServer, FILE_MAX_BYTES, providerFrom } from './testing/vm.ts';

/** Every built file the manifest names. */
const DECLARED_ENTRY_POINTS = [...manifest.addOn.provides.map((entry) => entry.server), ...manifest.addOn.pages.map((page) => page.client)];

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

describe("a screen carries its own words and nobody else's", () => {
  const file = (name: string) => readFileSync(join(DIST, 'pages', `${name}.js`), 'utf8');

  it('holds a sentence of its own in every language, and none of another screen', () => {
    // English and German: a screen's file carries all eight languages of its own words, and not one of its neighbours'.
    const OWN: Readonly<Record<string, string>> = { discounts: 'Can be combined', 'look-up': 'Type or scan a code first.', issue: 'Your role cannot issue.', rules: 'Takes a gift card as payment' };
    const KEY: Readonly<Record<string, [section: keyof typeof GERMAN, key: string]>> = { discounts: ['discounts', 'discounts.combinable'], 'look-up': ['lookup', 'lookup.field.empty'], issue: ['issue', 'issue.notAllowed'], rules: ['rules', 'rules.kind.pays'] };
    for (const [name, [section, key]] of Object.entries(KEY)) {
      const german = GERMAN[section][key] as string;
      expect(german, key).not.toBe(OWN[name]);
      expect(file(name), `${name} in German`).toContain(JSON.stringify(german).slice(1, -1));
      for (const other of Object.keys(KEY)) if (other !== name) expect(file(other), `${other} carries ${name}'s German`).not.toContain(JSON.stringify(german).slice(1, -1));
    }
    for (const [name, sentence] of Object.entries(OWN)) {
      expect(file(name), name).toContain(sentence);
      for (const [other, theirs] of Object.entries(OWN)) if (other !== name) expect(file(name), `${name} carries a sentence of ${other}`).not.toContain(theirs);
    }
  });

  it('is one file with everything in it but the host, and of a size a browser loads at once', () => {
    for (const name of ['discounts', 'look-up', 'issue', 'rules']) {
      // Nothing left for the browser to fetch from an address that serves one file.
      expect(codeOf(file(name)), name).not.toMatch(/^\s*import\s[^;]*\bfrom\b|^\s*import\s*['"]|\bimport\s*\(/m);
      // Its own sentences in eight languages are most of a screen's file; the editor, with the most to say, is the largest.
      expect(statSync(join(DIST, 'pages', `${name}.js`)).size, name).toBeLessThan(name === 'discounts' ? 240_000 : 160_000);
    }
  });

  it('never keeps a code in the address bar or in the browser', () => {
    // A code is typed into the screen's own state and sent in the body of one call: no screen writes storage but the
    // try pane's last picked row, and none builds an address from what was typed.
    for (const name of ['look-up', 'issue', 'rules']) expect(file(name), name).not.toMatch(/localStorage|sessionStorage/);
    expect(file('discounts').match(/localStorage/g)?.length ?? 0).toBeLessThanOrEqual(2);
    for (const name of ['discounts', 'look-up', 'issue', 'rules']) expect(file(name), name).not.toMatch(/sessionStorage|document\.cookie/);
  });
});

describe('what Offers prints is a module of its own', () => {
  it('is loaded like any provider, answers its four kinds, and is not the file that decides', async () => {
    const built = (await import(/* @vite-ignore */ `${join(DIST, 'documents.js')}?${String(statSync(join(DIST, 'documents.js')).mtimeMs)}`)) as { default: { key: string; kinds: () => { id: string }[] } };
    expect(built.default.key).toBe('offers');
    expect(built.default.kinds().map((kind) => kind.id)).toEqual(['gift-card', 'gift-card-strip', 'voucher', 'voucher-strip']);
    const code = codeOf(readFileSync(join(DIST, 'documents.js'), 'utf8'));
    // Everything it needs is in it: nothing is left for Adminium to resolve.
    expect(code).not.toMatch(/^\s*import\s[^;]*\bfrom\b|\bimport\s*\(|\brequire\s*\(/m);
    // And the deciding file holds none of it: no page of HTML is drawn where a price is worked out.
    expect(builtServer()).not.toContain('<!doctype html>');
    expect(statSync(join(DIST, 'documents.js')).size).toBeLessThanOrEqual(FILE_MAX_BYTES);
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
