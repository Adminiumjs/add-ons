/**
 * The BUILT bytes, which are the only ones that ship.
 *
 * Every other suite in this package reads source. This one reads `dist/`,
 * because the release sweep does — 17 §2 greps built output, and a gate that
 * checked source alone would miss anything a bundler inlines: a dependency's
 * copy, a sourcemap's verbatim `sourcesContent`, a string the compiler
 * synthesised.
 *
 * It builds the bundle itself rather than reading whatever is on disk. `dist/`
 * is gitignored and the verification order is typecheck → test → build, so a
 * suite that only read an existing `dist/` would silently pass on a clean
 * clone by grepping nothing, and would read STALE bytes everywhere else.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { impuritiesIn } from '@adminium/add-on-host/testing';

import manifest from '../manifest.json' with { type: 'json' };
import { buildForReal, DIST } from './testing/build.ts';
import { bannedHitsIn } from './testing/lexicon.ts';

const DECLARED_ENTRY_POINTS = [
  ...manifest.addOn.slots.map((slot) => slot.client),
  ...manifest.addOn.provides.map((entry) => entry.server),
];

function built(): string[] {
  return readdirSync(DIST)
    .map((entry) => join(DIST, entry))
    .filter((file) => statSync(file).isFile());
}

const asRelative = (file: string) => relative(DIST, file);

beforeAll(() => {
  buildForReal();
}, 180_000);

describe('the build writes what the manifest promises', () => {
  it('puts a real file at every entry point the manifest declares', () => {
    // Driven from `manifest.json` rather than from `OUTPUT`, so this fails
    // when the manifest names something the build does not write — the failure
    // mode an installer hits at load time and nobody hits before.
    for (const path of new Set(DECLARED_ENTRY_POINTS)) {
      expect(existsSync(join(DIST, '..', path)), `${path} is declared but not built`).toBe(true);
    }
  });

  it('ships the two modules the manifest names and nothing else', () => {
    // Spelled out rather than derived from the manifest: a build that quietly
    // emitted a third file would still satisfy "every declared entry exists"
    // above, and would be caught only here.
    expect(built().map(asRelative).sort()).toEqual(['client.js', 'server.js']);
  });

  it('emits no sourcemap, and no reference to one', () => {
    /*
     * A sourcemap's `sourcesContent` is a VERBATIM copy of every source file,
     * comments included — so the largest file in the artefact would be the one
     * most likely to carry a word the release sweep bans, and the one a grep
     * over `dist/` is most tempted to skip by extension. That is not
     * hypothetical: `packages/shipping-dhl` shipped exactly that until
     * somebody grepped the built output by hand.
     */
    expect(built().filter((file) => file.endsWith('.map')).map(asRelative)).toEqual([]);
    for (const file of built()) {
      expect(readFileSync(file, 'utf8')).not.toContain('sourceMappingURL');
    }
  });
});

describe('the built bytes pass the release sweep', () => {
  it('carries none of the banned substrings, in either half', () => {
    /*
     * THE WHOLE OF `dist/`, both files, case-insensitively, as substrings —
     * the same grep the release runs and not a politer version of it. The
     * source-level sweep in `sources.test.ts` reads the string bundle, the
     * document chrome and the outline labels; this one reads what a bundler
     * actually produced from all three plus everything it inlined.
     */
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

describe('the server half is a server half', () => {
  it('pulls in no React, so the job runner can import it', () => {
    /*
     * The engine's `document.render` job runs in Node, where the
     * host-runtime React shim's global does not exist and reading it throws at
     * module init. A server bundle that had swallowed a component would fail
     * at import time, in a job, with a stack nobody would connect to a fill.
     */
    const server = readFileSync(join(DIST, 'server.js'), 'utf8');
    expect(server).not.toContain('react');
    expect(server).not.toContain('jsx');
  });

  it('reads no clock and mints nothing random, checked on the BYTES', () => {
    /*
     * The determinism claim again, one layer down. `sources.test.ts` runs the
     * same rule over the source; this runs it over what the bundler actually
     * produced, which is the only version that ships and the only one that
     * could have picked something up from a dependency.
     *
     * THE SAME RULE, IMPORTED — not a second pattern for it. Writing
     * `/new Date\b/` here would be two rules where there is meant to be one,
     * and only one of them gets repaired next time: four add-ons in this
     * repository each wrote their own version, none checked
     * `crypto.getRandomValues`, and a die reached a shipped engine with every
     * package green. `packages/host/src/shared-rule.test.ts` fails this file
     * if it ever grows a pattern of its own, and did on 2026-09-10.
     */
    for (const file of built()) {
      const code = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/\/\/[^\n]*/g, ' ');
      expect(impuritiesIn(code), asRelative(file)).toEqual([]);
    }
  });

  it('leaves each bundle a single self-contained ESM file', () => {
    // D7. A second entry sharing a generated chunk would make a bundle import
    // a sibling the manifest does not name, and the host loads only what the
    // manifest names. `kinds.ts`, `money.ts` and the renderers are reached
    // from BOTH entries here, so one Rollup run would certainly have hoisted
    // them — which is why `vite.config.ts` runs two.
    for (const file of built()) {
      const bytes = readFileSync(file, 'utf8');
      expect(bytes, asRelative(file)).not.toMatch(/^import .* from ["']\.\//m);
    }
  });
});
