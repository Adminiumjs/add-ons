/**
 * The rules the shared package has to keep on behalf of every add-on that
 * imports it.
 *
 * Each add-on has a `sources.test.ts` that greps its own `src/` for a real
 * call, a real clock and a Node built-in. Those suites walk one directory —
 * their own — so the moment three copies of the contract became one imported
 * package, the imported package fell outside all three of them. This is that
 * grep, aimed here.
 *
 * The stakes are higher in this package than in any single add-on's: a
 * `Date.now()` here would be non-determinism in three demos at once, and a
 * runtime dependency here would be a D7 violation every add-on inherits
 * whether or not its own suite would have caught it.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { impuritiesIn } from './testing/purity.ts';
import {
  RAW_CONTROL_EXPLANATION,
  rawControlOffences,
  rawControlsIn,
} from './testing/encoding.ts';
import {
  foreignImportsIn,
  foreignModulesIn,
  offendingAddresses,
  sendersIn,
  withoutComments,
  type AllowedModule,
  type InertOrigin,
} from './testing/egress.ts';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const ALL = walk(SRC).filter((f) => /\.tsx?$/.test(f));
const relative = (file: string) => file.slice(SRC.length);

/** Everything an add-on's bundle can reach: not a test, not a test helper. */
const SHIPPABLE = ALL.filter((f) => !f.includes('.test.') && !f.includes(`${'testing'}${'/'}`));

/**
 * The source with its comments removed, by a LEXER and not two regexes.
 *
 * [Changed 2026-08-20.] What stood here deleted everything between a block
 * comment opener and the next closer, wherever they appeared. An adversarial
 * pass put those two tokens inside two ORDINARY STRING LITERALS with a real
 * third-party import between them, and every static net below went blind at
 * once: the import, an image beacon and a literal tracker address all vanished
 * before any scanner ran, the suite stayed green, and the module reached the
 * built bundle. It was not one gate's hole, it was this function's.
 *
 * Half of it was already known — the line-comment regex carried an explicit
 * guard so a `https` prefix inside a string was not read as a comment. There
 * was no counterpart for block comments. `withoutComments` is string-aware for
 * both, and is the same file in all three repos.
 */
const codeOf = (file: string) => withoutComments(readFileSync(file, 'utf8'));

/**
 * The shared contract names no host at all — it is types and pure functions.
 *
 * An empty list is the honest value here, and it is worth more than a
 * populated one: the gate below reports EVERY address, so the day somebody adds
 * a URL to this package they have to come here and say why it is inert.
 */
const INERT: readonly InertOrigin[] = [];

