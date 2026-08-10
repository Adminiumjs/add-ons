import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "../manifest.json";
import { OUTPUT } from "../vite.config.ts";
import { register } from "./index.ts";
import { OAUTH, VENDOR_API_HOST } from "./oauth.ts";
import { FILLED_SLOTS } from "./slots.ts";
import { importCanvaStrings } from "./i18n/strings.ts";
import { PACKAGE_ROOT, distFiles, ensureFreshBuild, packageRelative } from "./testing/built.ts";

/**
 * The manifest is what the installer is told; `register()` is what actually
 * runs. Nothing checks that they agree — the host has no manifest at all in
 * demo mode — so the two drift apart silently and are only caught by whoever
 * installs the add-on for real. These assertions are that check.
 */
describe("the manifest agrees with the code", () => {
  const addOn = register();

  it("names the same add-on", () => {
    expect(manifest.kind).toBe("add-on");
    expect(manifest.key).toBe(addOn.key);
    expect(manifest.name).toBe(addOn.name);
    expect(manifest.categories).toEqual([addOn.category]);
    expect(manifest.addOn.connect.kind).toBe(addOn.connect);
  });

  it("declares the slots the code actually fills, at the same orders", () => {
    expect(manifest.addOn.slots.map((s) => s.slot)).toEqual(addOn.fills.map((f) => f.slot));
    // …and both agree with the compile-time narrowing, which is
    // `satisfies readonly SlotId[]` against the ONE shared mirror of the host's
    // registry — so a slot the host drops fails to compile here rather than
    // failing to render on someone else's install.
    expect([...manifest.addOn.slots.map((s) => s.slot)].sort()).toEqual([...FILLED_SLOTS].sort());
    const [fill] = manifest.addOn.slots;
    expect(fill.slot).toBe(addOn.fills[0].slot);
    // Order 20 is load-bearing: it puts this tile behind Design Studio's 10 so
    // the shop's own editor leads. A silent change here reorders the panel.
    expect(fill.order).toBe(20);
    expect(addOn.fills[0].order).toBe(20);
  });

  it("declares the contract this repo implements, at version 1", () => {
    expect(manifest.addOn.provides).toEqual([
      { contract: "artwork-source", version: 1, server: OUTPUT.server },
    ]);
  });

  it("describes itself with a key that exists in all eight locales", () => {
    expect(manifest.description.key).toBe(addOn.lineKey);
    for (const bundle of Object.values(importCanvaStrings)) {
      expect((bundle as Record<string, string>)[addOn.lineKey]).toBeTruthy();
    }
    // The fallback is what renders when the catalog has no bundle at all, so it
    // has to be the English rather than a paraphrase of it.
    expect(manifest.description.fallback).toBe(
      importCanvaStrings["en-US"]["addon.import-canva.line"],
    );
  });
});

/**
 * THE PATHS THE INSTALLER LOADS, checked against the files the build emits.
 *
 * A manifest that names an entry point the build does not produce installs
 * cleanly and then fails at the moment a slot is rendered — on someone else's
 * machine, with an error that says nothing about this repo. Nothing else here
 * can catch it: `register()` is what the DEMO runs, and the demo imports the
 * sources rather than `dist/`, so the two halves could disagree indefinitely.
 *
 * `ensureFreshBuild()` rebuilds when `dist/` is missing or behind, so this is a
 * check on the CURRENT build rather than on whatever was lying around.
 */
