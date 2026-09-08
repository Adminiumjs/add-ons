/**
 * The mount rules, driven over planted disagreements.
 *
 * `mountsGuard` is all assertions and cannot be caught failing from inside
 * vitest, which is why `mountProblems` is a pure function over the config and
 * whatever the recording spy saw. Everything below plants ONE disagreement and
 * checks exactly one field comes back non-empty — a guard that reported all six
 * on any input would pass a laxer version of this suite and tell a reader
 * nothing about where to look.
 */

import { describe, expect, it } from 'vitest';

import { HOSTED_SLOTS } from '@adminium/add-on-host';

import { mountProblems, type SlotMountRecord } from './mounts.ts';
import { syntheticHost } from './synthetic-host.ts';

const recorded = (...slots: string[]): SlotMountRecord[] => slots.map((slot) => ({ slot }));

/** A host that mounts two slots and decides an empty behaviour for both. */
const twoSlots = () =>
  syntheticHost({
    hostedSlots: ['order.dispatch.actions', 'settings.add-on.panel'],
  });

describe('a host whose screens agree with its declaration', () => {
  it('has nothing to report', () => {
    const host = twoSlots();
    try {
      const problems = mountProblems(
        host.config,
        recorded('order.dispatch.actions', 'settings.add-on.panel', 'order.dispatch.actions'),
      );
      expect(problems).toEqual({
        unknownIds: [],
        isWholeRegistry: false,
        orphanBehaviours: [],
        undecidedBehaviours: [],
        neverMounted: [],
        undeclared: [],
      });
    } finally {
      host.dispose();
    }
  });
});

describe('a slot declared hosted and drawn by nothing', () => {
  it('is reported, which a grep over `slot="…"` could not do', () => {
    /*
     * THE DEFECT THAT SETTLED THIS. `nav.add-on.routes` sat in one host's
     * `HOSTED_SLOTS` for a release, an add-on shipped a fill for it, and no
     * screen ever drew it — the host had no router at all. The grep that was
     * meant to catch it could not, because a mount inside a comment is text
     * that matches.
     */
    const host = twoSlots();
    try {
      const problems = mountProblems(host.config, recorded('order.dispatch.actions'));
      expect(problems.neverMounted).toEqual(['settings.add-on.panel']);
      expect(problems.undeclared).toEqual([]);
    } finally {
      host.dispose();
    }
  });

  it('is reported when the recorder saw nothing at all, and so is that', () => {
    // "Nothing was mounted" and "nothing was looked at" are the same value, so
    // the guard asks the second question separately. This is the first.
    const host = twoSlots();
    try {
      expect(mountProblems(host.config, []).neverMounted).toHaveLength(2);
    } finally {
      host.dispose();
    }
  });
});

describe('a slot drawn and never declared', () => {
  it('is reported, because nothing decided what it shows when empty', () => {
    const host = twoSlots();
    try {
      const problems = mountProblems(
        host.config,
        recorded('order.dispatch.actions', 'settings.add-on.panel', 'cart.line.preview'),
      );
      expect(problems.undeclared).toEqual(['cart.line.preview']);
      expect(problems.neverMounted).toEqual([]);
    } finally {
      host.dispose();
    }
  });
});

describe('the empty-behaviour table', () => {
  it('reports a row for a slot the host no longer mounts', () => {
    /*
     * The half a type cannot see. `Record<S, …>` makes a MISSING row a compile
     * error; an orphan row — a decision about a screen that no longer exists —
     * compiles perfectly and reads as coverage.
     */
    const host = twoSlots();
    try {
      const stale = {
        ...host.config,
        slotEmptyBehaviour: {
          ...host.config.slotEmptyBehaviour,
          'cart.line.preview': 'speaks' as const,
        },
      };
      expect(mountProblems(stale, recorded('order.dispatch.actions', 'settings.add-on.panel'))
        .orphanBehaviours).toEqual(['cart.line.preview']);
    } finally {
      host.dispose();
    }
  });

  it('reports a slot with no decision, for a host that widened its list at run time', () => {
    const host = twoSlots();
    try {
      const undecided = {
        ...host.config,
        hostedSlots: [...host.config.hostedSlots, 'cart.line.preview'] as typeof host.config.hostedSlots,
      };
      expect(mountProblems(undecided, []).undecidedBehaviours).toEqual(['cart.line.preview']);
    } finally {
      host.dispose();
    }
  });
});

describe('the mis-import', () => {
  it('is named when a host’s list is the whole closed registry', () => {
    /*
     * `vendor/host/slots.ts` exports the REGISTRY under the same identifier a
     * host uses for its own list. Importing the wrong one silently widens every
     * slot check in this package rather than erroring anywhere.
     */
    /*
     * TAKEN FROM THE MIRROR RATHER THAN HAND-TYPED, and the hand-typed version
     * is what this replaced. A literal list here is one more silent copy of a
     * registry that grows: it went stale the first time a slot was bought
     * (`shell.overlay`, 2026-09-01) and failed as "a twelve-id list is not the
     * registry" — a true sentence about the fixture and a misleading one about
     * the guard, which was working perfectly. Nothing is lost by deriving it:
     * the assertion under test is what `isWholeRegistry` DOES with a whole
     * registry and with one id fewer, and neither branch is about which ids
     * the registry happens to hold. That question has a ratchet of its own,
     * one repo over.
     */
    const host = syntheticHost({ hostedSlots: [...HOSTED_SLOTS] });
    try {
      expect(mountProblems(host.config, []).isWholeRegistry).toBe(true);
      // …and a host with one fewer is an ordinary host, not a mis-import.
      const nearly = {
        ...host.config,
        hostedSlots: host.config.hostedSlots.slice(0, -1) as typeof host.config.hostedSlots,
      };
      expect(mountProblems(nearly, []).isWholeRegistry).toBe(false);
    } finally {
      host.dispose();
    }
  });

  it('reports an id the closed registry does not have', () => {
    const host = twoSlots();
    try {
      const invented = {
        ...host.config,
        hostedSlots: ['order.dispatch.actions', 'shop.invented.slot'] as never,
        slotEmptyBehaviour: {
          'order.dispatch.actions': 'silent',
          'shop.invented.slot': 'silent',
        } as never,
      };
      expect(mountProblems(invented, []).unknownIds).toEqual(['shop.invented.slot']);
    } finally {
      host.dispose();
    }
  });
});
