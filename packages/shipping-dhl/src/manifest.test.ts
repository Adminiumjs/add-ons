/**
 * The manifest, checked against the rules it would be validated by on install.
 *
 * `@adminium/manifest` is not on npm, so this repo cannot import the real
 * `addOnManifestSchema` and run it. What it CAN do is assert the handful of
 * rules whose violation would be caught late and expensively — an egress
 * wildcard, a secret in `publicSettings`, a slot id that is not in the closed
 * registry — each of which has an issue code in 24 §5.3 and none of which is
 * visible by reading the JSON in a hurry.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import manifest from "../manifest.json" with { type: "json" };
import { OUTPUT } from "../vite.config.ts";
import { WIRE } from "./carrier.ts";
import { buildForReal, ROOT } from "./testing/build.ts";
import { DEFAULT_SETTINGS } from "./settings.ts";
import { FILLED_SLOTS } from "./slots.ts";

import { INERT_ORIGINS, NEVER_IN_A_BROWSER } from "./add-on-facts.ts";

/** The closed slot registry of 24 §5.4 — never invent an id. */
const SLOT_IDS = new Set([
  "artwork.sources",
  "checkout.delivery.methods",
  "order.dispatch.panel",
  "order.dispatch.actions",
  "settings.add-on.panel",
  "nav.add-on.routes",
  "product.options.personalize",
  "cart.line.preview",
  "product.admin.panel",
  "order.line.actions",
  "record.editor.panel",
]);

const CONTRACT_IDS = new Set(["artwork-source", "shipping-carrier", "product-personalizer"]);
const ADD_ON_CATEGORIES = new Set(["artwork", "delivery", "payments", "email", "data"]);

