/**
 * EVERY FACTORY, RUN — against one clean host, in this package's own suite.
 *
 * @vitest-environment jsdom
 *
 * ── WHY THIS FILE IS NOT REDUNDANT WITH THE OTHER NINE ──────────────────────
 *
 * Each guard's own suite drives its pure DETECTOR: plant an offender, check it
 * is reported; hand it clean input, check it is not. That is where a guard is
 * proved to bite, and it is deliberately where most of the cases are, because a
 * factory cannot be caught failing from inside vitest — a `describe` that
 * declares failing `it`s fails the run rather than returning a value.
 *
 * What a detector suite CANNOT prove is the wiring. A factory that computed its
 * findings and then asserted something else, or read the wrong field of the
 * config, or declared no cases at all, would pass every detector test ever
 * written. That is not a hypothetical: a suite that lists its own hole is one of
 * the three shapes this wave was bitten by, and "the gate was never called" is
 * how the mount grep and the built-output scanner each went quiet.
 *
 * So every factory is CALLED here against a host built to satisfy it, and its
 * suite appears in the run output under `synthetic-host · …`. If one of them
 * stops appearing — or starts failing — the wiring is what changed. `tierGuard`
 * is called twice, against two hosts, because its two branches are two
 * different reports and only one of them can be taken per host.
 *
 * ── AND THE HOST IS BUILT TO PASS, WHICH IS THE POINT ───────────────────────
 *
 * `synthetic-host.ts` writes a small but real host: a screen that mounts a slot
 * and pairs an add-on's name with the affiliation line, a registry with the one
 * import shape `brand.ts` forgives, a vendored tree with sync headers and no
 * bare specifiers, the stylesheet rule pair, and a suite naming every guard the
 * kit ships. Every one of those files is there because a guard reads it, and
 * deleting any of them turns exactly one of the suites below red.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { brandGuard } from './brand.ts';
import { factsFrom, factsGuard, type AddOnFactsModule } from './facts.ts';
import { labelPairingRenderedGuard, labelPairingSourceGuard } from './label-pairing.ts';
import { lexiconGuard } from './lexicon.ts';
import { mountsGuard, type SlotMountRecord } from './mounts.ts';
import { payloadCastsGuard } from './payload-casts.ts';
import { stylesGuard } from './styles.ts';
import { syntheticHost } from './synthetic-host.ts';
import { tierGuard } from './tier.ts';
import { vendoredGuard } from './vendored.ts';

/**
 * A host that declares TIER 2 and has everything tier 2 asks for.
 *
 * Tier 2 rather than the builder's tier-1 default, so `tierGuard`'s stricter
 * branch is actually taken here: a DOM in the manifest, and all eleven guard
 * symbols named by a suite. Nothing else in this package exercises that path,
 * and a branch that is never taken is a branch that has never been shown to
 * work — which is this file's whole subject.
 */
const host = syntheticHost({
  tier: 2,
  hostedSlots: ['order.dispatch.actions', 'settings.add-on.panel'],
  files: {
    'package.json': JSON.stringify(
      {
        name: 'synthetic-host',
        private: true,
        dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
        devDependencies: { jsdom: '^29.1.1', typescript: '^5.7.2', vitest: '^3.2.4' },
      },
      null,
      2,
    ),
    'src/kit.test.ts': [
      'lexiconGuard(hostKit, scope);',
      'brandGuard(hostKit);',
      'labelPairingSourceGuard(hostKit);',
      'payloadCastsGuard(hostKit);',
      'factsGuard(hostKit);',
      'vendoredGuard(hostKit);',
      'deliveryClaimsGuard(hostKit, claims);',
      'recordPayloadGuard(hostKit);',
      'stylesGuard(hostKit);',
      'tierGuard(hostKit);',
      'labelPairingRenderedGuard(hostKit, fixtures);',
      'mountsGuard(hostKit, fixtures);',
      'expect(drewSomething(node)).toBe(false);',
      'const AddOnSlot = createAddOnSlot(binding);',
      '',
    ].join('\n'),
  },
});
const config = host.config;

