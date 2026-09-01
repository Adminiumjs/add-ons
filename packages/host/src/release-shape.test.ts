// SPDX-License-Identifier: AGPL-3.0-only
/**
 * The packaging invariants, guarded (32-add-on-distribution.md D1/D9, §2).
 *
 * WHY THIS FILE EXISTS AT ALL. Before it, **no test in this repository read a
 * single `package.json`** — so `private: true`, a missing `files[]`, a name
 * that no longer matched its manifest key, and a version skew between
 * `package.json` and `manifest.json` were all invisible to the whole suite.
 * That is fine while nothing is published and catastrophic the moment something
 * is, because npm versions are immutable: the first release is also the last
 * chance to notice.
 *
 * THE ONE THAT WOULD HAVE SHIPPED. Without `files[]`, `npm pack` here produces
 * an INVERTED tarball — all of `src/` including every `.test.ts`, and no `dist/`
 * at all, because the root `.gitignore`'s `dist` entry applies to packing. It
 * was measured at 45 files, 11 of them tests, zero product. Nothing said so.
 *
 * DISCOVERED, NEVER LISTED, exactly like `trademarks.test.ts`: a package is an
 * add-on when it carries a `manifest.json`. A seventh add-on is covered the day
 * it lands, and the floor below refuses a discovery that silently finds
 * nothing — a green run over zero packages is the failure mode this whole file
 * is arguing against.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/** `packages/host/src/` → the repo's `packages/`. */
const PACKAGES = join(new URL('../..', import.meta.url).pathname);
const REPO = join(PACKAGES, '..');

/** The `files[]` allow-list every add-on declares, in order. */
const FILES_FIELD = ['dist', 'manifest.json', 'TRADEMARKS.md', 'README.md', 'LICENSE'];

/** Packages that are deliberately never published (24 D7). */
const NEVER_PUBLISHED = ['host', 'host-kit'];

interface AddOn {
  dir: string;
  name: string;
  pkg: Record<string, unknown>;
  manifest: Record<string, unknown>;
}

