/**
 * IS THE SHARED RULE ACTUALLY THE RULE ANYWHERE?
 *
 * ── THE HOLE THIS CLOSES ────────────────────────────────────────────────────
 *
 * `testing/purity.ts` was written to end a drift, and its header says so: three
 * regular expressions in three repos, disagreeing, with nothing anywhere able
 * to see it. The repair was one file, copied byte for byte, with
 * `host-mirror.test.ts` failing on any difference.
 *
 * That guard can only see a copy that DIFFERS. It is blind to the far commoner
 * failure — a package that never imported the file in the first place and is
 * still running its own regex beside it. Which is what all four add-on packages
 * in this repo were doing. `impuritiesIn` had exactly three callers: this
 * package's own `purity.test.ts` and the two hosts' `sources.test.ts`. The four
 * add-ons each restated the rule, none of the four checked
 * `crypto.getRandomValues`, and `shipping-dhl` — the one add-on that ships into
 * BOTH hosts — also omitted `crypto.randomUUID`.
 *
 * Proven the way the header's own defect was proven, by appending one line to a
 * shipped module:
 *
 *     export const zzSeed = crypto.getRandomValues(new Uint8Array(4))[0];
 *
 * in `personalizer/src/template.ts`, which is the determinism engine AC17 rests
 * on — the module that makes the cart thumbnail, the proof, the order line and
 * the proof dialog byte-identical. The package stayed at 157 of 157 green and
 * the die was compiled into `dist/client.js` and `dist/server.js`.
 *
 * ── SO THE ARRANGEMENT IS THE THING UNDER TEST ──────────────────────────────
 *
 * Two questions, asked of every package and every host that is checked out:
 *
 *   1. DOES IT IMPORT THE RULE? A package with no caller of `impuritiesIn` is a
 *      package whose determinism claim is resting on nothing, or on something
 *      nobody has read.
 *   2. DOES IT STATE THE RULE ANYWHERE ELSE? A private second pattern is how
 *      this started, and it does not announce itself: the file is green, the
 *      claim is made, and the two rules only disagree about the API nobody
 *      thought of.
 *
 * `restatementsIn` in `testing/purity.ts` answers the second, and the argument
 * for how it tells a restatement from a mention is written there.
 *
 * ── WHY THE TWO KINDS OF CODE-BASE ARE REACHED DIFFERENTLY ──────────────────
 *
 * They cannot all import the shared rule the same way, and the difference is
 * not a matter of taste:
 *
 *   THE FOUR ADD-ON PACKAGES are workspaces of this repo. Each already declares
 *   `@adminium/add-on-host` as a devDependency, so `@adminium/add-on-host/
 *   testing` resolves through the workspace link and there is exactly one copy
 *   of the file on disk for them. Nothing needs mirroring; they import it, and
 *   question 1 is a real import check.
 *
 *   THE TWO HOSTS cannot. Each is a standalone Vite SPA, published from a clean
 *   clone with no sibling checkout of anything and no dependency on this repo —
 *   that is what makes them installable examples rather than a monorepo's
 *   apps. So each vendors `src/testing/purity.ts` and imports it relatively,
 *   and `host-mirror.test.ts` holds the three copies byte-identical. For a host
 *   question 1 is "does its `sources.test.ts` call `impuritiesIn`", and the
 *   copy's own fidelity is the mirror suite's job, not this one's.
 *
 * The one path this suite must not read is `testing/purity.ts` itself, in any
 * repo: it IS the rule, so it necessarily spells every pattern out, and a guard
 * that flagged its own source would be a guard someone switches off.
 *
 * ── AND IT SKIPS CLEANLY ────────────────────────────────────────────────────
 *
 * Same as the mirror suite: a clean clone of this repo alone has no host beside
 * it, and that must still be green.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { impuritiesIn, restatementsIn } from './testing/purity.ts';

/** `packages/` — this file lives at `packages/host/src/`. */
const PACKAGES = fileURLToPath(new URL('../..', import.meta.url));

interface CodeBase {
  /** How a failure should name it. */
  readonly name: string;
  /** The directory whose `.ts`/`.tsx` files are read. */
  readonly src: string;
  /** The file expected to call `impuritiesIn`, and how it should reach it. */
  readonly reaches: string;
}

