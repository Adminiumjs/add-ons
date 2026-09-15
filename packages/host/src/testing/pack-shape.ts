/**
 * The pack-shape conformance suite (32-add-on-distribution.md D1).
 *
 * D1's distributable unit is "the npm tarball of the package as it already
 * exists": `manifest.json` + `dist/` + `README.md` + `TRADEMARKS.md` + a
 * copied-in `LICENSE`, `files[]`-allowlisted so nothing else ships. This asserts
 * that the tarball npm ACTUALLY produces is that, so it "cannot silently grow or
 * lose a half". 48-self-hosted-downloads.md D5 keeps that shape: the file
 * uploaded to the downloads bucket is still `npm pack`'s tarball — npm is the
 * local packer, no longer where it is published.
 *
 * ── WHY THIS IS NOT COVERED BY ASSERTING `files[]` ──────────────────────────
 *
 * `release-shape.test.ts` already asserts the `files[]` DECLARATION. What npm
 * actually packs is a different fact, and the two come apart in both
 * directions — measured here, not assumed:
 *
 *  1. **Without `files[]` the tarball INVERTS.** The root `.gitignore` carries
 *     `dist`, and npm honours it in a workspace package, so a package with no
 *     `files[]` ships all of `src/` — every `.test.ts` included — and no `dist/`
 *     at all: the whole product missing and the whole test suite published in
 *     its place, with every existing guard green. Dropping `dist` from `files[]`
 *     fails this suite, which is the property that matters most.
 *  2. **npm force-includes some files and not others, and the split is not
 *     obvious.** `LICENSE`, `README.md` and `package.json` ship whether or not
 *     `files[]` names them — so asserting those proves only that the file
 *     exists on disk. `TRADEMARKS.md` is NOT force-included: it ships only
 *     because `files[]` names it, which makes it the one document here whose
 *     presence really is a `files[]` assertion. (Verified by packing with
 *     `files: ["dist", "manifest.json"]`: LICENSE and README came anyway,
 *     TRADEMARKS.md did not.)
 *
 * WHAT THIS SUITE CANNOT PROVE, stated so nobody reads more into it: the
 * `LICENSE` is committed by no package — `scripts/publish-add-ons.mjs` stages it
 * at pack time, and `packReport` below stages it the same way. So a regression
 * that stopped the publish script copying it would NOT fail here. That is
 * covered where it can be: `release-shape.test.ts` asserts the script still
 * carries the staging step, and the monorepo's round-trip reads the real
 * `scripts/out/*.tgz` and finds `LICENSE` inside them.
 *
 * So this suite runs `npm pack --dry-run --json` and asserts the file list npm
 * reports, not the field the author wrote.
 *
 * ── WHY IT LIVES IN EACH PACKAGE'S SUITE AND NOT IN ONE DISCOVERED PLACE ────
 *
 * The repo's own history argues for discovery — five hand-copied `SLOT_IDS`
 * tables say so. But a pack needs `dist/` on disk, and only the owning
 * package's suite can build it (`npm run verify` is typecheck → test → build,
 * so tests run before any build). Hence: the LOGIC lives here, once; each
 * package contributes a three-line file that supplies its own `buildForReal`.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

/** What one package needs to supply to run the suite. */
export interface PackShapeFixtures {
  /** The package directory (`new URL('..', import.meta.url).pathname`). */
  root: string;
  /** The package's own real build, so `dist/` exists before packing. */
  buildForReal: () => void;
}

/** The five entries every add-on allow-lists, and the only ones. */
export const REQUIRED_ROOT_FILES = [
  'LICENSE',
  'README.md',
  'TRADEMARKS.md',
  'manifest.json',
  'package.json',
] as const;

/**
 * Everything in `dist/`, discovered rather than listed.
 *
 * Deriving the expected set from the manifest's declared entry points would
 * miss what the build emits and no manifest names — `import-canva` and two
 * siblings ship a `dist/client.css` that appears in no manifest field. Reading
 * the directory means a new emitted artefact is covered the day it appears,
 * and — because the "nothing else" assertion below shares this set — an
 * artefact that STOPS being emitted fails too.
 */
