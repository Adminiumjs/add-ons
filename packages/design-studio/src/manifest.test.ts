import { describe, expect, it } from "vitest";

import manifest from "../manifest.json";
import { register } from "./index.ts";
import { LAYOUT_IDS } from "./layouts.ts";
import { FILLED_SLOTS } from "./slots.ts";
import { designStudioStrings } from "./i18n/strings.ts";
import { emittedFiles } from "./testing/dist.ts";

import { INERT_ORIGINS, NEVER_IN_A_BROWSER } from "./add-on-facts.ts";

/**
 * The manifest's cross-block rules, checked here rather than by importing
 * `@adminium/manifest`.
 *
 * The real validator lives in `packages/manifest/src/schema.ts` and this repo
 * cannot reach it — same "copied not imported" bind as `@adminium/add-on-host`,
 * except
 * that copying a 450-line Zod envelope to assert a 90-line JSON document would
 * be a worse trade than restating the rules that actually bite. So this suite
 * checks THE RULES 24 §5.3 names by issue code, plus the two invariants that
 * are specific to this add-on: it declares no egress because it makes no call,
 * and its settings keys are the ones its own fills read.
 *
 * What this does NOT catch is a schema change upstream. The mitigation is that
 * the shapes below are the ones the issue codes are written against, and the
 * codes are stable API.
 */
/** The settings block, widened: the two entries have different `default` types. */
interface ManifestSetting {
  key: string;
  type: string;
  secret?: boolean;
  default?: unknown;
}

