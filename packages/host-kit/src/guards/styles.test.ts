/**
 * The stylesheet check, driven — including the one-condition rule that shipped.
 *
 * Everything here is worth more than usual because NOTHING ELSE CAN SEE IT.
 * jsdom applies no stylesheet, so every DOM assertion in every host passes
 * identically whether the rule pair is present, half present or absent. This
 * suite is the only thing standing between a deleted CSS rule and a shop's own
 * content disappearing behind an add-on that painted nothing.
 */

import { afterEach, describe, expect, it } from 'vitest';

import { slotRuleBlock, slotRuleCss, slotRulePatterns } from '../styles.ts';
import { readSlotRules, withoutCssComments } from './styles.ts';
import { syntheticHost, type SyntheticHost } from './synthetic-host.ts';

let host: SyntheticHost | null = null;
afterEach(() => {
  host?.dispose();
  host = null;
});

const PREFIX = { classPrefix: 'sx' };

describe('the rule patterns', () => {
  it('match the canonical text the generator emits', () => {
    // The generator and the guard have to agree, and they are two functions in
    // two files: a host pastes one and its gate greps for the other.
    const patterns = slotRulePatterns(PREFIX);
    expect(patterns.spare.test(slotRuleCss(PREFIX))).toBe(true);
    expect(patterns.hide.test(slotRuleCss(PREFIX))).toBe(true);
  });

  it('refuse the one-condition rule, which is the defect that shipped', () => {
    /*
     * `:empty` alone is a question about child nodes and this is a question
     * about paint. A fill returning a bare `<div/>` — or a wrapper whose only
     * child is `display: none` — is not empty and drew nothing, so the rule
     * hid the host's own content on its behalf. Connecting an add-on took a
     * picture away.
     */
    const patterns = slotRulePatterns(PREFIX);
    expect(patterns.hide.test(slotRuleCss(PREFIX).replace(':not([data-drew="none"])', ''))).toBe(
      false,
    );
    expect(patterns.hide.test(slotRuleCss(PREFIX).replace(':not(:empty)', ''))).toBe(false);
  });

  it('accept the two negations in either order, which is a formatting choice', () => {
    // Both are correct CSS and a host that reordered them has changed nothing.
    // A guard that failed on it would be noise, and noise gets deleted.
    const swapped = slotRuleCss(PREFIX).replace(
      ':not(:empty):not([data-drew="none"])',
      ':not([data-drew="none"]):not(:empty)',
    );
    expect(slotRulePatterns(PREFIX).hide.test(swapped)).toBe(true);
  });

  it('follow the host’s own prefix, and no other', () => {
    // The five-places problem: four of the five places the prefix used to live
    // were test files, which go GREEN when they match nothing.
    expect(slotRulePatterns({ classPrefix: 'mp' }).hide.test(slotRuleCss({ classPrefix: 'br' }))).toBe(
      false,
    );
    expect(slotRulePatterns({ classPrefix: 'br' }).hide.test(slotRuleCss({ classPrefix: 'br' }))).toBe(
      true,
    );
  });
});

describe('CSS comments', () => {
  it('are stripped, so prose about the rule is not the rule', () => {
    /*
     * The block a host is told to paste is the pair WITH a long comment above
     * it, and that comment quotes both declarations by name. A grep over the
     * raw file would be satisfied by the comment alone — the
     * mount-inside-a-comment defect in another language.
     */
    const commentedOut = `/*\n${slotRuleCss(PREFIX)}\n*/\n`;
    const patterns = slotRulePatterns(PREFIX);
    expect(patterns.hide.test(commentedOut)).toBe(true);
    expect(patterns.hide.test(withoutCssComments(commentedOut))).toBe(false);
  });

  it('leave the generated block’s real rules behind', () => {
    // …and the block a host actually pastes still passes once stripped, which
    // is the pairing that makes the strip safe rather than merely strict.
    const stripped = withoutCssComments(slotRuleBlock(PREFIX));
    const patterns = slotRulePatterns(PREFIX);
    expect(patterns.spare.test(stripped)).toBe(true);
    expect(patterns.hide.test(stripped)).toBe(true);
  });
});

describe('over a host’s declared stylesheets', () => {
  it('finds both rules in a clean host', () => {
    host = syntheticHost();
    const readings = readSlotRules(host.config);
    expect(readings).toHaveLength(1);
    expect(readings[0]).toMatchObject({ spare: true, hide: true, missing: false });
  });

  it('reports a half-copy as half', () => {
    // The second rule is useless without the first: `display: contents` is what
    // keeps the fallback in its parent's layout.
    host = syntheticHost({
      files: {
        'src/styles/components.css':
          '.sx-slot-fill:not(:empty):not([data-drew="none"]) ~ .sx-slot-spare {\n' +
          '  display: none;\n}\n',
      },
    });
    expect(readSlotRules(host.config)[0]).toMatchObject({ spare: false, hide: true });
  });

  it('reports a stylesheet that carries neither', () => {
    host = syntheticHost({ files: { 'src/styles/components.css': '.sx-panel { padding: 8px; }\n' } });
    expect(readSlotRules(host.config)[0]).toMatchObject({ spare: false, hide: false });
  });

  it('reports a declared stylesheet that is not there at all', () => {
    // Two different findings — "the rule is wrong" and "the file moved" — and a
    // guard that conflated them would send a reader to the wrong place.
    host = syntheticHost({ files: { 'src/styles/components.css': null } });
    expect(readSlotRules(host.config)[0]).toMatchObject({ missing: true });
  });

  it('sees two copies of the pair as two carriers', () => {
    /*
     * EXACTLY ONE, which is stricter than "somewhere". Two copies of a cascade
     * rule is how one gets edited and the other does not, and the survivor is
     * whichever the browser reads last — a difference nobody can see in a diff.
     */
    host = syntheticHost({
      stylesheets: ['src/styles/components.css', 'src/styles/screens.css'],
      files: { 'src/styles/screens.css': slotRuleCss(PREFIX) },
    });
    expect(readSlotRules(host.config).filter((r) => r.spare || r.hide)).toHaveLength(2);
  });
});
