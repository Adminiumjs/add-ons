/**
 * THE RULES A DIFF CANNOT SHOW: what the shipped code does not do and does
 * not say.
 *
 * - No network but the client the engine hands in: no `fetch`, no Node module.
 * - No module but its own files, its data, and the contract's types.
 * - No address but its sources' hosts and the links it names inert.
 * - No clock read and no dice rolled: the same answer gives the same facts.
 * - No banned word, no mark in the possessive, no raw control character.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { impuritiesIn, RAW_CONTROL_EXPLANATION, rawControlOffences } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { COMPANY_MARKS, INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';
import { bannedHitsIn, POSSESSIVE, tieringHitsIn } from './testing/lexicon.ts';

const SRC = new URL('.', import.meta.url).pathname;
const ROOT = join(SRC, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const read = (file: string) => readFileSync(file, 'utf8');
const SHIPPED = walk(SRC).filter((file) => /\.(ts|tsx|json)$/.test(file) && !file.includes('.test.') && !file.includes('/testing/'));
/** The server half: what the engine imports, held to its own rules below. The screens (`pages/`) are a page's, held to theirs. */
const CODE = SHIPPED.filter((file) => file.endsWith('.ts') && !relative(SRC, file).startsWith('pages/'));
const SCREENS = SHIPPED.filter((file) => /\.tsx?$/.test(file) && relative(SRC, file).startsWith('pages/'));
const name = (file: string) => relative(SRC, file);
/** The code without its comments: the documentation a comment cites is read, never called. */
const codeOf = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');