describe("manifest.json", () => {
  const addOn = manifest.addOn;
  const settings = manifest.settings as unknown as ManifestSetting[];

  it("is an add-on, not an app", () => {
    expect(manifest.kind).toBe("add-on");
    expect(manifest.manifestVersion).toBe(1);
    // §5.7 item 6: an add-on cannot install pages, roles or a frontend, and the
    // strongest way to say so is for the fields not to exist.
    expect(manifest).not.toHaveProperty("pages");
    expect(manifest).not.toHaveProperty("roles");
    expect(manifest).not.toHaveProperty("frontend");
  });

  it("is first-party, which is the only publisher v1 accepts (D13)", () => {
    expect(manifest.publisher.id).toBe("adminium");
  });

  it("takes a category from the add-on vocabulary, not the app facet set (D2)", () => {
    expect(manifest.categories).toEqual(["artwork"]);
  });

  it("attaches to the print shop at a real semver range (ATTACH_TARGET_UNKNOWN)", () => {
    expect(addOn.attaches).toEqual([{ app: "printing", range: "^1.0.0" }]);
  });

  it("fills only slots in the closed registry, and only the ones it renders (SLOT_UNKNOWN)", () => {
    const declared = addOn.slots.map((s) => s.slot).sort();
    expect(declared).toEqual([
      "artwork.sources",
      "settings.add-on.panel",
    ]);
    expect(register().fills.map((f) => f.slot).sort()).toEqual(declared);
    // …and the compile-time narrowing agrees with both. `FILLED_SLOTS` is
    // `satisfies readonly SlotId[]` against the ONE shared mirror of the host's
    // registry, so this line ties the manifest and `register()` to a list the
    // host itself can invalidate.
    expect([...FILLED_SLOTS].sort()).toEqual(declared);
  });

  it("provides artwork-source at the version the registry carries (CONTRACT_UNKNOWN)", () => {
    expect(addOn.provides).toHaveLength(1);
    expect(addOn.provides[0]!.contract).toBe("artwork-source");
    expect(addOn.provides[0]!.version).toBe(1);
  });

  /**
   * THE ENTRY POINTS, pinned to the two files the build emits, in the SAME
   * ALPHABET the other add-ons in this wave use.
   *
   * Every entry-point path in every wave-4 manifest is relative to the PACKAGE
   * ROOT — the directory a host installs — and begins with `dist/`. This add-on
   * used to write them relative to `dist/` instead — `client.js`,
   * `server/artwork-source.js` — while the carrier wrote `dist/client.js` and
   * `dist/server.js`, so a host resolving a path had to know which add-on it
   * came from. One convention, three manifests.
   *
   * These lines used to name `client/artwork-tile.js`, `client/editor-route.js`
   * and `client/settings-panel.js` — a file per slot, none of which any build
   * ever wrote. §5.7 item 2 says the host serves ONE bundle per add-on from its
   * own origin and `import()`s it lazily, so one bundle registers both fills;
   * the per-slot `client` field says WHICH module to load, and for a
   * single-bundle add-on that is the same module twice.
   */
  it("names entry points in the wave's one convention (§5.7 item 2)", () => {
    expect(addOn.slots.map((fill) => fill.client)).toEqual(["dist/client.js", "dist/client.js"]);
    expect(addOn.provides[0]!.server).toBe("dist/server.js");
    for (const path of [...addOn.slots.map((f) => f.client), addOn.provides[0]!.server]) {
      expect(path, `${path} is not written relative to the package root`).toMatch(
        /^dist\//,
      );
    }
  });

  /**
   * AND THOSE PATHS ARE FILES. A manifest field naming a file no build writes
   * is a 404 at install time and nothing catches it before then, which is
   * exactly what happened to the three per-slot paths above.
   *
   * The build runs once in vitest global setup (`src/testing/dist.ts`), so this
   * asserts over a fresh `dist/` without racing `built-output.test.ts`, which
   * reads the same directory. A rename on either side — manifest, or
   * `vite.config.ts` — is a red test here rather than a support ticket.
   */
  it("names entry points the build actually emits", () => {
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

  it("scopes nothing beyond the host's jobs and its own files (SCOPE_OUT_OF_RANGE)", () => {
    expect(addOn.scopes).toEqual(["records:jobs:read", "files:write"]);
    // Read-only on the host's records: this add-on adds artwork, it does not
    // edit the job it was made for.
    expect(addOn.scopes.some((s) => s.startsWith("records:") && s.endsWith(":write"))).toBe(false);
  });

  it("declares NO egress, because it calls nothing (D14)", () => {
    expect(addOn).not.toHaveProperty("network");
    expect(manifest.capabilities).not.toContain("outbound-http");
    // No third party means no demo transport to seed: there is nothing to
    // simulate when there is nothing to call (D11).
    expect(addOn).not.toHaveProperty("demoTransport");
  });

  it("connects with one click and no account (§5.6)", () => {
    expect(addOn.connect).toEqual({ kind: "none" });
    expect(manifest.capabilities).not.toContain("oauth-connect");
    expect(register().connect).toBe("none");
  });

  it("exposes only non-secret settings to the client (FRONTEND_SECRET_LEAK)", () => {
    expect(settings.filter((s) => s.secret === true)).toEqual([]);
    expect(addOn.publicSettings).toEqual(settings.map((s) => s.key));
  });

  it("brings one table, and its columns are the ones the engine writes", () => {
    expect(manifest.requiredSchema.tables).toHaveLength(1);
    const table = manifest.requiredSchema.tables[0]!;
    expect(table.ref).toBe("artwork_designs");
    expect(table.columns.map((c) => c.ref)).toEqual([
      "id",
      "job_id",
      "product",
      "width_mm",
      "height_mm",
      "bleed_mm",
      "doc",
      "preview_file",
      "created_at",
      "updated_at",
    ]);
  });

  it("defaults every starting layout on, and names the ones this build has", () => {
    const layouts = settings.find((s) => s.key === "starting_layouts")!;
    expect(layouts.default).toEqual([...LAYOUT_IDS]);
  });

  it("keeps the proof on by default, because the works checks every job", () => {
    const proof = settings.find((s) => s.key === "proof_required")!;
    expect(proof.default).toBe(true);
  });

  /**
   * AC6, in the shape this add-on can honestly satisfy.
   *
   * The criterion asks every add-on's detail surface to be clear about who else
   * is involved. This one names no company, so it has no relationship to
   * disclaim — and rendering nothing where the disclaimer goes would leave a
   * reader unable to tell "connects to nobody" from "somebody forgot". The
   * positive sentence takes the disclaimer's place, in this add-on's own
   * bundle, and the host renders whichever of the two applies.
   */
  it("states what it connects to in place of a disclaimer it cannot make (AC6)", () => {
    const registered = register();
    expect(registered.namesCompany).toBe(false);
    expect(registered.noCompanyKeys).toEqual([
      "addon.design-studio.noCompany",
      "addon.design-studio.noAccount",
    ]);
    // Its own bundle, in this add-on's namespace — never a host key, which the
    // host would then have to hold on this add-on's behalf.
    for (const key of registered.noCompanyKeys ?? []) {
      expect(key.startsWith("addon.design-studio.")).toBe(true);
      expect(designStudioStrings["en-US"]).toHaveProperty(key);
    }
    // The manifest agrees: nothing to connect to, nothing to authorise.
    expect(addOn.connect).toEqual({ kind: "none" });
    expect(manifest.capabilities).not.toContain("outbound-http");
  });

  it("agrees with the registration object on key, name and category", () => {
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
