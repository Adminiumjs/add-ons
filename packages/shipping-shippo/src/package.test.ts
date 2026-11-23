/** The manifest, the built halves and the words, checked together: each promises something about the others. */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

import { describeLoadable, describePackShape } from "@adminium/add-on-host/testing";

import manifest from "../manifest.json" with { type: "json" };
import { NEVER_IN_A_BROWSER } from "./add-on-facts.ts";
import { WIRE } from "./carrier.ts";
import { strings } from "./i18n/strings.ts";
import { register } from "./index.ts";
import { FILLED_SLOTS } from "./slots.ts";
import { buildForReal, DIST, ROOT } from "./testing/build.ts";

describePackShape({ root: ROOT, buildForReal });
describeLoadable({ clientBundle: `${DIST}/client.js`, buildForReal, key: manifest.key });

describe("the manifest", () => {
  it("declares exactly the two hosts the transport reaches, with no wildcard", () => {
    expect([...manifest.addOn.network.allow].sort()).toEqual([WIRE.apiHost, WIRE.fileHost].sort());
  });

  it("keeps the key secret and out of the public settings", () => {
    expect(manifest.settings.filter((setting) => setting.secret === true).map((setting) => setting.key)).toEqual(["api_key"]);
    expect(manifest.addOn.publicSettings).toEqual([]);
  });

  it("fills exactly the slots register() fills", () => {
    expect(manifest.addOn.slots.map((slot) => slot.slot).sort()).toEqual([...FILLED_SLOTS].sort());
    expect(register().fills.map((fill) => fill.slot).sort()).toEqual([...FILLED_SLOTS].sort());
  });

  it("offers no demo and no setting a browser could render", () => {
    const addOn = register();
    expect(addOn.settings).toEqual([]);
    expect(addOn).not.toHaveProperty("demoSwitch");
    expect(JSON.stringify(manifest)).not.toContain("demo");
  });

  it("names a key for every label it declares, in its own strings", () => {
    const own = strings["en-US"] as Record<string, string>;
    expect(own[manifest.description.key]).toBe(manifest.description.fallback);
    for (const setting of manifest.settings) expect(own[setting.label.key]).toBe(setting.label.fallback);
  });

  it("names every secret key and host in what a browser must never hold", () => {
    const needles = NEVER_IN_A_BROWSER.map((entry) => entry.text);
    for (const setting of manifest.settings.filter((row) => row.secret === true)) expect(needles).toContain(setting.key);
    for (const host of manifest.addOn.network.allow) expect(needles).toContain(host);
  });
});

describe("the words", () => {
  it("has every key in all eight locales, none empty", () => {
    const english = Object.keys(strings["en-US"]).sort();
    expect(Object.keys(strings)).toHaveLength(8);
    for (const [locale, table] of Object.entries(strings)) {
      expect(Object.keys(table).sort(), locale).toEqual(english);
      for (const [key, value] of Object.entries(table)) expect(value.trim().length, `${locale} ${key}`).toBeGreaterThan(0);
    }
  });

  it("says what a disconnect does in every locale's own words", () => {
    for (const locale of Object.keys(strings) as (keyof typeof strings)[]) {
      if (locale === "en-US") continue;
      expect(strings[locale]["addon.shipping-shippo.disconnect.goes"]).not.toBe(strings["en-US"]["addon.shipping-shippo.disconnect.goes"]);
    }
  });
});

describe("the built bundles", () => {
  beforeAll(() => {
    buildForReal();
  }, 180_000);

  it("emits the two halves and nothing else", () => {
    expect(readdirSync(DIST).sort()).toEqual(["client.js", "server.js"]);
    for (const entry of manifest.addOn.provides) expect(existsSync(join(ROOT, entry.server))).toBe(true);
    for (const entry of manifest.addOn.slots) expect(existsSync(join(ROOT, entry.client))).toBe(true);
  });

  it("keeps every server-side fact out of the client bundle", () => {
    const client = readFileSync(join(DIST, "client.js"), "utf8");
    expect(client.length).toBeGreaterThan(1000);
    for (const { text } of NEVER_IN_A_BROWSER) expect(client.includes(text), text).toBe(false);
  });

  it("exports the factory the engine loads by name, from the server half", async () => {
    const server = (await import(/* @vite-ignore */ join(DIST, "server.js"))) as Record<string, unknown>;
    expect(typeof server.createShippingCarrier).toBe("function");
  });

  it("holds no fetch of its own: the engine's client is the only way out", () => {
    const server = readFileSync(join(DIST, "server.js"), "utf8");
    expect(/\bfetch\s*\(/.test(server)).toBe(false);
    expect(/XMLHttpRequest|node:http|node:net/.test(server)).toBe(false);
  });
});