/**
 * Every add-on package in this repo: whatever is beside `host` under
 * `packages/`, discovered rather than listed. A fifth add-on lands in this
 * suite by existing, which is the only arrangement that survives the next one
 * being added by somebody who has not read this file.
 */
const ADD_ONS: readonly CodeBase[] = readdirSync(PACKAGES)
  .filter((entry) => entry !== 'host' && statSync(join(PACKAGES, entry)).isDirectory())
  .filter((entry) => existsSync(join(PACKAGES, entry, 'src')))
  .map((entry) => ({
    name: `packages/${entry}`,
    src: join(PACKAGES, entry, 'src'),
    reaches: '@adminium/add-on-host/testing',
  }));

/**
 * The hosts, found the way `host-mirror.test.ts` finds them and overridable by
 * the same two variables, so a checkout that lives elsewhere is configured once
 * for both suites.
 */
const HOSTS: readonly CodeBase[] = [
  {
    name: 'print-shop',
    src: join(
      process.env.ADMINIUM_PRINT_SHOP ??
        fileURLToPath(new URL('../../../../print-shop', import.meta.url)),
      'src',
    ),
    reaches: './testing/purity.ts',
  },
  {
    name: 'maker-shop',
    src: join(
      process.env.ADMINIUM_MAKER_SHOP ??
        fileURLToPath(new URL('../../../../maker-shop', import.meta.url)),
      'src',
    ),
    reaches: './testing/purity.ts',
  },
];

const presentHosts = HOSTS.filter((host) => existsSync(join(host.src, 'testing', 'purity.ts')));
const absentHosts = HOSTS.filter((host) => !presentHosts.includes(host));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/**
 * Every source file in a code-base EXCEPT the rule itself.
 *
 * `node_modules` and `dist` are skipped because a host's `src/` has neither and
 * a package's would only ever contain a build of its own sources; the exclusion
 * that matters is `testing/purity.ts`, and it is the only one stated by name.
 */
const RULE = join('testing', 'purity.ts');
function sourcesOf(base: CodeBase): string[] {
  if (!existsSync(base.src)) return [];
  return walk(base.src).filter(
    (file) =>
      /\.tsx?$/.test(file) &&
      !file.endsWith(RULE) &&
      !file.includes(`${'node_modules'}/`) &&
      !file.includes(`${'dist'}/`),
  );
}

/** Comments stripped, for the reason `impuritiesIn` states. */
const codeOf = (file: string) =>
  readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const relative = (base: CodeBase, file: string) => file.slice(base.src.length + 1);

