/**
 * THE BUNDLE A BROWSER CAN ACTUALLY IMPORT (26-T13).
 *
 * ─── The defect this exists to prevent from returning ──────────────────────
 *
 * Every add-on's client bundle used to open with `import { useMemo } from
 * "react"`, because React and the icon set were Rollup EXTERNALS. That is the
 * right answer when a BUNDLER resolves the import — demo mode compiles an
 * add-on into the host's own build, and Vite resolves it there — and it is the
 * wrong answer the moment a BROWSER does: a bare specifier cannot be resolved
 * by `import()` without an import map.
 *
 * So the artefact 26 §6 describes the host "`import()`ing from the server with
 * its SRI hash" could not be imported by a browser at all, and nothing noticed,
 * because every test that touched `dist/` either read it as text or imported it
 * through a bundler that resolved the externals the same way the demo build
 * does. The gap was invisible precisely to the suites that looked hardest at
 * the built output.
 *
 * ─── So this asks the browser's question ───────────────────────────────────
 *
 * Two assertions, and the second is the one with teeth:
 *
 *  1. the bundle contains NO bare specifier — checked over the bytes, so it
 *     holds whatever the build config happens to say;
 *  2. the bundle LOADS AND REGISTERS against a host-provided runtime — checked
 *     by publishing a real React on the global and importing the built file,
 *     which is exactly the sequence a host performs.
 *
 * The second is what makes the first mean something: a bundle could have no
 * bare imports and still be broken, and only running it says otherwise.
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { beforeAll, describe, expect, it } from 'vitest';

import { clearAddOnRuntime, installAddOnRuntime } from '../runtime/index.ts';

export interface LoadableFixtures {
  /** The built `dist/client.js` — absolute. */
  clientBundle: string;
  /** This package's real build, so `dist/` exists before the check. */
  buildForReal: () => void;
  /** The add-on key `register()` must return, so a mixed-up path is caught. */
  key: string;
}

/**
 * A bare specifier: an import whose target names a PACKAGE rather than a path.
 *
 * `./x`, `../x` and `/x` are all fine — a browser resolves those against the
 * module's own URL. `react`, `@scope/pkg` and `lucide-react` are not, and are
 * exactly what this refuses.
 */
const BARE_SPECIFIER = /(?:^|[\s;}])(?:import|export)[^;'"]*?from\s*["'](?![./])([^"']+)["']/g;
/** The side-effect form, `import "pkg";`, which the pattern above does not see. */
const BARE_SIDE_EFFECT = /(?:^|[\s;}])import\s*["'](?![./])([^"']+)["']/g;

/** Every package specifier the bundle would ask a browser to resolve. */
export function bareSpecifiersIn(source: string): string[] {
  const found = new Set<string>();
  for (const pattern of [BARE_SPECIFIER, BARE_SIDE_EFFECT]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(source);
    while (match !== null) {
      if (match[1] !== undefined) found.add(match[1]);
      match = pattern.exec(source);
    }
  }
  return [...found].sort();
}

/** Runs the loadability suite for one add-on. */
export function describeLoadable(fixtures: LoadableFixtures): void {
  describe('loadable by a browser (26-T13)', () => {
    let source: string;

    beforeAll(() => {
      fixtures.buildForReal();
      source = readFileSync(fixtures.clientBundle, 'utf8');
    }, 180_000);

    it('asks a browser to resolve no package specifier at all', () => {
      // Over the BYTES, not the config: a bundle is loadable or it is not, and
      // the build's `external` list is one edit away from disagreeing with it.
      expect(bareSpecifiersIn(source)).toEqual([]);
    });

    it('carries its own icons rather than importing them', () => {
      // The half of the change that is a size trade, asserted so it is a
      // decision rather than a drift: React is shared for identity, icons are
      // copied because two sets of SVG components harm nothing.
      expect(source).not.toContain('lucide-react');
    });

    it('loads and registers against a host-provided runtime', async () => {
      // The assertion with teeth. This is the exact sequence a host performs:
      // publish React, then import the built file. Anything the shims got
      // wrong fails here rather than in a browser.
      const react = await import('react');
      const jsx = await import('react/jsx-runtime');
      installAddOnRuntime({
        react: react as unknown as Readonly<Record<string, unknown>>,
        jsx: {
          jsx: (jsx as unknown as { jsx: unknown }).jsx,
          jsxs: (jsx as unknown as { jsxs: unknown }).jsxs,
          Fragment: (jsx as unknown as { Fragment: unknown }).Fragment,
        },
      });
      try {
        const module = (await import(pathToFileURL(fixtures.clientBundle).href)) as {
          register?: () => { key?: string };
        };
        expect(typeof module.register).toBe('function');
        expect(module.register!().key).toBe(fixtures.key);
      } finally {
        clearAddOnRuntime();
      }
    });

    it('says which call the host forgot when no runtime was provided', async () => {
      // The failure mode this contract is shaped to avoid is an add-on's first
      // hook throwing `undefined is not a function` from inside a minified
      // bundle. The message has to name the call and the ordering instead.
      clearAddOnRuntime();
      const { requireAddOnRuntime } = await import('../runtime/index.ts');
      expect(() => requireAddOnRuntime()).toThrow(/installAddOnRuntime/);
      expect(() => requireAddOnRuntime()).toThrow(/BEFORE importing/);
    });
  });
}
