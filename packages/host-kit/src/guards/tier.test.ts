/**
 * The ratchet, driven — over a package manifest and a set of suites.
 *
 * This is the one guard aimed at a person rather than at a defect, so what has
 * to be proved is that it cannot be satisfied by doing nothing: a host that
 * vendors the files and calls none of them has a directory, not a gate, and the
 * whole value of the tier declaration is that this says so out loud.
 */

import { afterEach, describe, expect, it } from 'vitest';

import {
  componentIsMounted,
  declaredDependencies,
  guardsNotWired,
  TIER_1_GUARDS,
  TIER_2_GUARDS,
  TIER_2_DEPENDENCIES,
} from './tier.ts';
import { syntheticHost, type SyntheticHost } from './synthetic-host.ts';

let host: SyntheticHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
});

describe('the guard tables', () => {
  it('name nine and four, and every entry says what it closes', () => {
    /*
     * NINE AND FOUR, not the six and five `config.ts`'s prose says — see
     * `tier.ts` for why `label-pairing` is the piece that moves, and 34-T28 for
     * the two that joined tier 1 with the document work. The NAMES are
     * authoritative; this case exists so the tables cannot be quietly trimmed,
     * and it asserts a relation about the entries rather than only a count.
     */
    expect(TIER_1_GUARDS.map((guard) => guard.symbol)).toEqual([
      'lexiconGuard',
      'brandGuard',
      'labelPairingSourceGuard',
      'payloadCastsGuard',
      'factsGuard',
      'vendoredGuard',
      'deliveryClaimsGuard',
      'recordPayloadGuard',
      'stylesGuard',
    ]);
    expect(TIER_2_GUARDS.map((guard) => guard.symbol)).toEqual([
      'drewSomething',
      'createAddOnSlot',
      'labelPairingRenderedGuard',
      'mountsGuard',
    ]);
    for (const guard of [...TIER_1_GUARDS, ...TIER_2_GUARDS]) {
      // A guard whose absence is reported without saying what it leaves open is
      // a line a reader skims. Every one of these is a defect that has shipped.
      expect(guard.closes.length, guard.symbol).toBeGreaterThan(40);
      expect(guard.what.length, guard.symbol).toBeGreaterThan(10);
    }
  });

  it('accepts either DOM driver, because neither seam host has the named one', () => {
    /*
     * MEASURED 2026-08-28: `print-shop` and `maker-shop` carry every tier-2
     * suite there is, have `jsdom`, and do NOT have `@testing-library/react` —
     * they drive React through `react-dom/client` and `act`. Requiring the
     * named library would fail the two hosts furthest ahead on their first run,
     * for a dependency that would add nothing they do not already do.
     */
    expect([...TIER_2_DEPENDENCIES.driver]).toContain('@testing-library/react');
    expect([...TIER_2_DEPENDENCIES.driver]).toContain('react-dom');
    expect([...TIER_2_DEPENDENCIES.dom]).toContain('jsdom');
  });
});

describe('reading what a host declares', () => {
  it('sees both dependency sections', () => {
    host = syntheticHost();
    const declared = declaredDependencies(host.config.rootDir);
    expect(declared.has('react-dom')).toBe(true); //  dependencies
    expect(declared.has('vitest')).toBe(true); //     devDependencies
    expect(declared.has('jsdom')).toBe(false);
  });

  it('answers a host with no manifest with nothing rather than throwing', () => {
    expect(declaredDependencies('/nowhere/at/all').size).toBe(0);
  });

  it('sees a DOM once one is added', () => {
    host = syntheticHost({
      files: {
        'package.json': JSON.stringify({ name: 'x', devDependencies: { jsdom: '^29.1.1' } }),
      },
    });
    const declared = declaredDependencies(host.config.rootDir);
    expect(TIER_2_DEPENDENCIES.dom.some((name) => declared.has(name))).toBe(true);
  });
});

describe('which guards a host actually wired', () => {
  it('reports none missing when every symbol is named by a suite', () => {
    host = syntheticHost();
    expect(guardsNotWired(host.config, TIER_1_GUARDS)).toEqual([]);
  });

  it('reports the ones a host vendored and never called', () => {
    // Vendoring the files and calling nothing is a directory, not a gate.
    host = syntheticHost({ files: { 'src/kit.test.ts': 'brandGuard(hostKit);\n' } });
    expect(guardsNotWired(host.config, TIER_1_GUARDS).map((guard) => guard.symbol)).toEqual([
      'lexiconGuard',
      'labelPairingSourceGuard',
      'payloadCastsGuard',
      'factsGuard',
      'vendoredGuard',
      'deliveryClaimsGuard',
      'recordPayloadGuard',
      'stylesGuard',
    ]);
  });

  it('does not count a symbol named only in a comment', () => {
    /*
     * The same rule the mount guard insists on, one level down: a call inside a
     * comment satisfies a grep. This one strips comments first, so "I meant to
     * wire this up" reads as not wired — which is the honest answer.
     */
    host = syntheticHost({
      files: { 'src/kit.test.ts': '// TODO: lexiconGuard(hostKit, scope);\nbrandGuard(hostKit);\n' },
    });
    const missing = guardsNotWired(host.config, TIER_1_GUARDS).map((guard) => guard.symbol);
    expect(missing).toContain('lexiconGuard');
  });

  it('reports every guard as unwired when a host has no suites at all', () => {
    // Which is why the guard asks whether there ARE suites, separately: this
    // result and "a host that wired nothing" are the same list.
    host = syntheticHost({ files: { 'src/kit.test.ts': null } });
    expect(guardsNotWired(host.config, TIER_1_GUARDS)).toHaveLength(TIER_1_GUARDS.length);
  });
});

describe('the component-and-guard coupling', () => {
  it('sees a host that mounts the component', () => {
    host = syntheticHost();
    expect(componentIsMounted(host.config)).toBe(true);
  });

  it('sees a host that does not', () => {
    host = syntheticHost({ files: { 'src/screens/Shop.tsx': 'export const Shop = () => null;\n' } });
    expect(componentIsMounted(host.config)).toBe(false);
  });

  it('and the two together are what demand the payload-cast guard', () => {
    /*
     * One `as never` at a mount site defeats the whole payload contract with
     * `tsc -b` clean and every other suite green. A host with the component and
     * without this guard has a contract with a hatch in it.
     */
    host = syntheticHost({ files: { 'src/kit.test.ts': 'brandGuard(hostKit);\n' } });
    expect(componentIsMounted(host.config)).toBe(true);
    const wanted = TIER_1_GUARDS.filter((guard) => guard.symbol === 'payloadCastsGuard');
    expect(guardsNotWired(host.config, wanted).map((guard) => guard.symbol)).toEqual([
      'payloadCastsGuard',
    ]);
  });
});
