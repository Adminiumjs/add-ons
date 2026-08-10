/**
 * The seam that decides which carrier the screens are talking to.
 *
 * Small module, but the one place a mistake would be invisible and serious: a
 * demo that quietly fell through to the connected transport would make a real
 * call on a public demo, which is exactly what D11 exists to prevent.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { ShippingCarrier } from "@adminium/add-on-host/contracts";
import { carrier, findShipment, isDemo, labels, resetRuntime } from "./runtime.ts";
import { DESTINATIONS, FIRST_TRACKING, WORKS_ADDRESS } from "./seed.ts";
import { applySettings, DEFAULT_SETTINGS, publicSettings } from "./settings.ts";
import { useConnectedCarrier } from "./runtime.ts";

const parcel = {
  weightKg: 1.8,
  lengthCm: 34,
  widthCm: 26,
  heightCm: 12,
  contents: "Printed work at 350gsm, boxed",
};

/** A transport that fails the test by existing, if anything ever reaches it. */
const tripwire: ShippingCarrier = {
  key: "tripwire",
  quote: async () => {
    throw new Error("the connected transport was called with the demo switch on");
  },
  book: async () => {
    throw new Error("the connected transport was called with the demo switch on");
  },
  track: async () => [],
  label: async () => ({ fileId: "x", filename: "x.pdf", mediaType: "application/pdf", bytes: 1 }),
  cancel: async () => {},
};

describe("the runtime seam", () => {
  beforeEach(() => {
    resetRuntime();
    applySettings({ ...DEFAULT_SETTINGS });
  });

  it("defaults to the demo transport, and says so", () => {
    expect(publicSettings().demo_transport).toBe(true);
    expect(carrier().key).toBe("shipping-dhl");
    expect(isDemo()).toBe(true);
    expect(labels()).not.toBeNull();
  });

  it("keeps the demo in front even after a connected transport is injected", async () => {
    useConnectedCarrier(tripwire);
    // The switch is the authority, not the presence of credentials: a shop that
    // pasted a key and left the demo switch on has not agreed to live calls.
    expect(carrier().key).toBe("shipping-dhl");
    await expect(carrier().quote(parcel, WORKS_ADDRESS, DESTINATIONS.kestrel!)).resolves.toHaveLength(3);
  });

  it("hands over to the connected transport only when the switch is off", () => {
    useConnectedCarrier(tripwire);
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
    expect(carrier().key).toBe("tripwire");
    expect(isDemo()).toBe(false);
    // Labels are the host's to store once a real carrier is issuing them.
    expect(labels()).toBeNull();
  });

  it("falls back to the demo when the switch is off and nothing was injected", () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
    // Better a labelled demo than a screen that throws: an add-on with no
    // transport wired has nothing to say, and saying it in the demo's voice at
    // least keeps the "no real shipment" chip on the screen.
    expect(carrier().key).toBe("shipping-dhl");
    expect(isDemo()).toBe(true);
  });

  it("is one instance per page, so a booking is visible on both surfaces", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel, WORKS_ADDRESS, DESTINATIONS.kestrel!);
    await impl.book(rate!, { reference: "MP-4126" });
    // The works booked it on the dispatch screen; the customer's order view
    // asks the same seam and finds it.
    expect(findShipment("MP-4126")?.tracking).toBe(FIRST_TRACKING);
    expect(findShipment("MP-4125")).toBeUndefined();
  });

  it("starts the counter over when the runtime is reset", async () => {
    const first = carrier();
    const [rate] = await first.quote(parcel, WORKS_ADDRESS, DESTINATIONS.kestrel!);
    await first.book(rate!, { reference: "MP-4126" });
    resetRuntime();
    const second = carrier();
    const [again] = await second.quote(parcel, WORKS_ADDRESS, DESTINATIONS.kestrel!);
    const shipment = await second.book(again!, { reference: "MP-4126" });
    expect(shipment.tracking).toBe(FIRST_TRACKING);
  });
});