describe.each(ADD_ONS)('$name states the purity rule by importing it', (base) => {
  it('calls impuritiesIn somewhere, rather than deciding for itself', () => {
    const callers = sourcesOf(base).filter((file) => /\bimpuritiesIn\s*\(/.test(codeOf(file)));
    expect(
      callers.map((file) => relative(base, file)),
      `${base.name} never calls impuritiesIn. Its determinism claim is then whatever ` +
        'its own pattern happens to say — which is how a die reached a shipped engine ' +
        `with the package green. Import it from ${base.reaches}.`,
    ).not.toEqual([]);
  });

  it('reaches it through the workspace, not through a copy of the file', () => {
    const importers = sourcesOf(base).filter((file) =>
      new RegExp(`from\\s*['"]${base.reaches}['"]`).test(codeOf(file)),
    );
    expect(importers.map((file) => relative(base, file))).not.toEqual([]);
    // And no package carries a purity.ts of its own to import instead.
    expect(existsSync(join(base.src, 'testing', 'purity.ts'))).toBe(false);
  });

  it('states it nowhere else', () => {
    const offenders = sourcesOf(base).flatMap((file) =>
      restatementsIn(codeOf(file)).map((means) => `${relative(base, file)} → ${means}`),
    );
    expect(
      offenders,
      'a pattern of its own beside the shared rule is two rules, and only one of them ' +
        'gets repaired next time — see testing/purity.ts',
    ).toEqual([]);
  });
});

describe.each(presentHosts)('$name states the purity rule by importing its copy', (base) => {
  it('calls impuritiesIn somewhere', () => {
    const callers = sourcesOf(base).filter((file) => /\bimpuritiesIn\s*\(/.test(codeOf(file)));
    expect(callers.map((file) => relative(base, file))).not.toEqual([]);
  });

  it('states it nowhere else', () => {
    const offenders = sourcesOf(base).flatMap((file) =>
      restatementsIn(codeOf(file)).map((means) => `${relative(base, file)} → ${means}`),
    );
    expect(offenders).toEqual([]);
  });
});

describe.skipIf(absentHosts.length === 0)('the hosts this run could not see', () => {
  it('says which, rather than passing quietly', () => {
    expect(absentHosts.map((h) => h.src)).not.toEqual([]);
  });
});

/**
 * THE DETECTOR'S OWN TESTS, and they live here rather than in `purity.test.ts`
 * because they have to spell restatements out — this file is the one place the
 * sweep above deliberately never reads.
 */
describe('a restatement is told from a mention', () => {
  it('catches every one of the four private copies this repo actually had', () => {
    // shipping-dhl, verbatim.
    expect(
      restatementsIn(String.raw`/Date\.now\s*\(|Math\.random\s*\(|new Date\s*\(\s*\)|performance\.now\s*\(/`),
    ).toHaveLength(4);
    // design-studio and import-canva, verbatim: the same four plus randomUUID.
    expect(
      restatementsIn(
        String.raw`/Date\.now\s*\(|Math\.random\s*\(|new Date\s*\(\s*\)|performance\.now\s*\(|crypto\.randomUUID/`,
      ),
    ).toHaveLength(5);
    // personalizer, verbatim.
    expect(
      restatementsIn(
        String.raw`/Date\.now\s*\(|Math\.random\s*\(|new Date\s*\(|performance\.now\s*\(|crypto\.randomUUID/`,
      ),
    ).toHaveLength(5);
  });

  it('catches the rule copied out of the shared file, spellings and all', () => {
    expect(restatementsIn(String.raw`/(?<![\w$.])Date\s*\.\s*now\s*\(/`)).toHaveLength(1);
    expect(restatementsIn(String.raw`/(?<![\w$])crypto\s*\.\s*getRandomValues/`)).toHaveLength(1);
    expect(restatementsIn(String.raw`/new\s+Date\s*\(\s*\)/`)).toHaveLength(1);
  });

  it('catches the spelling that escapes the paren instead of the dot', () => {
    expect(restatementsIn(String.raw`/Date.now\(/`)).toHaveLength(1);
    expect(restatementsIn(String.raw`/Math.random\(/`)).toHaveLength(1);
  });

  /**
   * THE HALF THAT KEEPS THE GUARD SWITCHED ON. Every one of these is a mention
   * — a fixture, a call, a neighbouring pattern about something else — and a
   * guard that failed on any of them would be turned off within the day.
   */
  it('says nothing about code that merely contains the call', () => {
    expect(restatementsIn('const t = Date.now();')).toEqual([]);
    expect(restatementsIn('crypto.getRandomValues(new Uint8Array(8))')).toEqual([]);
    expect(restatementsIn("expect(impuritiesIn('const r = Math.random();').length).toBe(1);")).toEqual(
      [],
    );
    expect(
      restatementsIn(
        "impuritiesIn('export const zzSeed = { at: performance.now(), id: crypto.randomUUID() };')",
      ),
    ).toEqual([]);
  });

  it('says nothing about a pattern that is about something else', () => {
    // maker-shop's `RAW_DATE`: same owner, different member, still legitimate.
    expect(restatementsIn(String.raw`/Date\.UTC|getUTC(Date|Day|Month|FullYear)/`)).toEqual([]);
    // The personalizer's stricter extra, written as a substring on purpose.
    expect(restatementsIn(`codeOf(file).includes('new Date')`)).toEqual([]);
  });

  /**
   * And the rule the two halves are guarding is still the rule: if this suite
   * ever passed because `impuritiesIn` had quietly stopped naming the API the
   * whole exercise was about, all of the above would be theatre.
   */
  it('is guarding a rule that still knows the API the four copies missed', () => {
    expect(impuritiesIn('crypto.getRandomValues(new Uint8Array(4))')).toHaveLength(1);
  });
});