function addOns(): AddOn[] {
  return readdirSync(PACKAGES, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({ name: entry.name, dir: join(PACKAGES, entry.name) }))
    .filter((pkg) => existsSync(join(pkg.dir, 'manifest.json')))
    .map((pkg) => ({
      ...pkg,
      pkg: JSON.parse(readFileSync(join(pkg.dir, 'package.json'), 'utf8')) as Record<string, unknown>,
      manifest: JSON.parse(readFileSync(join(pkg.dir, 'manifest.json'), 'utf8')) as Record<
        string,
        unknown
      >,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}

const found = addOns();

describe('release shape: discovery', () => {
  it('finds every add-on, and refuses to pass over none', () => {
    // The floor is the anti-empty-discovery guard `trademarks.test.ts` uses for
    // the same reason: a walk that finds nothing asserts nothing, loudly green.
    expect(found.length).toBeGreaterThan(3);
    expect(found.map((a) => a.name)).toEqual([
      'barcode-labels',
      'design-studio',
      'holiday-calendars',
      'import-canva',
      'personalizer',
      'shipping-dhl',
    ]);
  });

  it('keeps the two never-published packages out of the add-on set', () => {
    // They carry no manifest, which is what excludes them — asserted here so
    // that adding one to either would fail loudly rather than publish raw
    // TypeScript sources (both `build` scripts are literally an `echo`).
    for (const name of NEVER_PUBLISHED) {
      expect(existsSync(join(PACKAGES, name)), `${name} should exist`).toBe(true);
      expect(existsSync(join(PACKAGES, name, 'manifest.json')), `${name} must have no manifest`).toBe(
        false,
      );
      const pkg = JSON.parse(readFileSync(join(PACKAGES, name, 'package.json'), 'utf8')) as {
        private?: boolean;
      };
      expect(pkg.private, `${name} must stay private (24 D7)`).toBe(true);
    }
  });
});

describe.each(found)('release shape: $name', (addOn) => {
  it('is publishable — not private', () => {
    expect(addOn.pkg['private']).toBeUndefined();
  });

  it('declares the exact files[] allow-list', () => {
    // Exact, not a superset: an extra entry is how `src/` creeps back in, and
    // npm SILENTLY DROPS an entry whose file does not exist, so a missing one
    // is invisible at pack time.
    expect(addOn.pkg['files']).toEqual(FILES_FIELD);
  });

  it('has a name the published name is derivable from', () => {
    // The source keeps the internal `@adminium` scope; the publish script maps
    // it to `@adminiumjs` at pack time. That mapping is only sound while the
    // source name is exactly `@adminium/add-on-<manifest key>`.
    expect(addOn.pkg['name']).toBe(`@adminium/add-on-${String(addOn.manifest['key'])}`);
    expect(addOn.manifest['key']).toBe(addOn.name);
  });

  it('carries the same version in package.json and manifest.json', () => {
    // `changeset version` bumps only the first. The manifest's version is what
    // a deployment installs by, so a skew means the installed thing is not the
    // thing the catalog named.
    expect(addOn.pkg['version']).toBe(addOn.manifest['version']);
  });

  it('pins its @adminiumjs dependencies exactly, with no range (D9)', () => {
    const groups = ['dependencies', 'devDependencies', 'peerDependencies'] as const;
    for (const group of groups) {
      const deps = (addOn.pkg[group] ?? {}) as Record<string, string>;
      for (const [dep, range] of Object.entries(deps)) {
        if (!dep.startsWith('@adminiumjs/')) continue;
        expect(range, `${addOn.name} ${group}.${dep} must be an exact version`).toMatch(
          /^\d+\.\d+\.\d+/,
        );
      }
    }
  });

  it('ships the two documents the tarball is required to carry', () => {
    // The LICENSE is staged from the repo root at pack time (AGPL §4), so it is
    // deliberately absent here; these two are committed per package.
    expect(existsSync(join(addOn.dir, 'README.md'))).toBe(true);
    expect(existsSync(join(addOn.dir, 'TRADEMARKS.md'))).toBe(true);
  });

  it('peer-declares React, and bundles everything else (26-T13)', () => {
    const dist = join(addOn.dir, 'dist');
    if (!existsSync(dist)) return; // dist is gitignored; typecheck → test → build

    const imported = new Set<string>();
    for (const file of readdirSync(dist).filter((f) => f.endsWith('.js'))) {
      const source = readFileSync(join(dist, file), 'utf8');
      // Anchored to a real specifier shape rather than `[^"]*`: the bundles are
      // minified, `from` occurs inside them in other roles, and a permissive
      // class happily matches across a newline into whatever follows.
      for (const match of source.matchAll(/\bfrom\s*"([@a-zA-Z][^"\n]*)"/g)) {
        const specifier = match[1]!;
        const parts = specifier.split('/');
        imported.add(specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!);
      }
    }

    /*
     * THE RULE CHANGED WITH THE ABI, AND THE OLD ONE WAS "PEER == IMPORT".
     *
     * That held while React was a Rollup external: an add-on peer-declared
     * exactly what its bundle imported. 26-T13 broke the equation deliberately —
     * a browser cannot resolve a bare specifier, so React now arrives through
     * the host's runtime global and `lucide-react` is bundled outright.
     *
     * So the two halves are now asserted separately, because they became
     * different facts:
     *
     *   `react` IS a peer — the add-on genuinely requires the host to have one,
     *   and exactly one — and is NOT imported, which is the whole point.
     *
     *   everything else is bundled, so it is a build-time dependency and
     *   peer-declaring it would be an install a consumer does not need (npm 7+
     *   auto-installs peers, so that is a real cost).
     */
    expect(imported, `${addOn.name}'s bundle must import nothing at all`).toEqual(new Set());

    const declared = new Set(Object.keys((addOn.pkg['peerDependencies'] ?? {}) as object));
    expect(declared.has('react'), `${addOn.name} must peer-declare react`).toBe(true);
    for (const specifier of declared) {
      expect(
        specifier === 'react' || specifier === 'react-dom',
        `${addOn.name} peer-declares ${specifier}, which is now bundled rather than shared`,
      ).toBe(true);
    }
  });
});

describe('release shape: the repo-level pieces the pipeline needs', () => {
  it('has a LICENSE at the root for the publish script to stage', () => {
    expect(existsSync(join(REPO, 'LICENSE'))).toBe(true);
  });

  it('has the publish and version-sync scripts', () => {
    expect(existsSync(join(REPO, 'scripts/publish-add-ons.mjs'))).toBe(true);
    expect(existsSync(join(REPO, 'scripts/sync-manifest-versions.mjs'))).toBe(true);
  });

  it('still stages the LICENSE into every package at pack time (AGPL §4)', () => {
    // The one release property NO pack-shape test can catch, and it is worth
    // saying why. No package commits a LICENSE; the publish script copies the
    // root one in before packing. `pack-shape.test.ts` stages it the same way
    // in order to reproduce the release's tarball, so if the script ever
    // stopped copying it, that suite would go on passing while every published
    // tarball shipped without a licence. npm's force-include does not save it
    // either — that only applies to a LICENSE that is already on disk.
    //
    // A grep, deliberately: asserting the copy happens for real would mean
    // running the publish script from a unit test. This checks the step is
    // still named, which is what a deletion would remove.
    const script = readFileSync(join(REPO, 'scripts/publish-add-ons.mjs'), 'utf8');
    expect(script).toMatch(/ROOT_LICENSE/);
    expect(script).toMatch(/copyFileSync\(/);
  });

  it('wires the manifest-version sync into the version script, not into memory', () => {
    const root = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(root.scripts['version']).toContain('changeset version');
    expect(root.scripts['version']).toContain('sync-manifest-versions.mjs');
  });

  it('keeps the changesets fixed group off the never-published packages', () => {
    const config = JSON.parse(readFileSync(join(REPO, '.changeset/config.json'), 'utf8')) as {
      fixed: string[][];
    };
    // `@adminium/*` would sweep in `host` and `host-kit`, and claim to release
    // two packages no registry will ever see.
    expect(config.fixed).toEqual([['@adminium/add-on-*']]);
  });

  it('names this workflow file, whose filename is load-bearing for OIDC', () => {
    // npm attaches the trusted publisher to a repository AND a workflow
    // FILENAME. Renaming it breaks every publish until all six are repointed
    // by hand on npmjs.com.
    expect(existsSync(join(REPO, '.github/workflows/release.yml'))).toBe(true);
  });
});
