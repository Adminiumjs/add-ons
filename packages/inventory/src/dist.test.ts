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
import { builtProvider, builtServer, FILE_MAX_BYTES } from './testing/vm.ts';

/** Every built file the manifest names. */
const DECLARED_ENTRY_POINTS = [...manifest.addOn.provides.map((entry) => entry.server), ...manifest.addOn.pages.map((page) => page.client)];

/** Every file under `dist/`, the screens' folder included. */
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
    for (const file of built()) {
      expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
    }
  });
});

describe('the built bytes pass the release sweep', () => {
  it('carries none of the banned substrings', () => {
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

describe('the server file is one Adminium can run', () => {
  it('is a classic script: it assigns module.exports and asks for no module', () => {
    const code = codeOf(builtServer());
    expect(code).toMatch(/module\.exports\s*=/);
    expect(code).not.toMatch(/^\s*export\s/m);
    expect(code).not.toMatch(/^\s*import\s/m);
    expect(code).not.toMatch(/\brequire\s*\(/);
    expect(code).not.toMatch(/\bimport\s*\(/);
  });

  it('reaches for nothing a bare context does not have', () => {
    const code = codeOf(builtServer());
    for (const name of ['process', 'globalThis.Date', 'fetch', 'setTimeout', 'setInterval', 'XMLHttpRequest']) {
      expect(code, name).not.toMatch(new RegExp(`\\b${name.replace('.', '\\.')}\\b`));
    }
    expect(code).not.toContain('react');
  });

  it('reads no clock and mints nothing random, checked on the BYTES', () => {
    expect(impuritiesIn(codeOf(builtServer()))).toEqual([]);
  });

  it('stays under the size a server will load', () => {
    expect(statSync(join(DIST, 'server.js')).size).toBeLessThanOrEqual(FILE_MAX_BYTES);
  });

  it('answers in the bare context a save runs it in', () => {
    const answer = builtProvider().rows({
      contract: 'posting-rows@1',
      ledger: 'stock',
      action: 'use',
      posting: 'none',
      phase: 'post',
      mode: 'dry',
      origin: 'staff',
      now: '2026-01-05T10:00:00.000Z',
      today: '2026-01-05',
      zone: 'UTC',
      currency: null,
      source: { table: 'inventory:items', row: '1' },
      lines: [],
      reads: {},
      settings: {},
      written: {},
      version: '1.0.8',
    });
    expect(answer).toEqual({ rows: [] });
  });
});