describe("the manifest", () => {
  it("is an add-on, not an app", () => {
    expect(manifest.kind).toBe("add-on");
    expect(manifest.manifestVersion).toBe(1);
    // An add-on cannot install pages, roles or a frontend — those are app
    // powers, and the schema enforces it by leaving the fields off entirely.
    expect(manifest).not.toHaveProperty("pages");
    expect(manifest).not.toHaveProperty("frontend");
    expect(manifest).not.toHaveProperty("roles");
  });

  it("is first-party, because an unsandboxed in-process add-on has to be (D13)", () => {
    expect(manifest.publisher.id).toBe("adminium");
  });

  it("uses the add-on category vocabulary rather than the app facet set (D2)", () => {
    expect(manifest.categories).toEqual(["delivery"]);
    for (const category of manifest.categories) expect(ADD_ON_CATEGORIES.has(category)).toBe(true);
  });

  it("fills four slots from the closed registry, all at order 10", () => {
    const slots = manifest.addOn.slots.map((s) => s.slot);
    expect(slots).toEqual([
      "order.dispatch.actions",
      "checkout.delivery.methods",
      "order.dispatch.panel",
      "settings.add-on.panel",
    ]);
    for (const fill of manifest.addOn.slots) {
      expect(SLOT_IDS.has(fill.slot), `SLOT_UNKNOWN: ${fill.slot}`).toBe(true);
      expect(fill.order).toBe(10);
    }
    // …and the compile-time narrowing agrees. `FILLED_SLOTS` is
    // `satisfies readonly SlotId[]` against the ONE shared mirror of the host's
    // registry, so a slot the host stops hosting is a red build here rather
    // than a fill that silently never renders.
    expect([...slots].sort()).toEqual([...FILLED_SLOTS].sort());
  });

  it("provides the carrier contract at the version the registry holds", () => {
    expect(manifest.addOn.provides).toHaveLength(1);
    const provided = manifest.addOn.provides[0]!;
    expect(CONTRACT_IDS.has(provided.contract)).toBe(true);
    expect(provided.contract).toBe("shipping-carrier");
    expect(provided.version).toBe(1);
  });

  it("declares an egress allow-list that is one exact https hostname (D14)", () => {
    const allow = manifest.addOn.network.allow;
    expect(allow).toHaveLength(1);
    for (const host of allow) {
      // NETWORK_ALLOW_REQUIRED, and the three shapes that make an allow-list
      // useless: a wildcard, a scheme, a bare address.
      expect(host).not.toContain("*");
      expect(host).not.toContain("/");
      expect(host).not.toMatch(/^\d+\./);
      expect(host).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/);
    }
    // The one hostname the transport targets and the one the host will bind
    // its client to have to be the same string, or every call is refused.
    expect(allow[0]).toBe(WIRE.host);
  });

  it("declares outbound-http, which is what makes the allow-list mandatory", () => {
    expect(manifest.capabilities).toContain("outbound-http");
    expect(manifest.capabilities).toContain("file-storage");
    expect(manifest.addOn.network.allow.length).toBeGreaterThan(0);
  });

  it("never exposes a secret setting to the client (FRONTEND_SECRET_LEAK, D15)", () => {
    const secrets = manifest.settings.filter((s) => s.secret === true).map((s) => s.key);
    expect(secrets).toEqual(["api_key", "account_number"]);
    for (const key of manifest.addOn.publicSettings) {
      expect(secrets, `publicSettings leaks ${key}`).not.toContain(key);
    }
    expect(manifest.addOn.publicSettings).toEqual(["demo_transport", "collection_cutoff"]);
  });

  it("ships a demo transport, and defaults to it (D11)", () => {
    expect(manifest.addOn.demoTransport).toBeTruthy();
    const demo = manifest.settings.find((s) => s.key === "demo_transport")!;
    expect(demo.default).toBe(true);
    expect(DEFAULT_SETTINGS.demo_transport).toBe(true);
  });

  it("keeps the cut-off in step with the code's default", () => {
    const cutoff = manifest.settings.find((s) => s.key === "collection_cutoff")!;
    // The manifest setting vocabulary has no `time` type, so a cut-off is a
    // string; the shape is enforced by `parseTime`, not by the schema.
    expect(cutoff.type).toBe("string");
    expect(cutoff.default).toBe(DEFAULT_SETTINGS.collection_cutoff);
  });

  /**
   * ── ASKING FOR A TABLE IT NEVER READS, IN A WORD ONLY ONE HOST KNOWS ──────
   *
   * [Amended 2026-08-11, wave 4b round 4.] The list used to open with
   * `records:jobs:read`. Three things were wrong with it at once, and the third
   * is the one that had consequences:
   *
   *   1. Nothing in this package reads a job. `shipping-carrier@1` takes a
   *      parcel, two addresses and an `OrderRef` — the host's own reference
   *      string — and has no operation that takes a record id.
   *   2. `jobs` is the PRINT WORKS' word. The maker studio's equivalent record
   *      is an `order`, and a scope naming one host's table is a scope that
   *      cannot be granted in the other.
   *   3. So the manifest could not claim the second host. Adding
   *      `{ app: "maker" }` and running the product's own validator returned
   *      SCOPE_OUT_OF_RANGE — for a permission this add-on did not want. The
   *      cross-app claim of 24 D21 was demonstrated in the running app and
   *      contradicted by the artefact that describes it.
   *
   * A scope is a request for power. The honest length of the list is the length
   * that matches what the code does, which is its own two.
   */
  it("asks only for the scopes it uses, and names no host's own table", () => {
    expect(manifest.addOn.scopes).toEqual(["records:shipments:write", "files:write"]);

    const own = new Set(manifest.requiredSchema.tables.map((t) => t.ref));
    for (const scope of manifest.addOn.scopes) {
      const [domain, table] = scope.split(":");
      if (domain !== "records") continue;
      expect(
        own.has(table!),
        `${scope} names "${table}", which is a HOST's table — this add-on attaches to ` +
          `${manifest.addOn.attaches.map((a) => a.app).join(" and ")} and cannot assume both ` +
          "spell it the same way",
      ).toBe(true);
    }
  });

  it("brings the two tables the works keeps after a disconnect (D16)", () => {
    const tables = manifest.requiredSchema.tables.map((t) => t.ref);
    expect(tables).toEqual(["shipments", "shipment_events"]);
    const shipments = manifest.requiredSchema.tables[0]!;
    /*
     * `order_reference`, TEXT, and not `job_id` as an fk into `jobs`. A foreign
     * key into a host's table is a column that only installs in hosts that have
     * that table under that name — half of this add-on's two. What actually
     * crosses the seam is `OrderRef.reference`, a string the host mints and the
     * label is printed with, so that is what the shipment keeps.
     */
    expect(shipments.columns.map((c) => c.ref)).toEqual([
      "id",
      "order_reference",
      "carrier",
      "service",
      "tracking",
      "label_file",
      "amount",
      "currency",
      "collection_from",
      "collection_to",
      "status",
      "created_at",
    ]);
    // Every fk names its target, or the installer cannot map it.
    for (const table of manifest.requiredSchema.tables) {
      for (const column of table.columns) {
        if (column.type === "fk") expect(column).toHaveProperty("references");
        if (column.type === "enum") expect((column as { enum?: string[] }).enum?.length).toBeTruthy();
      }
    }
  });

  /**
   * THE CROSS-APP CLAIM, IN THE ARTEFACT AND NOT ONLY IN THE DEMO (24 AC20, D21).
   *
   * This add-on has been vendored, registered and demonstrably working in the
   * maker studio since wave 4b, and the manifest went on naming one app. An
   * installer reads the manifest, not the demo: `attaches` was the one place
   * where "it runs in both shops" was checkable, and it said otherwise.
   *
   * Neither entry is `"*"`. `"*"` claims every app that will ever exist, and
   * `packages/host/src/manifest-schema.test.ts` can only check the hosts that
   * are checked out — so a `"*"` here would be an unfalsifiable claim replacing
   * a false one.
   */
  it("attaches to both hosts that mount its slots, and to no app it has not been run in", () => {
    expect(manifest.addOn.attaches).toEqual([
      { app: "printing", range: "^1.0.0" },
      { app: "maker", range: "^1.0.0" },
    ]);
  });
});

