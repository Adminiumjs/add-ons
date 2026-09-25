/**
 * The manifest, checked against the rules it would be validated by on install.
 *
 * ── TWO LAYERS, AND ONLY ONE OF THEM IS WRITTEN HERE ────────────────────────
 *
 * `packages/host/src/manifest-schema.test.ts` puts THIS FILE through
 * `@adminiumjs/manifest` — the product's own validator, an ordinary
 * devDependency since 2026-08-14 — against every host app checked out beside
 * this repository. That is the layer that catches what a hand-restated schema
 * cannot, and it caught real defects in two add-ons the day it was written.
 *
 * So this suite is deliberately NOT a second copy of the schema. It asserts the
 * things the validator cannot see, each of which is a decision this package
 * made rather than a rule it obeys:
 *
 *   · that the manifest and `register()` fill the same slot, and that both
 *     agree with `slots.ts`, which is narrowed against the host's own registry;
 *   · that the paths it declares are the files the build actually writes;
 *   · that the four EMPTY declarations — no egress, no capability, no scope, no
 *     secret — are still empty, because every one of them is a claim this
 *     add-on makes in its README and none of them is enforced by a schema.
 *
 * The last of those is the interesting one. A schema is happy with an add-on
 * that grows a network allow-list; this package's whole design is that it never
 * will, and a design nothing asserts is a paragraph.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import manifest from "../manifest.json" with { type: "json" };
import { OUTPUT } from "../vite.config.ts";
import { INERT_ORIGINS, NEVER_IN_A_BROWSER } from "./add-on-facts.ts";
import { STORAGE_KEY } from "./calendar.ts";
import { register } from "./index.ts";
import { FILLED_SLOTS } from "./slots.ts";
import { buildForReal, ROOT } from "./testing/build.ts";

/**
 * The closed slot registry of 24 §5.4 — never invent an id.
 *
 * HAND-TYPED, AND IT IS THE FIFTH SILENT COPY (25 D2). It is only read as
 * `SLOT_IDS.has(fill.slot)`, so an id MISSING here fails nothing until some
 * add-on names it — and then it fails as "invented an id", which is the
 * opposite of the truth. Thirteen since 2026-09-01 (33 O1).
 *
 * The check that cannot go stale that way is one line further down: `slots.ts`
 * narrows against the host's ONE mirror with `satisfies readonly SlotId[]`, and
 * this suite asserts the manifest, `register()` and that narrowing all name the
 * same slot. This set is the belt; that is the braces.
 */
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
  "record.actions",
  "shell.overlay",
]);

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
    expect(manifest.categories).toEqual(["data"]);
    for (const category of manifest.categories) expect(ADD_ON_CATEGORIES.has(category)).toBe(true);
  });

  it("fills one slot from the closed registry, and register() fills the same one", () => {
    const slots = manifest.addOn.slots.map((fill) => fill.slot);
    expect(slots).toEqual(["settings.add-on.panel"]);
    for (const fill of manifest.addOn.slots) {
      expect(SLOT_IDS.has(fill.slot), `SLOT_UNKNOWN: ${fill.slot}`).toBe(true);
      expect(fill.order).toBe(10);
    }
    // …and both agree with the compile-time narrowing, which is `satisfies
    // readonly SlotId[]` against the ONE shared mirror of the host's registry.
    expect([...slots].sort()).toEqual([...FILLED_SLOTS].sort());
    expect(register().fills.map((fill) => fill.slot).sort()).toEqual([...FILLED_SLOTS].sort());
  });

  /**
   * ── THE FOUR EMPTY DECLARATIONS ────────────────────────────────────────────
   *
   * Each of these is a sentence in the README, and a schema would accept the
   * opposite of every one of them. They are asserted together because they are
   * one decision — this add-on carries its data and reaches nowhere — and a
   * reader coming to widen any of them should meet the whole of it at once.
   */
  it("declares no egress at all, which is stricter than an allow-list (D14)", () => {
    // NETWORK_ALLOW_REQUIRED is about an add-on that wants `outbound-http`.
    // This one does not want it: there is no block, so there is no hostname a
    // host could bind an HTTP client to, so no call can be made at all.
    expect(manifest.addOn).not.toHaveProperty("network");
    expect(manifest).not.toHaveProperty("capabilities");
    expect(manifest.compatibility.requires).toEqual([]);
  });

  it("asks for no scope, because it reads and writes no host record", () => {
    // A scope is a request for power. This add-on stores its days under its own
    // settings key and hands them over as data; the honest length of the list
    // is zero, and it also has no `requiredSchema` — it brings no table.
    expect(manifest.addOn.scopes).toEqual([]);
    expect(manifest).not.toHaveProperty("requiredSchema");
  });

  it("needs nothing to connect to, so it ships no demo transport (D11)", () => {
    // `demoTransport` exists so an add-on that WOULD make a third-party call in
    // a demo can make a fake one instead. Nothing here calls anything, so a
    // demo transport would be a module standing in for nothing.
    expect(manifest.addOn.connect).toEqual({ kind: "none" });
    expect(manifest.addOn).not.toHaveProperty("demoTransport");
    expect(manifest.addOn.provides).toEqual([]);
    expect(manifest.addOn.consumes).toEqual([]);
    expect(register().connect).toBe("none");
    expect(register().demoSwitch).toBeUndefined();
  });

  it("marks no setting secret, so there is nothing to keep out of a browser (D15)", () => {
    const secrets = manifest.settings.filter(
      (setting) => (setting as { secret?: boolean }).secret === true,
    );
    expect(secrets).toEqual([]);
    // Everything it stores is therefore readable by the client half, and says
    // so — `publicSettings` is the manifest's way of stating that.
    expect(manifest.addOn.publicSettings).toEqual([STORAGE_KEY]);
  });

  it("declares the one key it writes, so an installer can see it", () => {
    expect(manifest.settings).toHaveLength(1);
    const days = manifest.settings[0]!;
    expect(days.key).toBe(STORAGE_KEY);
    // `json`, because a list of days is none of the controls a HOST can draw —
    // which is why `register().settings` is empty and the whole form lives in
    // `settings.add-on.panel`.
    expect(days.type).toBe("json");
    expect(days.default).toEqual([]);
    expect(register().settings).toEqual([]);
    expect(register().defaultSettings).toEqual({ [STORAGE_KEY]: [] });
  });

  /**
   * THE CROSS-APP CLAIM, IN THE ARTEFACT AND NOT ONLY IN A README (24 AC20/D21).
   *
   * `attaches` is the one place "it runs in these apps" is checkable, and
   * `packages/host/src/manifest-schema.test.ts` is what checks it: for every app
   * named here that is checked out beside this repository, it runs the product's
   * own validator against that app's declared tables.
   *
   * NEITHER ENTRY IS `"*"`. `"*"` claims every app that will ever exist, and an
   * unfalsifiable claim is worse than a wrong one — a reader cannot tell it from
   * a checked one.
   *
   * EACH RANGE IS THE MINOR LINE THAT APP SHIPS ON. Apps are 0.x and patch-only,
   * so `^0.<minor>.0` covers every release until the owner authorises a minor
   * jump, at which point this claim must move with it. The contract accepts
   * only `^`/`~`/exact/`*` (no `>=`, no `||`), so clinic's 0.1.x releases, which
   * also consumed the days, go unclaimed: an under-claim, never an over-claim.
   * The old `^1.0.0` named a major neither app has reached.
   *
   * THE THIRD APP READS THE DAYS WITHOUT CODE. The Client Portal (`clients`,
   * shipping on 0.2.x) has no add-on seam and imports nothing: it reads this
   * add-on's public setting `days` from the config Adminium gives its staff
   * screens, and takes those days out of a studio's working weeks. Its range is
   * the same minor-line rule.
   */
  it("attaches to the three apps that use its days", () => {
    expect(manifest.addOn.attaches).toEqual([
      { app: "hr", range: "^0.1.0" },
      { app: "clinic", range: "^0.2.0" },
      { app: "clients", range: "^0.2.0" },
    ]);
    // The portal reads the days through the public setting, so it must stay public.
    expect(manifest.addOn.publicSettings).toContain(STORAGE_KEY);
  });

  it("describes itself with the same sentence the bundle carries", () => {
    // The `fallback` is what an installer shows before any bundle is loaded. A
    // fallback that had drifted from the key beside it would mean the shelf and
    // the install screen described the add-on differently.
    expect(manifest.description.key).toBe("addon.holiday-calendars.line");
    expect(register().lineKey).toBe(manifest.description.key);
    expect(manifest.description.fallback).toBe(register().messages!["en-US"]!["addon.holiday-calendars.line"]);
  });

  it("uses one key namespace for the package, the manifest and every string (D17)", () => {
    expect(manifest.key).toBe("holiday-calendars");
    expect(register().key).toBe(manifest.key);
    expect(manifest.name).toBe(register().name);
    const stray = Object.keys(register().messages!["en-US"]!).filter(
      (key) => !key.startsWith(`addon.${manifest.key}.`),
    );
    expect(stray).toEqual([]);
  });
});