describe('what the shipped code does not do', () => {
  it('found the shipped files at all', () => {
    expect(CODE.map(name).sort()).toEqual([
      'activities/index.ts',
      'add-on-facts.ts',
      'sample/bundle.ts',
      'server.ts',
      'server/companies-house.ts',
      'server/france-places.ts',
      'server/france.ts',
      'server/hunter.ts',
      'server/index.ts',
      'server/norway.ts',
      'server/opencorporates.ts',
      'server/shared.ts',
      'server/website.ts',
    ]);
  });

  it('makes no call of its own and loads no Node module', () => {
    expect(CODE.filter((file) => /\bfetch\s*\(|XMLHttpRequest|WebSocket|from\s+['"]node:|require\(|process\./.test(codeOf(file))).map(name)).toEqual([]);
  });

  it('imports only its own files and data, and the contract only for its types', () => {
    const imports = CODE.flatMap((file) => [...codeOf(file).matchAll(/^import\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => ({ file: name(file), typeOnly: m[1] !== undefined, from: m[2]! })));
    expect(imports.filter((one) => !one.from.startsWith('./') && !one.from.startsWith('../') && !(one.typeOnly && one.from === '@adminium/add-on-contracts'))).toEqual([]);
  });

  it('names no address but its sources’ hosts and the links it names inert', () => {
    const allowed = new Set([...manifest.addOn.network.allow.map((host) => `https://${host}`), ...INERT_ORIGINS.map((one) => one.origin)]);
    // An address built from a host constant (`https://${HOST}`) is that source's own: the conformance proves where it goes.
    const named = CODE.flatMap((file) => [...codeOf(file).matchAll(/https?:\/\/[^\s'"`)/$]+/g)].map((m) => ({ file: name(file), origin: m[0] }))).filter((one) => one.origin !== 'https://');
    // A reserved `.example` name (the sample's sites) resolves nowhere.
    expect(named.filter((one) => !allowed.has(one.origin) && !/\.example$/.test(one.origin))).toEqual([]);
    // Every inert link is really named: a stale allowance is a hole.
    for (const one of INERT_ORIGINS) expect(CODE.some((file) => codeOf(file).includes(one.origin)), one.origin).toBe(true);
  });

  it('reads no clock and rolls no dice', () => {
    expect(CODE.flatMap((file) => impuritiesIn(codeOf(file)).map((why) => `${name(file)}: ${why}`))).toEqual([]);
  });

  it('writes no mark in the possessive', () => {
    for (const file of CODE) expect(codeOf(file), name(file)).not.toMatch(POSSESSIVE);
  });

  it('uses no raw directional control characters', () => {
    expect(SHIPPED.flatMap((file) => rawControlOffences(file, read(file))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });
});

describe('what the shipped words do not say', () => {
  const SAID = () => [...SHIPPED, join(ROOT, 'manifest.json'), ...walk(join(ROOT, 'seeds'))];

  it('uses no banned word, in the sources, the activity lists, the manifest or the sample', () => {
    for (const file of SAID()) {
      const text = read(file);
      const hits = bannedHitsIn(text);
      expect(hits.map((hit) => `${hit.word}: …${text.slice(Math.max(0, hit.at - 40), hit.at + 40)}…`), relative(ROOT, file)).toEqual([]);
    }
  });

  it('never calls itself a paid grade in any locale’s own words', () => {
    for (const file of SAID()) expect(tieringHitsIn(read(file)), relative(ROOT, file)).toEqual([]);
  });

  it('never says "leads" as a state of a record: only the add-on’s own name holds the word', () => {
    for (const file of [join(ROOT, 'manifest.json'), ...walk(join(ROOT, 'seeds'))]) {
      const text = read(file).replace(/lead[- ]finder|lead-source|"leads"/gi, '');
      expect(text.match(/\bleads?\b/gi) ?? [], relative(ROOT, file)).toEqual([]);
    }
  });
});

describe('what the screens do not do', () => {
  it('found the screens at all', () => {
    expect(SCREENS.length).toBeGreaterThan(10);
  });

  it('call nothing but through the host: no fetch of their own, no socket, no Node module', () => {
    expect(SCREENS.filter((file) => /\bfetch\s*\(|XMLHttpRequest|WebSocket|from\s+['"]node:|require\(/.test(codeOf(file))).map(name)).toEqual([]);
  });

  it('name no address but made-up `.example` ones', () => {
    const named = SCREENS.flatMap((file) => [...codeOf(file).matchAll(/https?:\/\/[^\s'"`)/$]+/g)].map((m) => ({ file: name(file), origin: m[0] })));
    expect(named.filter((one) => !/\.example$/.test(one.origin))).toEqual([]);
  });

  it('never name a key’s setting: a source’s key is saved to Adminium by its source id, and never read back', () => {
    for (const file of SCREENS) for (const one of NEVER_IN_A_BROWSER) expect(read(file), `${name(file)}: ${one.text}`).not.toContain(one.text);
  });

  it('write no mark in the possessive, and no raw directional control characters', () => {
    for (const file of SCREENS) expect(codeOf(file), name(file)).not.toMatch(POSSESSIVE);
    expect(SCREENS.flatMap((file) => rawControlOffences(file, read(file))), RAW_CONTROL_EXPLANATION).toEqual([]);
  });

  it('never say "lead" or "leads" of a company or a person: only the add-on’s name holds the word', () => {
    const strings = walk(join(SRC, 'pages', 'strings'));
    for (const file of strings) {
      const text = read(file).replace(/lead[- ]finder/gi, '');
      expect(text.match(/\bleads?\b/gi) ?? [], name(file)).toEqual([]);
    }
  });
});

describe('the keys never reach a browser', () => {
  it('names each secret setting the manifest declares, and only those', () => {
    expect(NEVER_IN_A_BROWSER.map((one) => one.text).sort()).toEqual(manifest.settings.filter((setting) => setting.secret).map((setting) => setting.key).sort());
  });

  it('declares the marks it names, in the table of every mark', () => {
    expect(COMPANY_MARKS.map((one) => one.mark).sort()).toEqual(['Hunter', 'OpenCorporates']);
  });
});

describe('the word check itself', () => {
  it('fails each word that may not ship, and passes the ordinary words they hide in', () => {
    for (const word of ['plan', 'free text', 'a pro look', 'tier', 'Premium', 'prospects', 'un métier', 'propriétaire']) expect(bannedHitsIn(word), word).not.toEqual([]);
    for (const word of ['provide', 'Fabrication de produits', 'Plant propagation', 'Transports côtiers', 'Freezing of fish']) expect(bannedHitsIn(word), word).toEqual([]);
  });
});