describe('the shared contract stays pure (24 D7, D11)', () => {
  /*
   * D11 AS A RULE RATHER THAN A WORD LIST — see `testing/egress.ts` for the
   * argument and for the mutant that beat the five-word grep this replaced.
   * Two nets: an address nobody declared inert, and an API whose only purpose
   * is to issue a request. The third net (the value, at run time) lives in the
   * host apps, which are the repos that have a page to render.
   */
  it('names no address outside the ones declared inert', () => {
    const offenders = SHIPPABLE.flatMap((file) =>
      offendingAddresses(codeOf(file), INERT).map((url) => `${relative(file)} → ${url}`),
    );
    expect(offenders).toEqual([]);
  });

  /**
   * ── AND THE PACKAGES A SHIPPABLE SOURCE MAY IMPORT (28-T26 follow-up) ─────
   *
   * Net two banned the APIs that send and the dynamic `import()` of anything
   * but a relative literal, and read as though it covered "reaching outside
   * this repo". A STATIC import was in neither half: `import { track } from
   * "some-analytics-sdk"` matched nothing, because the `fetch` is in the SDK
   * and not in our file.
   *
   * This package is the seam two host apps vendor, so its list is the shortest
   * of the three: an add-on host renders slots and does nothing else. `react`
   * is here because it renders; nobody is claiming it was audited.
   */
  const ALLOWED_MODULES: readonly AllowedModule[] = [
    { name: 'react', why: 'the renderer \u2014 the slot seam returns elements' },
  ];

  it('carries nothing that can issue a request', () => {
    const offenders = SHIPPABLE.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)} → ${spec}`),
      // The static half, which neither of the two above ever looked at.
      ...foreignModulesIn(codeOf(file), ALLOWED_MODULES).map(
        (spec) => `${relative(file)} → imports ${spec}, which nobody declared`,
      ),
    ]);
    expect(offenders).toEqual([]);
  });

  it('sees a static import, in the spellings the old net two could not', () => {
    const allowed = [{ name: 'react', why: 'test' }];
    const seen = (code: string): string[] => foreignModulesIn(code, allowed);

    expect(seen('import { track } from "some-analytics-sdk";')).toEqual(['some-analytics-sdk']);
    // No bindings at all: it imports nothing and runs everything in the module.
    expect(seen('import "some-analytics-sdk";')).toEqual(['some-analytics-sdk']);
    expect(seen('export { z } from "exfil-pkg";')).toEqual(['exfil-pkg']);
    // A declared package forgives its subpaths and no lookalike.
    expect(seen('import x from "react/jsx-runtime";')).toEqual([]);
    expect(seen('import x from "react-tracker";')).toEqual(['react-tracker']);
    expect(seen('import x from "./local.ts";')).toEqual([]);
  });

  /*
   * THE RULE IS `testing/purity.ts` NOW, not a regular expression written out
   * here. There were three of these — one per repo — and they had drifted:
   * this one banned five things, the print works checked four and the maker
   * studio three, so `performance.now()` and `crypto.randomUUID()` were live in
   * two shipped apps with every gate green. See that file.
   */
  it('reads no clock and rolls no dice', () => {
    const offenders = SHIPPABLE.flatMap((file) =>
      impuritiesIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });

  it('would say so if one arrived, in every spelling the three repos disagreed on', () => {
    // The mutant that proved the drift, driven through the shared rule.
    const seeded = 'export const zzSeed = { at: performance.now(), id: crypto.randomUUID() };';
    expect(impuritiesIn(seeded).length).toBe(2);
    expect(impuritiesIn('const t = Date.now();').length).toBe(1);
    expect(impuritiesIn('const d = new Date();').length).toBe(1);
    expect(impuritiesIn('const r = Math.random();').length).toBe(1);
    expect(impuritiesIn('crypto.getRandomValues(new Uint8Array(8))').length).toBe(1);
    // …and the shapes that are pure arithmetic over a value passed in stay
    // quiet, or the rule would be one more thing with an exemption list.
    expect(impuritiesIn('const d = new Date(Date.UTC(2026, 7, 5));')).toEqual([]);
    expect(impuritiesIn('const d = new Date(iso);')).toEqual([]);
    expect(impuritiesIn('const at = clock.now();')).toEqual([]);
    expect(impuritiesIn('const id = job.cryptoRandomUUIDLabel;')).toEqual([]);
  });

  it('pulls in no Node built-in, because add-ons import this into a browser', () => {
    const offenders = SHIPPABLE.filter((file) => /from\s*['"]node:/.test(codeOf(file)));
    expect(offenders.map(relative)).toEqual([]);
  });

  /**
   * THE D7 CHECK, and the one this package could most easily break for
   * everyone. `zod` is the validators' dependency and the host does not carry
   * it; the split that keeps it out of a browser is that `testing/` is a
   * separate entry point nothing under it imports back.
   */
  it('keeps zod on the test side of the seam', () => {
    const offenders = SHIPPABLE.filter((file) => /from\s*['"]zod['"]/.test(codeOf(file)));
    expect(
      offenders.map(relative),
      'zod may only be imported from src/testing/, which no shipped module reaches',
    ).toEqual([]);
  });

  it('imports nothing at runtime that the host does not already have', () => {
    const allowed = /^(react|react-dom|react\/jsx-runtime|lucide-react)$/;
    const offenders: string[] = [];
    for (const file of SHIPPABLE) {
      for (const [, spec] of codeOf(file).matchAll(/from\s*['"]([^.'"][^'"]*)['"]/g)) {
        if (!allowed.test(spec)) offenders.push(`${relative(file)} → ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  /**
   * `react` appears exactly once and only as a type. An add-on's fill returns
   * a `ReactNode`, so the seam has to name the type; naming it with `import
   * type` means the import is erased and no module here can put a second copy
   * of React in a page.
   */
  it('names React only in a type position', () => {
    for (const file of SHIPPABLE) {
      const source = codeOf(file);
      for (const [line] of source.matchAll(/^.*from\s*['"]react['"].*$/gm)) {
        expect(line.trim(), `${relative(file)} imports React as a value`).toMatch(/^import type /);
      }
    }
  });
});

/**
 * ── AND THE FILES THEMSELVES ARE STILL TEXT ─────────────────────────────────
 *
 * The rule is in `testing/encoding.ts`; this is it aimed at the package that
 * declares it, which is the same argument the header of this file makes about
 * purity. The stakes are the same shape too: a raw control byte HERE is a
 * module `grep` silently refuses to read in every repo that vendors it.
 *
 * The scanner's own behaviour is driven below rather than assumed, because a
 * detector that reported nothing would make this and the four add-on suites
 * pass by finding nothing to find.
 */
describe('every source file is text a tool will read', () => {
  it('writes control characters as escapes, never as raw bytes', () => {
    const offenders = ALL.flatMap((file) =>
      rawControlOffences(relative(file), readFileSync(file, 'utf8')),
    );
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join('\n')}\n`).toEqual([]);
  });

  it('reports a raw byte, with the line and the code point', () => {
    const planted = `const k = \`a${String.fromCharCode(0)}b\`;\nconst j = 'x${String.fromCharCode(1)}y';`;
    expect(rawControlsIn(planted).map((hit) => hit.label)).toEqual(['U+0000', 'U+0001']);
    expect(rawControlsIn(planted).map((hit) => hit.line)).toEqual([1, 2]);
    expect(rawControlOffences('store.ts', planted)).toEqual([
      'store.ts:1 · U+0000',
      'store.ts:2 · U+0001',
    ]);
  });

  it('takes the escaped spelling of the same string as clean', () => {
    // The whole point: identical to a compiler, readable to everything else.
    expect(rawControlsIn(String.raw`const k = 'a\x00b', j = 'x\x01y';`)).toEqual([]);
    expect(String.raw`a\x00b`.length).toBe(6);
  });

  it('leaves tab, newline and carriage return alone, which are text', () => {
    expect(rawControlsIn('a\tb\r\nc')).toEqual([]);
  });
});