/**
 * THE MANIFEST AND THE BUILD HAVE TO NAME THE SAME FILE.
 *
 * A path in the `addOn` block is a module the installer loads. `vite.config.ts`
 * exports the filename it actually writes, this suite asserts the manifest uses
 * exactly it, and `dist.test.ts` asserts the build really put it on disk. Three
 * links, no gap for a guess.
 *
 * THE CONVENTION, RESTATED (24 AC10): every path is RELATIVE TO THE PACKAGE
 * ROOT — the directory `manifest.json` itself sits in, and the directory a host
 * installs — so nothing downstream has to know what the build's `outDir` is
 * called.
 */
describe("the manifest's entry point is the file the build writes", () => {
  const declared = manifest.addOn.slots.map((fill) => fill.client);

  beforeAll(() => {
    if (declared.every((path) => existsSync(join(ROOT, path)))) return;
    buildForReal();
  }, 180_000);

  it("resolves every declared path from the package root, onto a file that exists", () => {
    for (const path of declared) {
      expect(path.startsWith("/"), `${path} is absolute, not package-root-relative`).toBe(false);
      expect(path.includes("\\"), `${path} is not a POSIX path`).toBe(false);
      expect(existsSync(join(ROOT, path)), `${path} does not exist in the build output`).toBe(true);
    }
  });

  it("names only built output, never a hand-invented layout", () => {
    for (const path of declared) {
      expect(path.startsWith("dist/"), `${path} is not in the build output`).toBe(true);
      expect(Object.values(OUTPUT) as string[]).toContain(path);
    }
  });

  it("names exactly one built module, because there is only one half", () => {
    expect(Object.keys(OUTPUT)).toEqual(["client"]);
    expect(new Set(declared).size).toBe(1);
  });
});

