/**
 * THE BUILT BYTES, READ BACK: what ships is `dist/server.js`, so this builds
 * it for real, checks it imports nothing, then loads it the way the engine
 * does and runs a call through it against a recorded Square.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';

import type { CreateCardTerminal, PaymentHttpClient } from '@adminium/add-on-host/contracts';

import { BUILT_FILES, OUTPUT } from '../vite.config.ts';
import { POSSESSIVE } from './sources.test.ts';
import { buildForReal, DIST, ROOT } from './testing/build.ts';
import { ALLOWED_IDENTIFIERS, ALLOWED_TOKENS, bannedHitsIn, tieringHitsIn } from './testing/lexicon.ts';

const MAX_BYTES = 64 * 1024;

const files = (dir = DIST): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? files(full) : [full];
  });

beforeAll(() => buildForReal(), 180_000);

describe('dist/server.js', () => {
  it('is the only file the build writes', () => {
    expect(files().map((file) => relative(ROOT, file)).sort()).toEqual([...BUILT_FILES].sort());
  });

  it('imports nothing, with no sourcemap', () => {
    const bytes = readFileSync(join(ROOT, OUTPUT.server), 'utf8');
    expect([...bytes.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1])).toEqual([]);
    expect(bytes).not.toMatch(/\bimport\s*\(/);
    expect(bytes).not.toContain('sourceMappingURL');
    expect(bytes.length).toBeLessThan(MAX_BYTES);
  });

  it('writes no mark in the possessive', () => {
    const code = readFileSync(join(ROOT, OUTPUT.server), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code).not.toMatch(POSSESSIVE);
  });

  it('loads the way the engine loads it, and its factory answers', async () => {
    const module = (await import(pathToFileURL(join(ROOT, OUTPUT.server)).href)) as { createCardTerminal?: CreateCardTerminal };
    expect(typeof module.createCardTerminal).toBe('function');
    const http: PaymentHttpClient = async (url) => ({
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(url.endsWith('/v2/merchants/me') ? { merchant: { id: 'MLBUILT' } } : { device_codes: [] }),
    });
    const terminal = module.createCardTerminal!({ http, credentials: { access_token: 'EAAAbuiltBytesToken01' }, mode: 'test' });
    expect(await terminal.checkCredentials()).toEqual({ ok: true, accountId: 'MLBUILT', livemode: false, missing: [] });
  });
});

describe('the release word sweep, over every byte that ships', () => {
  const shipped = (): { name: string; bytes: string }[] => [
    { name: OUTPUT.server, bytes: readFileSync(join(ROOT, OUTPUT.server), 'utf8') },
    { name: 'manifest.json', bytes: readFileSync(join(ROOT, 'manifest.json'), 'utf8') },
  ];

  it('holds no word of a paid grade, but the exact words and wire names the lexicon allows', () => {
    const offenders: string[] = [];
    for (const { name, bytes } of shipped()) {
      for (const { word, at } of bannedHitsIn(bytes)) offenders.push(`${name} · "${word}" · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`);
    }
    expect(offenders).toEqual([]);
  });

  it("never calls itself a paid grade in any locale's own words", () => {
    const offenders: string[] = [];
    for (const { name, bytes } of shipped()) {
      for (const { pattern, at } of tieringHitsIn(bytes)) offenders.push(`${name} · /${pattern}/ · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`);
    }
    expect(offenders).toEqual([]);
  });

  it('allows only words that are really in what ships: a stale allowance is a hole', () => {
    const all = shipped()
      .map(({ bytes }) => bytes)
      .join('\n');
    const tokens = new Set([...all.toLowerCase().matchAll(/\p{L}+/gu)].map((match) => match[0]));
    expect(ALLOWED_TOKENS.filter((word) => !tokens.has(word))).toEqual([]);
    expect(ALLOWED_IDENTIFIERS.filter((identifier) => !all.includes(identifier))).toEqual([]);
  });
});