function distContents(dist: string): string[] {
  if (!existsSync(dist)) return [];
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return walk(dist).map((f) => `dist/${relative(dist, f)}`).sort();
}

interface PackEntry {
  path: string;
}
interface PackReport {
  files: PackEntry[];
  name: string;
  version: string;
}

/**
 * Packs the package the way the release does.
 *
 * `--dry-run` writes nothing; `--json` reports the exact member list. The
 * publish script stages a rewritten `package.json` and a copied-in `LICENSE`
 * before packing, so this does the same two things — otherwise it would be
 * asserting the shape of a tarball the release never produces.
 */
function packReport(root: string, repoRoot: string): PackReport {
  const licence = join(root, 'LICENSE');
  const staged = !existsSync(licence);
  if (staged) {
    execFileSync('cp', [join(repoRoot, 'LICENSE'), licence]);
  }
  try {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return (JSON.parse(out) as PackReport[])[0]!;
  } finally {
    if (staged) execFileSync('rm', ['-f', licence]);
  }
}

/** Runs the pack-shape suite for one add-on. */
export function describePackShape(fixtures: PackShapeFixtures): void {
  const repoRoot = join(fixtures.root, '..', '..');
  let report: PackReport;
  let paths: string[];
  let distFiles: string[];

  describe('pack shape (32 D1)', () => {
    beforeAll(() => {
      fixtures.buildForReal();
      distFiles = distContents(join(fixtures.root, 'dist'));
      report = packReport(fixtures.root, repoRoot);
      paths = report.files.map((f) => f.path).sort();
    }, 180_000);

    it('packs from the @adminium source scope, which only the release script maps', () => {
      // The source name stays `@adminium/*` — the release script maps it to
      // `@adminiumjs/*` — so what this asserts is that the mapping is the only
      // way that name reaches a released file. A source rename would show up here.
      expect(report.name.startsWith('@adminium/')).toBe(true);
    });

    it('ships the five root files', () => {
      for (const file of REQUIRED_ROOT_FILES) {
        expect(paths, `${file} is missing from the tarball`).toContain(file);
      }
    });

    it('ships TRADEMARKS.md, which only files[] can put there', () => {
      // Called out separately from the four beside it because it is the only
      // one of the five npm does NOT force-include: LICENSE, README.md and
      // package.json ship regardless of `files[]`, so this is the single root
      // file whose presence actually exercises the allow-list. D12 also makes
      // it the document that must travel with a trademark-bearing package.
      expect(paths).toContain('TRADEMARKS.md');
    });

    it('ships every built artefact the package emits', () => {
      expect(distFiles.length, 'the build produced no dist/ to ship').toBeGreaterThan(0);
      for (const file of distFiles) {
        expect(paths, `${file} is missing from the tarball`).toContain(file);
      }
    });

    it('ships NOTHING else — no sources, no tests, no configs', () => {
      const allowed = new Set<string>([...REQUIRED_ROOT_FILES, ...distFiles]);
      const extra = paths.filter((p) => !allowed.has(p));
      expect(extra, `unexpected files in the tarball: ${extra.join(', ')}`).toEqual([]);
    });

    it('carries no source file and no test under any path', () => {
      // Stated separately from the exact-set assertion above because this is
      // the INVERTED-TARBALL failure mode, and it deserves to fail with its own
      // name rather than as one of thirty unexpected paths.
      expect(paths.filter((p) => p.startsWith('src/'))).toEqual([]);
      expect(paths.filter((p) => p.includes('.test.'))).toEqual([]);
      expect(paths.filter((p) => p.endsWith('.map'))).toEqual([]);
      expect(paths.filter((p) => p.startsWith('tsconfig'))).toEqual([]);
    });
  });
}