/**
 * WHAT THIS ADD-ON TELLS ITS HOSTS TO GREP FOR, CHECKED AGAINST WHAT IT
 * DECLARES.
 *
 * `add-on-facts.ts` carries the needles a host's D15 bundle gate looks for, and
 * it exists because those lists used to be written out inside each HOST — so a
 * credentialled add-on vendored into a shop that had never heard of it shipped
 * its secret setting keys with the gate fully green.
 *
 * ── AND HERE BOTH LISTS ARE EMPTY, WHICH IS THE HARDER CASE TO CHECK ────────
 *
 * For an add-on with credentials this suite is a tick-off: every `secret: true`
 * key and every allowed hostname has to appear in the declaration. This add-on
 * has neither, so the same assertions pass trivially — and a BROKEN
 * `add-on-facts.ts` would pass them just as trivially.
 *
 * So the direction is reversed. It is not "does the declaration cover the
 * manifest"; it is "does the MANIFEST still justify the emptiness". The day a
 * secret setting or a network block appears, these turn red and the declaration
 * has to grow with them.
 */
describe("the empty facts are empty because the manifest is", () => {
  it("declares no secret setting, which is why NEVER_IN_A_BROWSER is empty", () => {
    const secrets = manifest.settings
      .filter((setting) => (setting as { secret?: boolean }).secret === true)
      .map((setting) => setting.key);
    expect(secrets).toEqual([]);
    expect(NEVER_IN_A_BROWSER).toEqual([]);
  });

  it("allows no hostname, which is why INERT_ORIGINS is empty", () => {
    const allow = (manifest.addOn as { network?: { allow?: string[] } }).network?.allow ?? [];
    expect(allow).toEqual([]);
    expect(INERT_ORIGINS).toEqual([]);
  });

  it("would still demand a reason for either, if one were ever added", () => {
    // The shape survives the emptiness: an entry with no explanation is not an
    // entry, and this is what says so before the list has anything in it.
    for (const entry of NEVER_IN_A_BROWSER) expect(entry.why.length).toBeGreaterThan(30);
    for (const entry of INERT_ORIGINS) expect(entry.why.length).toBeGreaterThan(30);
  });
});