/**
 * THE MANIFEST AND THE BUILD HAVE TO NAME THE SAME FILES.
 *
 * Every path in the `addOn` block is a module the installer loads. They used to
 * be `client/dispatch.js`, `server/carrier.js` and four more like them — a
 * plausible-looking layout that no build has ever produced, so the manifest
 * validated cleanly and the add-on would have failed at load with a missing
 * module. `vite.config.ts` exports the two filenames it actually writes, this
 * suite asserts the manifest uses exactly those, and `dist.test.ts` asserts the
 * build really put them on disk. Three links, no gap for a guess.
 *
 * THE CONVENTION, STATED ONCE (24 AC10). Every path in the `addOn` block is
 * RELATIVE TO THE REPOSITORY ROOT — the directory a host clones, and the
 * directory `manifest.json` itself sits in. So `dist/client.js` means the file
 * beside the manifest, and nothing downstream has to know what the build's
 * `outDir` is called or which half of the tree a given entry belongs to. The
 * three wave-4 add-ons declared this three different ways; package-root-relative
 * is the one that resolves with no context at all, and all three now use it.
 */
describe("the manifest's entry points are the files the build writes", () => {
  const clientPaths = manifest.addOn.slots.map((s) => s.client);
  const serverPaths = [
    ...manifest.addOn.provides.map((p) => p.server),
    manifest.addOn.demoTransport,
  ];
  const declared = [...clientPaths, ...serverPaths];

  // Built only if there is not a build already: `dist.test.ts` has usually run
  // by now and left a fresh one, and `fileParallelism: false` keeps the two
  // from ever running `vite build` against the same `dist/` at once.
  beforeAll(() => {
    if (declared.every((path) => existsSync(join(ROOT, path)))) return;
    buildForReal();
  }, 180_000);

  it("resolves every declared path from the package root, onto a file that exists", () => {
    // The assertion AC10 asks for, made against the manifest's own strings
    // rather than against `OUTPUT`: a declared entry point that is not on disk
    // is an add-on that validates, installs, and then fails to load.
    for (const path of declared) {
      expect(path.startsWith("/"), `${path} is absolute, not package-root-relative`).toBe(
        false,
      );
      expect(path.includes("\\"), `${path} is not a POSIX path`).toBe(false);
      expect(existsSync(join(ROOT, path)), `${path} does not exist in the build output`).toBe(true);
    }
  });

  it("sends every slot to the client bundle", () => {
    expect(clientPaths).toHaveLength(4);
    for (const path of clientPaths) expect(path).toBe(OUTPUT.client);
  });

  it("sends the contract and the demo transport to the server bundle", () => {
    // The demo transport holds no credential and is exported from both halves,
    // but the manifest names SERVER modules here: what the host loads outside
    // the browser is the server build.
    for (const path of serverPaths) expect(path).toBe(OUTPUT.server);
  });

  it("names only built output, never a hand-invented layout", () => {
    for (const path of [...clientPaths, ...serverPaths]) {
      expect(path.startsWith("dist/"), `${path} is not in the build output`).toBe(true);
      expect(Object.values(OUTPUT) as string[]).toContain(path);
    }
  });

  it("keeps the client half out of every server entry, and the reverse", () => {
    // A single bundle serving both halves would put the credential-reading
    // transport in a page (D15), which is the whole reason there are two.
    expect(OUTPUT.client).not.toBe(OUTPUT.server);
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
describe("the facts this add-on hands its hosts cover what it declares", () => {
  it("accounts for every secret setting key and every allowed hostname", () => {
    const needles = new Set(NEVER_IN_A_BROWSER.map((n) => n.text));
    const inert = new Set(INERT_ORIGINS.map((o) => o.origin.replace(/^[a-z]+:\/\//, "")));
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
      "manifest.json declares these `secret: true` and add-on-facts.ts does not name them, " +
        "so no host would grep its bundle for them: " + unnamed.join(", "),
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
      "manifest.json allows calls to these and add-on-facts.ts says nothing about them: " +
        unaccounted.join(", "),
    ).toEqual([]);
    const both = hosts.filter((host) => needles.has(host) && inert.has(host));
    expect(
      both,
      "declared inert AND banned from a browser; a host reading both would be told " +
        "two things: " + both.join(", "),
    ).toEqual([]);
  });

  it("says why, for every needle and every inert origin", () => {
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