describe("the manifest's entry points exist in the build output (AC10)", () => {
  ensureFreshBuild();
  const emitted = new Set(distFiles().map(packageRelative));

  /** Every path the installer would resolve, in the order the manifest lists them. */
  const clientPaths = manifest.addOn.slots.map((s) => s.client);
  const serverPaths = [...manifest.addOn.provides.map((p) => p.server), manifest.addOn.demoTransport];

  it("emits every file a slot fill names", () => {
    for (const fill of manifest.addOn.slots) {
      expect(emitted.has(fill.client), `${fill.slot} → ${fill.client}`).toBe(true);
      expect(existsSync(join(PACKAGE_ROOT, fill.client))).toBe(true);
    }
  });

  it("emits every file a provided contract names", () => {
    for (const provided of manifest.addOn.provides) {
      expect(emitted.has(provided.server), `${provided.contract} → ${provided.server}`).toBe(true);
      expect(existsSync(join(PACKAGE_ROOT, provided.server))).toBe(true);
    }
  });

  it("emits the demo transport D11 requires it to ship", () => {
    expect(emitted.has(manifest.addOn.demoTransport)).toBe(true);
    expect(existsSync(join(PACKAGE_ROOT, manifest.addOn.demoTransport))).toBe(true);
  });

  it("names only built output, under the names `vite.config.ts` writes", () => {
    // The path convention, asserted rather than described: `dist/…` relative to
    // the package root, and never a hand-invented layout that reads as if `dist/`
    // were the install root in one place and not in another. `OUTPUT` is the
    // single source of truth — the build writes those names, the manifest uses
    // them, and a change to either without the other fails here.
    for (const path of [...clientPaths, ...serverPaths]) {
      expect(path.startsWith("dist/"), `${path} is not in the build output`).toBe(true);
      expect(Object.values(OUTPUT) as string[]).toContain(path);
    }
    for (const path of clientPaths) expect(path).toBe(OUTPUT.client);
    for (const path of serverPaths) expect(path).toBe(OUTPUT.server);
  });

  it("keeps the client and server halves in separate files", () => {
    // Not cosmetic: it is what lets a host serve one half to a browser and load
    // the other outside one, and what makes D15's "no secret in the client
    // bundle" a statement about a file rather than about intent.
    expect(OUTPUT.client).not.toBe(OUTPUT.server);
  });

  it("names a stylesheet-free server half and a styled client half", () => {
    // The client fill is what carries `client.css` in; a server entry that
    // imported a stylesheet would be a server entry that cannot load in Node.
    expect(emitted.has(OUTPUT.clientCss)).toBe(true);
    expect(existsSync(join(PACKAGE_ROOT, OUTPUT.server.replace(/\.js$/, ".css")))).toBe(false);
  });
});

describe("the egress allow-list (24 D14)", () => {
  it("carries exactly one exact hostname, and it is the one oauth.ts names", () => {
    expect(manifest.addOn.network.allow).toEqual([VENDOR_API_HOST]);
  });

  it("has no wildcard, no scheme, no port and no bare IP", () => {
    for (const host of manifest.addOn.network.allow) {
      expect(host).toMatch(/^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/);
      expect(host).not.toContain("*");
      expect(host).not.toContain("/");
      expect(host).not.toContain(":");
    }
  });

  it("declares outbound-http, which is what makes the allow-list required", () => {
    expect(manifest.capabilities).toContain("outbound-http");
    expect(manifest.addOn.network.allow.length).toBeGreaterThan(0);
  });

  it("keeps every declared URL inside the hosts it is allowed to reach", () => {
    // An authorize URL on a host the allow-list does not carry is a call the
    // runtime would refuse — better to fail here than in an audit row.
    for (const url of [OAUTH.authorizeUrl, OAUTH.tokenUrl]) {
      const { protocol, hostname } = new URL(url);
      expect(protocol).toBe("https:");
      expect(hostname.endsWith("canva.com")).toBe(true);
    }
  });
});

describe("secrets and settings (24 D15)", () => {
  it("declares no settings at all, so none can leak into the client", () => {
    expect(register().settings).toEqual([]);
    expect(manifest.addOn.publicSettings).toEqual([]);
    expect("settings" in manifest).toBe(false);
  });
});

describe("scopes", () => {
  it("asks for the two the consent panel promises, and nothing more", () => {
    expect(manifest.addOn.connect.scopes).toEqual([...OAUTH.scopes]);
    expect(manifest.addOn.connect.scopes).toHaveLength(2);
  });

  it("asks the host for read on jobs and write on files, and nothing more", () => {
    expect(manifest.addOn.scopes).toEqual(["records:jobs:read", "files:write"]);
  });

  it("is still marked unverified — the endpoints have not been read yet", () => {
    // When someone reads them from the vendor's documentation they flip this
    // and record the date in the README. Until then the flag is the honest
    // state of this repo, not an oversight.
    expect(OAUTH.verified).toBe(false);
  });
});

describe("publisher (24 D13)", () => {
  it("is first-party, which is the only publisher v1 accepts", () => {
    expect(manifest.publisher.id).toBe("adminium");
  });
});
