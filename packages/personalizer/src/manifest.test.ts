/**
 * This add-on's OWN invariants about its manifest — what only a reader of this
 * package could know is right.
 *
 * ── WHAT THIS FILE IS NO LONGER ALLOWED TO BE ───────────────────────────────
 *
 * It used to open by saying it checked "the rules 24 §5.3 names by issue code
 * rather than by importing `@adminium/manifest`", because "this repo cannot
 * reach it". Restating a schema is a copy, and this copy was wrong in three
 * places at once — and worse than wrong, it had written two of them down as
 * expectations. `attaches` was asserted to EQUAL an array the real validator
 * rejects, so the greener this suite ran the further the manifest was from
 * shipping. `packages/host/src/manifest-schema.test.ts` now runs the actual
 * validator over every manifest in this repo, from a sibling checkout of the
 * product; that file carries the reasoning and the standing proposal to publish
 * the package so the path lookup can go away.
 *
 * What is left here is the half a schema cannot check: that the manifest and
 * the CODE agree. It declares no egress because it makes no call, its settings
 * keys are the ones its own fills read, its entry points are files the build
 * actually emits, and — the one that would otherwise look like an oversight —
 * the SEVENTH slot it declares has no fill in the bundle on purpose.
 */

import { describe, expect, it } from 'vitest';

import manifest from '../manifest.json';
import { FACE_IDS } from './faces.ts';
import { personalizerStrings } from './i18n/strings.ts';
import { register } from './index.ts';
import { DECLARED_SLOTS, FILLED_SLOTS, PHASE_B_SLOTS } from './slots.ts';
import { emittedFiles } from './testing/dist.ts';

import { INERT_ORIGINS, NEVER_IN_A_BROWSER } from './add-on-facts.ts';

interface ManifestSetting {
  key: string;
  type: string;
  secret?: boolean;
  default?: unknown;
}

