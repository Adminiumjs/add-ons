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
  foreignImportsIn,
  offendingAddresses,
  sendersIn,
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

/** Comments stripped — every rule below is about what the CODE does. */
const codeOf = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

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

  it('carries nothing that can issue a request', () => {
    const offenders = SHIPPABLE.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)} → ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)} → ${spec}`),
    ]);
    expect(offenders).toEqual([]);
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
