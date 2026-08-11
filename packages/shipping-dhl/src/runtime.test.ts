/**
 * The seam that decides which carrier the screens are talking to.
 *
 * Small module, but the one place a mistake would be invisible and serious: a
 * demo that quietly fell through to the connected transport would make a real
 * call on a public demo, which is exactly what D11 exists to prevent.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { ShippingCarrier } from "@adminium/add-on-host/contracts";
import {
  carrier,
  findShipment,
  isDemo,
  labels,
  rememberRoute,
  resetRuntime,
  setHostClock,
  shopClock,
} from "./runtime.ts";
import { PINNED_NOW } from "./clock.ts";
import { DEMO_ORIGIN, FIRST_TRACKING } from "./seed.ts";

/** Somewhere to quote to. Supplied by the suite; the host supplies it in life. */
const TO = {
  name: "Kestrel Joinery",
  lines: ["The Joinery Shop", "Wold Lane"],
  city: "Nether Wold",
  postcode: "NW3 6BD",
  country: "GB",
};
import { applySettings, DEFAULT_SETTINGS, publicSettings } from "./settings.ts";
import { useConnectedCarrier } from "./runtime.ts";

const parcel = {
  weightKg: 1.8,
  lengthCm: 34,
  widthCm: 26,
  heightCm: 12,
  contents: "500 × Sample goods",
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
    await expect(carrier().quote(parcel, DEMO_ORIGIN, TO)).resolves.toHaveLength(3);
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

  /**
   * AND EVERYTHING ELSE THAT TALKS TO THE DEMO AGREES THAT IT IS IN USE.
   *
   * THE DEFECT: `carrier()` fell back to the demo whenever nothing was
   * injected, but `rememberRoute`, `labels` and `findShipment` asked a narrower
   * question — "is the switch ON?" — and answered "no" in exactly that state.
   * The route was therefore thrown away, the demo carrier fell back to the
   * address it was CONSTRUCTED with, and its tracking scans named a town from
   * `seed.ts` instead of the shop the host had just passed. On the maker
   * studio's screen that read "Picked up from the shop · Marlow", which is the
   * other host's town, for a parcel that left Saltburn.
   *
   * A switch a shop owner can see, in the connect dialog and in the settings
   * panel, that silently changes WHOSE TOWN a scan names is the kind of thing a
   * demo is judged on. It is one predicate now, and this is the case that says
   * so with the switch in the position that broke it.
   */
  it("still uses the shop's own origin when the demo switch is off", async () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
    const FROM = { ...DEMO_ORIGIN, name: "The shop the host passed", city: "Saltburn" };

    const impl = carrier();
    const [rate] = await impl.quote(parcel, FROM, TO);
    // What the fill does at the mount site: hand the route over, then book.
    rememberRoute("SAMPLE-1", FROM, TO);
    const shipment = await impl.book(rate!, { reference: "SAMPLE-1" });

    const places = (await impl.track(shipment.tracking)).map((e) => e.place);
    expect(places).toContain("Saltburn");
    expect(places).toContain("Saltburn depot");
    expect(places.join(" · ")).not.toContain(DEMO_ORIGIN.city);

    // The two that had the same split: a booking made in this state is one the
    // add-on can still find, and its label is one it can still hand over.
    expect(findShipment("SAMPLE-1")?.tracking).toBe(shipment.tracking);
    expect(labels()).not.toBeNull();
  });

  it("is one instance per page, so a booking is visible on both surfaces", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    await impl.book(rate!, { reference: "SAMPLE-1" });
    // The works booked it on the dispatch screen; the customer's order view
    // asks the same seam and finds it.
    expect(findShipment("SAMPLE-1")?.tracking).toBe(FIRST_TRACKING);
    expect(findShipment("SAMPLE-2")).toBeUndefined();
  });

  /**
   * THE CLOCK IS THE HOST'S, AND THIS IS THE TEST THAT SAYS SO.
   *
   * `PINNED_NOW` used to be read straight out of `clock.ts` by the dispatch
   * screen and by the transport, under a comment claiming it was "the same
   * instant the host app is pinned to". It was — for the ONE host it was
   * written against. Mounted in a shop pinned to the following afternoon, the
   * add-on dated a collection window to the day before, stamped a "picked up"
   * scan before the order existed, and told a maker at 16:40 that the driver
   * was still coming, because the cut-off was compared against 10:20.
   *
   * None of that threw and no build went red, which is why it is asserted here
   * rather than trusted: what a host says the day is, is the day.
   */
  it("dates everything from the HOST's clock, not its own pin", async () => {
    const BIRCH_ROW = { iso: "2026-08-06", hour: 16, minute: 40 };
    setHostClock(BIRCH_ROW);
    expect(shopClock()).toEqual(BIRCH_ROW);

    const impl = carrier();
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    const shipment = await impl.book(rate!, { reference: "SAMPLE-1" });

    // The collection cannot be BEFORE the shop's today. It was, by a day, in
    // every host but the one this add-on was born in.
    expect(shipment.collectionFrom.slice(0, 10) >= BIRCH_ROW.iso).toBe(true);
    // And the first scan is on or after the day the shop is standing in.
    const events = await impl.track(shipment.tracking);
    expect(events[0]!.at.slice(0, 10) >= BIRCH_ROW.iso).toBe(true);
  });

  it("keeps a booking when the host repeats the clock it already gave", async () => {
    // The fills push the clock from an effect, which re-runs whenever the shop's
    // day moves and whenever a fill remounts. Rebuilding the transport each time
    // would mint a second tracking reference and lose the shipment the shop had
    // just booked, so an unchanged clock must be a no-op.
    setHostClock({ iso: "2026-08-06", hour: 16, minute: 40 });
    const impl = carrier();
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    await impl.book(rate!, { reference: "SAMPLE-1" });
    setHostClock({ iso: "2026-08-06", hour: 16, minute: 40 });
    expect(findShipment("SAMPLE-1")?.tracking).toBe(FIRST_TRACKING);
  });

  it("falls back to this repo's own pin with no host to ask", () => {
    // A standalone harness and this suite have no host. The pin is the
    // fallback; what it is no longer allowed to be is the ANSWER.
    expect(shopClock()).toEqual(PINNED_NOW);
  });

  it("starts the counter over when the runtime is reset", async () => {
    const first = carrier();
    const [rate] = await first.quote(parcel, DEMO_ORIGIN, TO);
    await first.book(rate!, { reference: "SAMPLE-1" });
    resetRuntime();
    const second = carrier();
    const [again] = await second.quote(parcel, DEMO_ORIGIN, TO);
    const shipment = await second.book(again!, { reference: "SAMPLE-1" });
    expect(shipment.tracking).toBe(FIRST_TRACKING);
  });
});
