/**
 * What makes this a kit rather than DHL's screens in another folder: the name
 * is a parameter (S2-F10), nothing here can send (W2), no credential is in
 * reach, and a server half can import it without React (W23).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  foreignImportsIn,
  impuritiesIn,
  offendingAddresses,
  rawControlOffences,
  RAW_CONTROL_EXPLANATION,
  sendersIn,
} from "@adminium/add-on-host/testing";
import type { EngineCarrier } from "@adminium/add-on-host/engine-carrier";
import { afterEach, describe, expect, it } from "vitest";

import { configureShippingKit, kitBrand, resetShippingKit } from "./brand.ts";
import { createDemoCarrier } from "./demo-carrier.ts";
import { translate } from "./i18n/t.ts";
import { LOCALE_TAGS, strings, type StringKey } from "./i18n/strings.ts";
import { kitMessages } from "./index.ts";
import { PINNED_NOW } from "./clock.ts";
import { renderLabelPdf } from "./label.ts";
import { carrier, CarrierNotConnected, carrierState, connectEngineCarrier, engineCarrier, hasPageCarrier, resetRuntime } from "./runtime.ts";
import { applySettings, DEFAULT_SETTINGS } from "./settings.ts";
import { TEST_BRAND } from "./testing/kit-brand.ts";

const SRC = new URL(".", import.meta.url).pathname;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
const SHIPPED = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.includes(".test.") && !f.includes(`${"testing"}/`));
const codeOf = (file: string) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
const relative = (file: string) => file.slice(SRC.length);

afterEach(() => {
  resetRuntime();
  applySettings({ ...DEFAULT_SETTINGS });
  resetShippingKit();
  configureShippingKit(TEST_BRAND);
});

describe("the carrier's name is a parameter", () => {
  it("names no real carrier anywhere in what it ships, comments included", () => {
    const named = SHIPPED.filter((file) => /\b(?:DHL|dhl|Shippo|shippo|UPS|FedEx|USPS)\b/.test(readFileSync(file, "utf8")));
    expect(named.map(relative)).toEqual([]);
  });

  it("writes the name into every language, wherever a string asks for it", () => {
    const keys = (Object.keys(strings["en-US"]) as StringKey[]).filter((key) => strings["en-US"][key].includes("{carrier}"));
    expect(keys.length).toBeGreaterThan(3);
    for (const locale of LOCALE_TAGS) {
      for (const key of keys) {
        const drawn = translate(locale, key);
        expect(drawn, `${locale} ${key}`).toContain("Acme Post");
        expect(drawn, `${locale} ${key}`).not.toContain("{carrier}");
      }
    }
  });

  it("keeps the placeholder in every translation of a string that has it", () => {
    for (const locale of LOCALE_TAGS) {
      for (const key of Object.keys(strings["en-US"]) as StringKey[]) {
        const inEnglish = strings["en-US"][key].includes("{carrier}");
        expect((strings[locale][key] as string).includes("{carrier}"), `${locale} ${key}`).toBe(inEnglish);
      }
    }
  });

  it("gives a host finished copy, with nothing left to fill in", () => {
    const named = kitMessages("Acme Post");
    for (const locale of LOCALE_TAGS) expect(JSON.stringify(named[locale])).not.toContain("{carrier}");
    expect(named["en-US"]["addon.shipping-kit.checkout.title"]).toBe("Delivery by Acme Post");
  });

  it("answers its demo, ids and label in that name", async () => {
    const demo = createDemoCarrier({ brand: kitBrand(), clock: PINNED_NOW, cutoff: "15:00" });
    expect(demo.key).toBe("shipping-test");
    const address = { name: "A", lines: ["1 Road"], city: "Leeds", postcode: "LS1 4AP", country: "GB" };
    const parcel = { weightKg: 1, lengthCm: 10, widthCm: 10, heightCm: 10, contents: "Mugs" };
    const [rate] = await demo.quote(parcel, address, address);
    const shipment = await demo.book(rate!, { reference: "R-1" });
    expect(shipment.id).toBe("acme-shp-R-1");
    expect(shipment.labelFileId).toBe("acme-label-R-1");
    const pdf = renderLabelPdf({
      carrier: "Acme Post",
      tracking: "1",
      service: "S",
      reference: "R-1",
      collection: "c",
      delivery: "d",
      to: address,
      from: address,
    });
    expect(pdf).toContain("Acme Post \\(simulated\\)");
  });

  it("refuses a second carrier on one copy, and says which", () => {
    expect(() => configureShippingKit({ ...TEST_BRAND, addOnKey: "shipping-other", name: "Other" })).toThrow(/shipping-test.*shipping-other/);
    expect(kitBrand().name).toBe("Acme Post");
  });

  it("says plainly when it is drawn before its add-on registered", () => {
    resetShippingKit();
    expect(() => kitBrand()).toThrow(/register\(\)/);
  });
});

describe("handing in the app's client", () => {
  const client = (addOnKey: string) => ({ addOnKey }) as EngineCarrier;

  it("holds the client for its own carrier and ignores another's", () => {
    connectEngineCarrier(client("shipping-other"));
    expect(engineCarrier()).toBeNull();
    const mine = client("shipping-test");
    connectEngineCarrier(mine);
    expect(engineCarrier()).toBe(mine);
  });

  it("reads as connected only with that client, and never hands the contract seam a carrier it lacks", () => {
    applySettings({ demo_transport: false });
    expect(carrierState()).toBe("not-connected");
    connectEngineCarrier(client("shipping-other"));
    expect(carrierState()).toBe("not-connected");
    connectEngineCarrier(client("shipping-test"));
    expect(carrierState()).toBe("connected");
    expect(hasPageCarrier()).toBe(false);
    expect(() => carrier()).toThrow(CarrierNotConnected);
  });
});

describe("what ships into a browser", () => {
  it("is there to be read", () => {
    expect(SHIPPED.length).toBeGreaterThan(15);
  });

  it("names no way of sending anything", () => {
    const offenders = SHIPPED.flatMap((file) => [
      ...sendersIn(codeOf(file)).map((means) => `${relative(file)}: ${means}`),
      ...foreignImportsIn(codeOf(file)).map((spec) => `${relative(file)}: ${spec}`),
      ...offendingAddresses(codeOf(file), []).map((url) => `${relative(file)}: ${url}`),
    ]);
    expect(offenders).toEqual([]);
  });

  it("reads no real clock and rolls no dice", () => {
    const offenders = SHIPPED.flatMap((file) => impuritiesIn(codeOf(file)).map((means) => `${relative(file)}: ${means}`));
    expect(offenders).toEqual([]);
  });

  it("writes control characters as escapes, never as raw bytes", () => {
    const offenders = walk(SRC)
      .filter((file) => /\.tsx?$/.test(file))
      .flatMap((file) => rawControlOffences(relative(file), readFileSync(file, "utf8")));
    expect(offenders, `\n${RAW_CONTROL_EXPLANATION}\n${offenders.join("\n")}\n`).toEqual([]);
  });

  it("reads no credential, logs nothing and stores nothing", () => {
    const offenders = SHIPPED.filter((file) =>
      /\b(?:api_key|api_secret|api_token|account_number|credentials)\b|\bconsole\.|localStorage|sessionStorage|indexedDB/.test(codeOf(file)),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("takes the engine client as a type only, so its code is never bundled twice", () => {
    const runtime = codeOf(join(SRC, "runtime.ts"));
    expect(runtime).toMatch(/import type \{ EngineCarrier \}/);
    for (const file of SHIPPED) expect(codeOf(file), relative(file)).not.toMatch(/^import \{[^}]*\} from "@adminium\/add-on-host\/engine-carrier"/m);
  });
});

describe("a server half can import the demo", () => {
  it("reaches no React from the demo transport, at any depth", () => {
    const seen = new Set<string>();
    const follow = (file: string): void => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const [, spec] of codeOf(file).matchAll(/from "(\.[^"]+)"/g)) follow(join(file, "..", spec!));
    };
    follow(join(SRC, "demo-carrier.ts"));
    expect(seen.size).toBeGreaterThan(3);
    for (const file of seen) expect(codeOf(file), relative(file)).not.toMatch(/from "react|\.tsx"/);
  });
});
