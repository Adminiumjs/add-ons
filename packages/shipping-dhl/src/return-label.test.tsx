/**
 * THE INBOUND HALF, RENDERED AND REFUSED (31 O4).
 *
 * Four properties are load-bearing here, and each one is the executable form of
 * a sentence in `ui/ReturnLabel.tsx`'s header:
 *
 *   1. On any record that is not a `return`, the fill draws NOTHING — not an
 *      empty panel, nothing. `record.actions` is multi-fill and mounted on
 *      records this fill has no business with; a stray panel on a works item
 *      would be the Live Personalizer defect with a courier's name on it.
 *
 *   2. With no returns depot in the add-on's own settings, the surface says so
 *      in words and offers nothing. The depot is OPERATOR CONFIGURATION, not a
 *      guess, and there is no honest default address.
 *
 *   3. The transport refuses an unserviceable SENDER with its own sentence —
 *      the conformance suite's end-symmetry, exercised here at the surface the
 *      demo device actually uses.
 *
 *   4. The label's sender is THE QUOTED ROUTE'S sender, not the address the
 *      transport was constructed with. For outbound bookings the two are the
 *      same shop address, which is exactly how the defect stayed invisible; a
 *      return is the first booking where they differ, so this is the case that
 *      keeps it fixed.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";

import type { RecordActionsPayload } from "@adminium/add-on-host";
import type { Address } from "@adminium/add-on-host/contracts";

import { PINNED_NOW } from "./clock.ts";
import { createDemoCarrier, SENDER_POSTCODE_REFUSAL } from "./demo-carrier.ts";
import { strings } from "./i18n/strings.ts";
import { carrier, rememberRoute, resetRuntime, setHostClock } from "./runtime.ts";
import { depotFrom, ReturnLabel } from "./ui/ReturnLabel.tsx";

const EN = strings["en-US"];

/** The shop's returns depot, as the operator saved it in the settings panel. */
const DEPOT_SETTINGS = {
  returns_name: "Hearth Returns",
  returns_lines: "Unit 9, Ferry Works",
  returns_city: "Bristol",
  returns_postcode: "BS2 0FZ",
  returns_country: "GB",
};

const SENDER: Address = {
  name: "Sam Ashworth",
  lines: ["24 Ellery Lane"],
  city: "Bristol",
  postcode: "BS1 4TR",
  country: "GB",
};

const PARCEL = { weightKg: 0.35, lengthCm: 32, widthCm: 24, heightCm: 8, contents: "RMA-1" };

/**
 * A payload shaped like the one a host passes. `record` carries a plausible
 * row on purpose and the component reads none of it — the addresses come from
 * the settings and the sender's own form, which is the claim worth proving
 * against a fixture that LOOKS readable.
 */
function payloadWith(over: Partial<RecordActionsPayload> = {}): RecordActionsPayload {
  return {
    entity: "return",
    recordId: "RMA-4419137",
    record: { order: "HH-87109", reason: "faulty", addr: ["24 Ellery Lane, Bristol BS1 4TR"] },
    now: { iso: "2026-08-05", hour: 10, minute: 20 },
    settings: { ...DEPOT_SETTINGS },
    ...over,
  };
}

const render = (over: Partial<RecordActionsPayload> = {}) =>
  renderToStaticMarkup(<ReturnLabel payload={payloadWith(over)} />);

afterEach(() => {
  resetRuntime();
});

describe("reading the depot out of the add-on's own settings", () => {
  it("parses the five keys the settings panel writes", () => {
    expect(depotFrom(DEPOT_SETTINGS)).toEqual({
      name: "Hearth Returns",
      lines: ["Unit 9", "Ferry Works"],
      city: "Bristol",
      postcode: "BS2 0FZ",
      country: "GB",
    });
  });

  it("treats an absent or half-filled depot as NOT CONFIGURED, never half-used", () => {
    expect(depotFrom(undefined)).toBeNull();
    expect(depotFrom({})).toBeNull();
    // A city without a postcode is not an address a label can carry.
    expect(depotFrom({ ...DEPOT_SETTINGS, returns_postcode: " " })).toBeNull();
    // And a usable address with no name has nothing to print on the TO line.
    expect(depotFrom({ ...DEPOT_SETTINGS, returns_name: "" })).toBeNull();
  });
});