/**
 * And a SECOND host, at tier 1, for one guard only.
 *
 * `tierGuard`'s value is the report it prints when four guards are NOT running
 * — the ratchet is aimed at a person, and the print IS the mechanism. Running
 * it only against the complete host above would leave that half of it never
 * executed. Two hosts is the cheapest way to take both branches, and the
 * appKey is what tells the two apart in the output.
 */
const lean = syntheticHost({ appKey: 'synthetic-host-tier-1' });

afterAll(() => {
  host.dispose();
  lean.dispose();
});

// ── the fixtures a real host would hand over ────────────────────────────────

/** A bundle with nothing banned in it, on either side of the 31 D4 split. */
const MESSAGES: Record<string, string> = {
  'shop.orders.title': 'Your orders',
  'addon.shipping-example.line': 'Book a collection from the shop.',
  'addon.host.dispatch.empty': 'No delivery company is connected yet.',
};

/**
 * One add-on's declarations, as a module map rather than a list.
 *
 * The glob in `facts.ts` matches nothing in this checkout — its path is fixed
 * by `INSTALL_LAYOUT` and is correct only once installed — so the factory takes
 * the same escape hatch a differently-laid-out host would. `facts.test.ts`
 * records that the real glob returns `{}` here, which is why this is a fixture
 * and not a second discovery.
 */
const FACTS: Record<string, AddOnFactsModule> = {
  '../../../add-ons/vendor/shipping-example/add-on-facts.ts': {
    INERT_ORIGINS: [
      {
        origin: 'https://api.example-carrier.test',
        why: 'named in the manifest so an installer can read it; nothing in the client half can call it',
      },
    ],
    NEVER_IN_A_BROWSER: [
      {
        text: 'api_key',
        why: 'a `secret: true` setting key — the name a credential would be SAVED under, which is the leak',
      },
    ],
    COMPANY_MARKS: [{ mark: 'ExampleCarrier', owner: 'its owner' }],
  },
};

const DISCLAIMERS = [
  'Adminium is not affiliated with this company.',
  'Adminium is not connected to this company.',
];

/** What the recording spy would have seen in a host that draws both its slots. */
let recorded: SlotMountRecord[] = [];

// ── every factory, called ───────────────────────────────────────────────────

lexiconGuard(config, { bundleFor: () => MESSAGES });
brandGuard(config);
labelPairingSourceGuard(config);
payloadCastsGuard(config);
factsGuard(config, { modules: FACTS });
vendoredGuard(config);
stylesGuard(config);
tierGuard(config);
tierGuard(lean.config);

mountsGuard(config, {
  reset: () => {
    recorded = [];
  },
  renderEverySurface: () => {
    recorded = [
      { slot: 'order.dispatch.actions', fallback: undefined },
      { slot: 'settings.add-on.panel', fallback: {} },
    ];
  },
  recorded: () => recorded,
});

labelPairingRenderedGuard(
  config,
  {
    tour: (_locale, read) => {
      /*
       * One surface, naming the mark AND carrying the line — the arrangement
       * AC6 asks for. `label-pairing.test.ts` drives the failing arrangements;
       * what this proves is that the factory reaches the tour at all, which is
       * the half a detector test cannot see.
       */
      const root = document.createElement('div');
      root.innerHTML = [
        '<h3>Book with ExampleCarrier</h3>',
        `<p>${DISCLAIMERS[0]}</p>`,
        '<div class="sx-dock"><button>ExampleCarrier Shipping</button></div>',
      ].join('');
      read({ view: 'dispatch', host: root });
    },
    disclaimers: () => DISCLAIMERS,
  },
  { facts: factsFrom(FACTS) },
);

describe('the synthetic host itself', () => {
  it('is the thing the nine suites above were run against', () => {
    /*
     * A pointer for a reader looking at the output. Nothing above returns a
     * value, so the only evidence the factories ran is that their `describe`s
     * are in the report — and this case names where to look if they are not.
     */
    expect(config.appKey).toBe('synthetic-host');
    expect(config.tier).toBe(2);
    expect(lean.config.tier).toBe(1);
    expect([...config.hostedSlots]).toEqual(['order.dispatch.actions', 'settings.add-on.panel']);
  });
});
