/**
 * The block vocabulary, and what this renderer does with it.
 *
 * `scripts/check-invoice-block-vocab.mjs` in the Adminium repo holds the JSON
 * byte-equal across the three trees. This suite is the other half: it holds
 * THIS tree's claims about that JSON honest, so the vendored file cannot
 * silently stop describing what the renderer does.
 */

import { describe, expect, it } from 'vitest';

import vocabulary from './block-vocabulary.json' with { type: 'json' };
import { DRAWN, NOT_YET_DRAWN } from './render/drawn.ts';

describe('the vendored block vocabulary', () => {
  it('is the twenty-seven kinds the editor offers', () => {
    expect(vocabulary.adminium.kind).toBe('invoice-block-vocabulary');
    expect(vocabulary.kinds).toHaveLength(27);
  });

  it('is accounted for exactly once, either drawn or listed as not drawn', () => {
    /*
     * The assertion that makes the gap a fact rather than a discovery. A kind
     * added to the vocabulary upstream lands in NEITHER list and turns this
     * red — which is the point: somebody has to decide whether the renderer
     * draws it, and say so, rather than it quietly going missing from every
     * PDF.
     */
    expect([...DRAWN, ...NOT_YET_DRAWN].sort()).toEqual([...vocabulary.kinds].sort());
    expect(new Set([...DRAWN, ...NOT_YET_DRAWN]).size).toBe(vocabulary.kinds.length);
  });

  it('draws nine and openly does not draw eighteen', () => {
    // Spelled out so the ratio is in the test output rather than in a comment
    // somebody has to go and read.
    expect(DRAWN).toHaveLength(9);
    expect(NOT_YET_DRAWN).toHaveLength(18);
  });

  it('draws every block a starter needs on the day it is made', () => {
    // The claim `drawn.ts` makes in words, made checkable: a document with no
    // optional section switched on is drawn in full.
    for (const essential of ['meta', 'parties', 'items', 'totals', 'terms']) {
      expect(DRAWN, essential).toContain(essential);
    }
  });

  it('does not claim to draw any of the four custom types', () => {
    // They are user-authored shapes with no fixed fields, and drawing them is
    // the largest single piece of the remaining work.
    for (const custom of vocabulary.kinds.filter((kind) => kind.startsWith('custom.'))) {
      expect(NOT_YET_DRAWN, custom).toContain(custom);
    }
  });
});
