/**
 * The discovery, driven over a module map rather than over a glob.
 *
 * `import.meta.glob` takes a string literal and this package's own checkout has
 * no vendored add-ons to match, so the glob itself is proved by a HOST running
 * `factsGuard` — whose first case is that it found something. What is proved
 * here is everything downstream of it, and in particular the case the whole
 * mechanism exists for: a vendored package that exports NOTHING must be
 * distinguishable from one with nothing to declare.
 */

import { describe, expect, it } from 'vitest';

import { factsFrom, VENDORED_FACTS, type AddOnFactsModule } from './facts.ts';

const CARRIER: AddOnFactsModule = {
  INERT_ORIGINS: [
    {
      origin: 'https://api.example-carrier.test',
      why: 'named in a manifest so an installer can read it; nothing in the client half can call it',
    },
  ],
  NEVER_IN_A_BROWSER: [
    { text: 'api_key', why: 'a `secret: true` setting key — the name a credential would be SAVED under' },
  ],
  COMPANY_MARKS: [{ mark: 'ExampleCarrier', owner: 'its owner' }],
};

/** An add-on that names nobody and calls nothing, which is the ordinary case. */
const QUIET: AddOnFactsModule = {
  INERT_ORIGINS: [],
  NEVER_IN_A_BROWSER: [],
  COMPANY_MARKS: [],
};

describe('flattening what the glob found', () => {
  it('collects every declaration, from every add-on', () => {
    const facts = factsFrom({ './vendor/a/add-on-facts.ts': CARRIER, './vendor/b/add-on-facts.ts': QUIET });
    expect(facts.sources).toHaveLength(2);
    expect(facts.origins.map((o) => o.origin)).toEqual(['https://api.example-carrier.test']);
    expect(facts.needles.map((n) => n.text)).toEqual(['api_key']);
    expect(facts.marks.map((m) => m.mark)).toEqual(['ExampleCarrier']);
  });

  it('tells an empty declaration from a missing one', () => {
    /*
     * THE WHOLE POINT. An add-on that names no company declares an EMPTY list,
     * and that costs nothing downstream — there is no word to look for. An
     * add-on that declares NOTHING looks identical from the outside, and is the
     * state a renamed export or a dropped sync leaves a host in: allowing no
     * origin, looking for no needle, knowing no mark, with every gate green.
     */
    expect(factsFrom({ './vendor/b/add-on-facts.ts': QUIET }).silent).toEqual([]);
    expect(factsFrom({ './vendor/c/add-on-facts.ts': {} }).silent).toEqual([
      {
        source: './vendor/c/add-on-facts.ts',
        missing: ['INERT_ORIGINS', 'NEVER_IN_A_BROWSER', 'COMPANY_MARKS'],
      },
    ]);
    // …and one renamed export is reported by name rather than as a whole file.
    const { COMPANY_MARKS: _dropped, ...renamed } = CARRIER;
    expect(factsFrom({ './vendor/a/add-on-facts.ts': renamed }).silent).toEqual([
      { source: './vendor/a/add-on-facts.ts', missing: ['COMPANY_MARKS'] },
    ]);
  });

  it('reports a discovery that found nothing as exactly that', () => {
    // The failure `factsGuard` fails on, and the reason its first case exists.
    const nothing = factsFrom({});
    expect(nothing.sources).toEqual([]);
    expect(nothing.origins).toEqual([]);
    expect(nothing.marks).toEqual([]);
  });
});

describe('the glob in this package’s own checkout', () => {
  it('matches nothing, and returns an object rather than throwing', () => {
    /*
     * Recorded rather than assumed. The path is fixed by `INSTALL_LAYOUT` and
     * is correct once installed; here it points at a directory that does not
     * exist, and Vite answers with `{}`. A future bundler that threw instead
     * would break every host's guard suite at import time, and this is the case
     * that would say so first.
     */
    expect(typeof VENDORED_FACTS).toBe('object');
    expect(Object.keys(VENDORED_FACTS)).toEqual([]);
  });
});
