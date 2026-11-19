/**
 * THE BUILT BYTES, READ BACK: what ships is `dist/server.js`, so this builds
 * it for real, checks it imports nothing, then loads it the way the engine
 * does and runs the contract's suite through it against a handwritten
 * register.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { CreateLeadSource } from '@adminium/add-on-contracts';
import { leadSourceConformance } from '@adminium/add-on-contracts/testing/lead-source';
import { beforeAll, describe, expect, it } from 'vitest';

import { BUILT_FILES, OUTPUT } from '../vite.config.ts';
import { norway } from './testing/answers.ts';
import { buildForReal, DIST, ROOT } from './testing/build.ts';
import { bannedHitsIn, POSSESSIVE, tieringHitsIn } from './testing/lexicon.ts';
import * as GERMAN from './pages/strings/de-DE.ts';

/** The server half with its three activity lists inlined. */
const MAX_BYTES = 320 * 1024;
/** The page: every screen, eight languages of their words, and the three activity lists. */
const PAGE_MAX_BYTES = 900 * 1024;
/** The record action: the sheet and its words. */
const CLIENT_MAX_BYTES = 300 * 1024;

const files = (dir = DIST): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? files(full) : [full];
  });

beforeAll(() => buildForReal(), 180_000);

describe('dist/', () => {
  it('holds the three files the build writes, and nothing else', () => {
    expect(files().map((file) => relative(ROOT, file)).sort()).toEqual([...BUILT_FILES].sort());
  });

});

describe('the screens and the record action', () => {
  const screens = [OUTPUT.pages['lead-finder'], OUTPUT.client];

  it('each import nothing (the host is read through the shims), with no sourcemap, under its size', () => {
    for (const file of screens) {
      const bytes = readFileSync(join(ROOT, file), 'utf8');
      expect([...bytes.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1]), file).toEqual([]);
      expect(bytes, file).not.toMatch(/\bimport\s*\(/);
      expect(bytes, file).not.toContain('sourceMappingURL');
    }
    // Every screen, eight languages of their words, and the three activity lists "What they do" offers.
    expect(readFileSync(join(ROOT, OUTPUT.pages['lead-finder']), 'utf8').length).toBeLessThan(PAGE_MAX_BYTES);
    expect(readFileSync(join(ROOT, OUTPUT.client), 'utf8').length).toBeLessThan(CLIENT_MAX_BYTES);
  });

  it('carry every language of their words, and never a key’s setting name', () => {
    for (const file of screens) {
      const bytes = readFileSync(join(ROOT, file), 'utf8');
      expect(bytes, file).toContain(GERMAN.shared['shared.retry']!);
      for (const never of ['companies_house_key', 'opencorporates_key', 'hunter_key', 'vitest', 'test-key-']) expect(bytes, `${file}: ${never}`).not.toContain(never);
    }
  });

  it('export what the engine loads: the page its component, the record action its fill', async () => {
    const client = readFileSync(join(ROOT, OUTPUT.client), 'utf8');
    expect(client).toMatch(/export\s*\{[^}]*\bregister\b/);
    const page = readFileSync(join(ROOT, OUTPUT.pages['lead-finder']), 'utf8');
    expect(page).toMatch(/export\s*\{[^}]*\bas default\b/);
  });
});

describe('dist/server.js', () => {
  it('imports nothing, with no sourcemap', () => {
    const bytes = readFileSync(join(ROOT, OUTPUT.server), 'utf8');
    expect([...bytes.matchAll(/\bfrom\s*['"]([^'"\n]+)['"]/g)].map((m) => m[1])).toEqual([]);
    expect(bytes).not.toMatch(/\bimport\s*\(/);
    expect(bytes).not.toContain('sourceMappingURL');
    expect(bytes.length).toBeLessThan(MAX_BYTES);
  });

  it('carries no zod and no test code: the contract is used for its types only', () => {
    const bytes = readFileSync(join(ROOT, OUTPUT.server), 'utf8');
    for (const never of ['leadSourceConformance', 'safeParse', 'test-key-', 'vitest']) expect(bytes, never).not.toContain(never);
  });

  it('writes no mark in the possessive', () => {
    const code = readFileSync(join(ROOT, OUTPUT.server), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
    expect(code).not.toMatch(POSSESSIVE);
  });

  it('loads the way the engine loads it, and passes the contract’s suite', async () => {
    const module = (await import(pathToFileURL(join(ROOT, OUTPUT.server)).href)) as { createLeadSource?: CreateLeadSource };
    expect(typeof module.createLeadSource).toBe('function');
    const answers = norway();
    const report = await leadSourceConformance(module.createLeadSource!, {
      source: 'norway',
      hosts: ['data.brreg.no'],
      gives: ['find', 'fill'],
      key: null,
      respond: (url, init) => answers.respond(url, init),
      find: { activity: '71.110', place: { text: 'Bergen', country: 'NO' }, page: { cursor: null, size: 2 } },
      fill: { number: '923456781' },
    });
    expect(report.failures).toEqual([]);
    expect(new Set(report.reached)).toEqual(new Set(['data.brreg.no']));
  });
});

describe('the release word sweep, over every byte that ships', () => {
  const shipped = (): { name: string; bytes: string }[] => [
    ...BUILT_FILES.map((file) => ({ name: file, bytes: readFileSync(join(ROOT, file), 'utf8') })),
    { name: 'manifest.json', bytes: readFileSync(join(ROOT, 'manifest.json'), 'utf8') },
  ];

  it('holds no word of a paid grade', () => {
    const offenders: string[] = [];
    for (const { name, bytes } of shipped()) for (const { word, at } of bannedHitsIn(bytes)) offenders.push(`${name} · "${word}" · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`);
    expect(offenders).toEqual([]);
  });

  it("never calls itself a paid grade in any locale's own words", () => {
    const offenders: string[] = [];
    for (const { name, bytes } of shipped()) for (const { pattern, at } of tieringHitsIn(bytes)) offenders.push(`${name} · /${pattern}/ · …${bytes.slice(Math.max(0, at - 60), at + 60)}…`);
    expect(offenders).toEqual([]);
  });
});