describe('manifest.json', () => {
  const addOn = manifest.addOn;
  const settings = manifest.settings as unknown as ManifestSetting[];

  it('is an add-on, not an app', () => {
    expect(manifest.kind).toBe('add-on');
    expect(manifest.manifestVersion).toBe(1);
    // §5.7 item 6: an add-on cannot install pages, roles or a frontend, and the
    // strongest way to say so is for the fields not to exist.
    expect(manifest).not.toHaveProperty('pages');
    expect(manifest).not.toHaveProperty('roles');
    expect(manifest).not.toHaveProperty('frontend');
  });

  it('is first-party, which is the only publisher v1 accepts (D13)', () => {
    expect(manifest.publisher.id).toBe('adminium');
  });

  it('takes a category from the add-on vocabulary, not the app facet set (D2a)', () => {
    expect(manifest.categories).toEqual(['artwork']);
  });

  /**
   * ONE APP AND TWO TABLES, which is what makes this the add-on D20 is about.
   * The app is the host that mounts the slots; the tables are the generated
   * dashboard's own, and they are what `record.editor.panel` mounts against —
   * the first add-on surface that lives in the product rather than in an
   * example app. (It named two apps once. The second block below is why it
   * does not.)
   *
   * ── `app: "*"` ON THE TWO TABLE TARGETS, AND WHY THE MANIFEST MOVED ────────
   *
   * 24 §8B writes these two as bare `{ table: "products" }`, and that is the
   * side that was wrong. `attachTargetSchema` REQUIRES `app`, and it is not an
   * oversight in the schema: `"*"` is the value it provides for a target that
   * is not host-specific, `table` is documented there as the qualifier for
   * `record.editor.panel`, and a dashboard mount is precisely "not tied to an
   * app" — which is the whole of D20's argument, that the thing a shop buys is
   * not tied to a shop. So the honest reading needed no schema change at all,
   * and that matters: `manifestVersion: 1` is FROZEN, and relaxing `app` to
   * optional would have removed a guarantee from every shipped manifest to
   * spare this one four characters.
   *
   * The rule was invisible here because this suite restated it by hand and
   * restated it wrong — see the header. The real validator is what says so now.
   */
  /**
   * ── THE APP IT CLAIMED AND COULD NOT DRAW IN ────────────────────────────
   *
   * [Amended 2026-08-11, wave 4b round 4.] `attaches` used to name `printing`
   * as well, on the strength of a sentence in the plan: "both host the slots;
   * the contract is app-neutral". The contract is app-neutral. The print works
   * does not host the slots. Its `HOSTED_SLOTS` are `artwork.sources`,
   * `checkout.delivery.methods`, `order.dispatch.panel`,
   * `order.dispatch.actions` and `settings.add-on.panel`; this add-on fills
   * `product.options.personalize`, `cart.line.preview`, `product.admin.panel`,
   * `order.line.actions`, `nav.add-on.routes` and `settings.add-on.panel`. The
   * intersection is the settings panel and nothing else — so installing it into
   * the print works gives a shop a form for configuring a feature that has
   * nowhere to happen. It was checked: registered in a scratch print-shop it
   * runs cleanly and draws its settings form and no personalization anywhere.
   *
   * That is not "a slot fill that quietly does not render", which D21 allows
   * and this repo relies on. It is a promise to an INSTALLER that the installer
   * cannot keep. The claim is dropped rather than papered over, because the
   * alternative — making a print works host a shopper-facing personalization
   * surface — is inventing a shop model the print works has not got, in order
   * to make a line in a JSON file true.
   *
   * `emptyAttachClaims` in `packages/host/src/manifest-schema.test.ts` is the
   * gate that makes this a rule instead of a ruling — and it is deliberately
   * blind to `settings.add-on.panel`, because that slot alone is what the
   * intersection here came to.
   */
  it('attaches to the host that mounts its slots, AND to the dashboard tables (D20)', () => {
    expect(addOn.attaches).toEqual([
      { app: 'maker', range: '^1.0.0' },
      { app: '*', table: 'products' },
      { app: '*', table: 'order_lines' },
    ]);
    // The dashboard targets name a table and no version range, because a table
    // has no version; the app targets name a range and no table, because a slot
    // in an app is not mounted on a record.
    for (const target of addOn.attaches) {
      expect('table' in target ? target.app : '*').toBe('*');
    }
  });

  it('fills only slots in the closed registry (SLOT_UNKNOWN)', () => {
    const declared = addOn.slots.map((slot) => slot.slot).sort();
    expect(declared).toEqual([...DECLARED_SLOTS].sort());
    expect(declared).toHaveLength(7);
  });

  /**
   * THE PHASE B SPLIT, ASSERTED BY NAME RATHER THAN LEFT TO LOOK LIKE A BUG.
   *
   * Six of the seven are rendered by `register()`. The seventh,
   * `record.editor.panel`, is declared and deliberately unmounted: its host is
   * Adminium's generated dashboard and it needs the add-on runtime that
   * `POST /manifests` does not yet provide (§5.10). Shipping a fill nothing can
   * mount is the exact defect §5.4 records against `nav.add-on.routes`, so the
   * manifest declares the attachment and the bundle ships nothing — and this
   * suite is where that difference is written down.
   */
  it('renders six of its seven slots, and names the seventh as Phase B', () => {
    const rendered = register()
      .fills.map((fill) => fill.slot)
      .sort();
    expect(rendered).toEqual([...FILLED_SLOTS].sort());
    const declared = addOn.slots.map((slot) => slot.slot);
    const unmounted = declared.filter((slot) => !rendered.includes(slot as never));
    expect(unmounted).toEqual([...PHASE_B_SLOTS]);
  });

  it('provides product-personalizer at the version the registry carries (CONTRACT_UNKNOWN)', () => {
    expect(addOn.provides).toHaveLength(1);
    expect(addOn.provides[0]!.contract).toBe('product-personalizer');
    expect(addOn.provides[0]!.version).toBe(1);
  });

  it('names entry points in the wave’s one convention (§5.7 item 2)', () => {
    for (const fill of addOn.slots) expect(fill.client).toBe('dist/client.js');
    expect(addOn.provides[0]!.server).toBe('dist/server.js');
    for (const path of [...addOn.slots.map((f) => f.client), addOn.provides[0]!.server]) {
      expect(path, `${path} is not written relative to the package root`).toMatch(/^dist\//);
    }
  });

  it('names entry points the build actually emits', () => {
    const emitted = emittedFiles();
    for (const fill of addOn.slots) {
      expect(emitted, `slot ${fill.slot} points at a file the build never wrote`).toContain(
        fill.client,
      );
    }
    for (const provided of addOn.provides) {
      expect(
        emitted,
        `contract ${provided.contract} points at a file the build never wrote`,
      ).toContain(provided.server);
    }
  });

  /**
   * A SCOPE IS A QUERY IT MAKES, NOT A SURFACE IT MOUNTS ON — and the
   * difference is what stopped this add-on installing in one of the two apps
   * it says it runs in.
   *
   * It used to ask for `records:order_lines:read` as well, on the reasoning
   * that "the tables it attaches to are exactly the tables it asks to read".
   * That reasoning is wrong twice over.
   *
   *   IT IS UNTRUE OF THE CODE. Nothing in this package queries an order-line
   *   table. `cart.line.preview` and `order.line.actions` are handed the line
   *   in their payload by the host; `record.editor.panel` is handed the record
   *   by the editor it is mounted inside. The only rows this add-on goes
   *   LOOKING for are its own two tables and the shop's products, which the
   *   Setup route lists so a maker can pick one to draw areas on.
   *
   *   IT WAS UNINSTALLABLE. SCOPE_OUT_OF_RANGE bounds a `records:` scope by
   *   the tables the HOST APP declares plus the add-on's own. `maker` has an
   *   `order_lines` table; `printing` does not — its line is a `job` — so the
   *   real validator rejected this manifest for `printing`, which `attaches`
   *   named at the time. An add-on that declares it runs in two apps and
   *   cannot install in one of them is a broken add-on, and the manifest
   *   gate could not see it because it validated the manifest alone.
   *   `packages/host/src/manifest-schema.test.ts` now runs each manifest
   *   against every host it claims to attach to.
   *
   * `products` stays because this add-on really does read it — and it stayed
   * correct through the SECOND repair above, where the `printing` attach was
   * dropped for a different reason entirely: `maker` has `products` too. The
   * `{ app: "*", table: "order_lines" }` attach target stays as well: it is
   * where a panel MOUNTS in the generated dashboard, which asks nothing of the
   * host app's schema.
   */
  it('asks only for what it queries, in tables every host it attaches to has', () => {
    expect(addOn.scopes).toEqual(['records:products:read', 'files:write']);
    // Read-only on the host's records: this add-on adds a picture and a machine
    // file, it never edits the piece or the order it was made for.
    expect(addOn.scopes.some((s) => s.startsWith('records:') && s.endsWith(':write'))).toBe(false);
    // Its own tables are its own; a scope on them would be asking itself.
    const mine = new Set(manifest.requiredSchema.tables.map((table) => table.ref));
    for (const scope of addOn.scopes) {
      const [domain, table] = scope.split(':');
      if (domain !== 'records') continue;
      expect(mine.has(table!), `${scope} names this add-on's own table`).toBe(false);
    }
  });

  it('declares NO egress, because it calls nothing (D14)', () => {
    expect(addOn).not.toHaveProperty('network');
    expect(manifest.capabilities).not.toContain('outbound-http');
    // No third party means no demo transport to seed: there is nothing to
    // simulate when there is nothing to call (D11).
    expect(addOn).not.toHaveProperty('demoTransport');
  });

  it('connects with one click and no account (§5.6, D3a)', () => {
    expect(addOn.connect).toEqual({ kind: 'none' });
    expect(manifest.capabilities).toEqual(['file-storage']);
    expect(register().connect).toBe('none');
  });

  it('exposes only non-secret settings to the client (FRONTEND_SECRET_LEAK)', () => {
    expect(settings.filter((setting) => setting.secret === true)).toEqual([]);
    expect(addOn.publicSettings).toEqual(settings.map((setting) => setting.key));
    expect(register().settings.map((setting) => setting.key)).toEqual(addOn.publicSettings);
  });

  it('brings the two tables 8B names, with the columns the engine writes', () => {
    expect(manifest.requiredSchema.tables.map((table) => table.ref)).toEqual([
      'personalization_templates',
      'personalizations',
    ]);
    expect(manifest.requiredSchema.tables[0]!.columns.map((c) => c.ref)).toEqual([
      'id',
      'product_id',
      'angles',
      'zones',
      'created_at',
      'updated_at',
    ]);
    expect(manifest.requiredSchema.tables[1]!.columns.map((c) => c.ref)).toEqual([
      'id',
      'order_line_id',
      'template_id',
      'values',
      'preview_file',
      'production_file',
      'created_at',
    ]);
  });

  it('offers every alphabet the laser cuts by default', () => {
    const fonts = settings.find((setting) => setting.key === 'offered_fonts')!;
    expect(fonts.default).toEqual([...FACE_IDS]);
    expect(register().defaultSettings?.offered_fonts).toEqual([...FACE_IDS]);
  });

  it('keeps the picture-before-cutting promise on by default', () => {
    expect(settings.find((setting) => setting.key === 'proof_required')!.default).toBe(true);
    expect(register().proofsArtwork?.({})).toBe(true);
    expect(register().proofsArtwork?.({ proof_required: false })).toBe(false);
  });

  /**
   * AC6, in the shape this add-on can honestly satisfy: it names no company, so
   * it has no relationship to disclaim, and rendering nothing where the
   * disclaimer goes would leave a reader unable to tell "connects to nobody"
   * from "somebody forgot".
   */
  it('states what it connects to in place of a disclaimer it cannot make (AC6)', () => {
    const registered = register();
    expect(registered.namesCompany).toBe(false);
    expect(registered.noCompanyKeys).toEqual([
      'addon.personalizer.noCompany',
      'addon.personalizer.noAccount',
    ]);
    for (const key of registered.noCompanyKeys ?? []) {
      expect(key.startsWith('addon.personalizer.')).toBe(true);
      expect(personalizerStrings['en-US']).toHaveProperty(key);
    }
  });

  it('namespaces every key it registers, so it can shadow nothing', () => {
    for (const key of Object.keys(personalizerStrings['en-US'])) {
      expect(key.startsWith('addon.personalizer.'), key).toBe(true);
    }
  });

  it('agrees with the registration object on key, name and category', () => {
    const registered = register();
    expect(registered.key).toBe(manifest.key);
    expect(registered.name).toBe(manifest.name);
    expect(registered.category).toBe(manifest.categories[0]);
    expect(registered.lineKey).toBe(manifest.description.key);
  });
});

/**
 * WHAT THIS ADD-ON TELLS ITS HOSTS TO GREP FOR, CHECKED AGAINST WHAT IT
 * DECLARES.
 *
 * `add-on-facts.ts` carries `NEVER_IN_A_BROWSER` — the strings a host's D15
 * bundle gate looks for in every emitted file — and it exists because that list
 * used to be written out inside each HOST. A host cannot look for a needle
 * nobody told it about, so a credentialled add-on vendored into a shop that had
 * never heard of it shipped its secret setting keys with the gate fully green.
 *
 * Moving the list is only half a repair: a hand-kept list beside a manifest
 * drifts from the manifest. This is the other half. Everything the manifest
 * already STATES about what is server-only — every `secret: true` setting key,
 * every `network.allow` hostname — has to be in the declaration, and this is
 * the one repo that holds both files and can say so.
 */
describe('the facts this add-on hands its hosts cover what it declares', () => {
  it('accounts for every secret setting key and every allowed hostname', () => {
    const needles = new Set(NEVER_IN_A_BROWSER.map((n) => n.text));
    const inert = new Set(INERT_ORIGINS.map((o) => o.origin.replace(/^[a-z]+:\/\//, '')));
    /*
     * Read through one cast: each package's `manifest.json` is typed by
     * inference from its own contents, so a package with no `settings` block
     * has no such property to reach for and `tsc` says so. The QUESTION is the
     * same for all four — what does this manifest declare as server-only — and
     * the answer for a manifest that declares none of it is the empty list.
     */
    const spec = manifest as unknown as {
      settings?: { key: string; secret?: boolean }[];
      addOn?: { network?: { allow?: string[] } };
    };
    /*
     * A SECRET KEY IS ALWAYS A NEEDLE. The name a credential would be SAVED
     * under has no reading in which a browser should carry it.
     */
    const secrets = (spec.settings ?? [])
      .filter((setting) => setting.secret === true)
      .map((setting) => setting.key);
    const unnamed = secrets.filter((key) => !needles.has(key));
    expect(
      unnamed,
      'manifest.json declares these `secret: true` and add-on-facts.ts does not name them, ' +
        'so no host would grep its bundle for them: ' + unnamed.join(', '),
    ).toEqual([]);

    /*
     * A HOSTNAME IS ONE OR THE OTHER, AND THE ADD-ON HAS TO SAY WHICH.
     *
     * An allow-listed host is somewhere a SERVER half may call. Whether the
     * CLIENT half may name it is a separate question with two honest answers —
     * banned outright, or written down as an inert constant with a reason — and
     * the hosts' old lists gave both answers about the same hostname at once.
     * So: accounted for, exactly once.
     */
    const hosts = spec.addOn?.network?.allow ?? [];
    const unaccounted = hosts.filter((host) => !needles.has(host) && !inert.has(host));
    expect(
      unaccounted,
      'manifest.json allows calls to these and add-on-facts.ts says nothing about them: ' +
        unaccounted.join(', '),
    ).toEqual([]);
    const both = hosts.filter((host) => needles.has(host) && inert.has(host));
    expect(
      both,
      'declared inert AND banned from a browser; a host reading both would be told ' +
        'two things: ' + both.join(', '),
    ).toEqual([]);
  });

  it('says why, for every needle and every inert origin', () => {
    for (const entry of NEVER_IN_A_BROWSER) {
      expect({ text: entry.text, explained: entry.why.length > 30 }).toEqual({
        text: entry.text,
        explained: true,
      });
    }
    for (const entry of INERT_ORIGINS) {
      expect({ origin: entry.origin, explained: entry.why.length > 30 }).toEqual({
        origin: entry.origin,
        explained: true,
      });
    }
  });
});