describe("the entity gate", () => {
  it("draws NOTHING on a record that is not a return", () => {
    expect(render({ entity: "item" })).toBe("");
    expect(render({ entity: "invoice" })).toBe("");
  });

  it("draws the surface on a return", () => {
    expect(render()).toContain(EN["addon.shipping-dhl.returns.title"]);
  });
});

describe("a shop that has not set a returns address", () => {
  it("says so in words and offers no form", () => {
    const markup = render({ settings: {} });
    expect(markup).toContain(EN["addon.shipping-dhl.returns.notSetUp"]);
    expect(markup).not.toContain(EN["addon.shipping-dhl.rates.get"]);
    // The disclosure still ships: the monogram names the company, so the
    // not-affiliated line belongs on THIS card too (24 AC6).
    expect(markup).toContain(EN["addon.shipping-dhl.notAffiliated"]);
  });
});

describe("the configured surface", () => {
  it("shows the sender form, names the depot, and admits the assumed parcel", () => {
    const markup = render();
    expect(markup).toContain(EN["addon.shipping-dhl.returns.sender"]);
    expect(markup).toContain(EN["addon.shipping-dhl.returns.senderName"]);
    expect(markup).toContain("Hearth Returns");
    expect(markup).toContain(EN["addon.shipping-dhl.notAffiliated"]);
  });
});

describe("the transport, pointed inbound", () => {
  it("refuses an unserviceable sender with the carrier's own sentence", async () => {
    const demo = createDemoCarrier({ clock: PINNED_NOW, cutoff: "15:00" });
    await expect(
      demo.quote(PARCEL, { ...SENDER, postcode: "BS1" }, depotFrom(DEPOT_SETTINGS)!),
    ).rejects.toMatchObject({ carrierMessage: SENDER_POSTCODE_REFUSAL, retryable: true });
    // …and the fix genuinely works: the same route with the postcode completed
    // quotes at least one service, which is what makes the refusal a rule.
    await expect(demo.quote(PARCEL, SENDER, depotFrom(DEPOT_SETTINGS)!)).resolves.not.toHaveLength(
      0,
    );
  });

  it("prints the QUOTED sender on the label, not the address it was built with", async () => {
    const demo = createDemoCarrier({ clock: PINNED_NOW, cutoff: "15:00" });
    const depot = depotFrom(DEPOT_SETTINGS)!;
    demo.rememberRoute("RMA-1", SENDER, depot);
    const [rate] = await demo.quote(PARCEL, SENDER, depot);
    const shipment = await demo.book(rate!, { reference: "RMA-1" });
    const bytes = demo.labels.read(shipment.labelFileId)!;
    // The hand-rolled PDF stores its text uncompressed, so the assertion can
    // read the label like the depot would: sender's name and city on it, and
    // not the transport's own constructed origin.
    expect(bytes).toContain(SENDER.name);
    expect(bytes).toContain(depot.name);
    expect(bytes).not.toContain("Kingsbridge");
  });
});

describe("a label made earlier", () => {
  it("survives the component: a fresh render shows the made state from the transport", async () => {
    setHostClock({ iso: "2026-08-05", hour: 10, minute: 20 });
    const depot = depotFrom(DEPOT_SETTINGS)!;
    rememberRoute("RMA-4419137", SENDER, depot);
    const [rate] = await carrier().quote(PARCEL, SENDER, depot);
    const shipment = await carrier().book(rate!, { reference: "RMA-4419137" });

    const markup = render();
    expect(markup).toContain(EN["addon.shipping-dhl.returns.made"]);
    expect(markup).toContain(shipment.tracking);
    expect(markup).toContain(EN["addon.shipping-dhl.demoChip"]);
  });
});
