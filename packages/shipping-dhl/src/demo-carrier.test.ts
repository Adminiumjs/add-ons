/**
 * The demo transport, under the contract's own suite and then under the
 * assertions that make it a DEMO rather than a mock.
 *
 * The seeded figures are asserted here because three places have to agree about
 * them — the comp, this transport and the screens — and the only way to keep
 * three things in step is to write the numbers down once, in a test that fails
 * when one of them moves.
 */

import { describe, expect, it } from "vitest";

import { PINNED_NOW } from "./clock.ts";
import { CarrierError, type Address } from "@adminium/add-on-host/contracts";
import { createDemoCarrier, POSTCODE_REFUSAL, postcodeFits } from "./demo-carrier.ts";
import { parcelFor } from "./parcel.ts";
import { DEMO_ORIGIN, FIRST_TRACKING, SAMPLE_ORDER } from "./seed.ts";
import { describeShippingCarrier } from "@adminium/add-on-host/testing";

const CUTOFF = "15:00";

/**
 * ADDRESSES BELONG TO THE HOST NOW, so a suite for the transport supplies its
 * own rather than reaching into an address book this add-on used to ship.
 * Everything here is shaped rather than borrowed: `TO` is somewhere ordinary,
 * and `REFUSED_TO` is the seeded failure — a GB postcode typed onto an IE
 * address, which the carrier's own postcode check is what rejects.
 */
const TO: Address = {
  name: "Kestrel Joinery",
  lines: ["The Joinery Shop", "Wold Lane"],
  city: "Nether Wold",
  postcode: "NW3 6BD",
  country: "GB",
};

const REFUSED_TO: Address = {
  name: "Two Rivers Cycles",
  lines: ["Unit 4, Canal Wharf"],
  city: "Dun Laoghaire",
  postcode: "ML9 4TT",
  country: "IE",
};

function parcel() {
  const estimate = parcelFor(SAMPLE_ORDER.items);
  return {
    weightKg: estimate.weightKg,
    lengthCm: estimate.lengthCm,
    widthCm: estimate.widthCm,
    heightCm: estimate.heightCm,
    contents: "500 × Sample goods",
  };
}

describeShippingCarrier(createDemoCarrier({ clock: PINNED_NOW, cutoff: CUTOFF }), {
  parcel: parcel(),
  from: DEMO_ORIGIN,
  to: TO,
  rejectedTo: REFUSED_TO,
  order: { reference: SAMPLE_ORDER.ref },
});

describe("demo carrier — the seeded figures", () => {
  const carrier = () => createDemoCarrier({ clock: PINNED_NOW, cutoff: CUTOFF });

  it("quotes three services, cheapest first, inside the seeded band", async () => {
    const rates = await carrier().quote(parcel(), DEMO_ORIGIN, TO);
    expect(rates.map((r) => r.code)).toEqual(["ECO-2WD", "EXP-NWD", "EXP-1200"]);
    expect(rates.map((r) => r.amount)).toEqual([6.63, 11.43, 18.9]);
    for (const rate of rates) {
      expect(rate.amount).toBeGreaterThanOrEqual(6.5);
      expect(rate.amount).toBeLessThanOrEqual(18.9);
      expect(rate.currency).toBe("USD");
    }
  });

  it("delivers on the next and second working day from the pinned Wednesday", async () => {
    const rates = await carrier().quote(parcel(), DEMO_ORIGIN, TO);
    const byCode = Object.fromEntries(rates.map((r) => [r.code, r.estimatedDelivery]));
    // Thursday 6 August for both express services, Friday 7 for economy.
    expect(byCode["EXP-1200"]).toBe("2026-08-06");
    expect(byCode["EXP-NWD"]).toBe("2026-08-06");
    expect(byCode["ECO-2WD"]).toBe("2026-08-07");
  });

  it("mints the seeded tracking reference first, then counts up", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel(), DEMO_ORIGIN, TO);
    const first = await impl.book(rate!, { reference: "MP-4126" });
    const second = await impl.book(rate!, { reference: "MP-4120" });
    expect(first.tracking).toBe(FIRST_TRACKING);
    expect(second.tracking).toBe("00 3400 1234 5678 9013");
    expect(first.tracking).toMatch(/^00 \d{4} \d{4} \d{4} \d{4}$/);
  });

  it("books the collection into the afternoon window of the pinned day", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel(), DEMO_ORIGIN, TO);
    const shipment = await impl.book(rate!, { reference: "MP-4126" });
    expect(shipment.collectionFrom).toBe("2026-08-05T14:00:00");
    expect(shipment.collectionTo).toBe("2026-08-05T17:00:00");
  });

  it("pushes the van to the next working day when the cut-off has passed", async () => {
    const late = createDemoCarrier({
      clock: { iso: "2026-08-07", hour: 16, minute: 5 },
      cutoff: CUTOFF,
    });
    const [rate] = await late.quote(parcel(), DEMO_ORIGIN, TO);
    const shipment = await late.book(rate!, { reference: "MP-4126" });
    // Friday after 15:00 — the next working day is Monday, not Saturday.
    expect(shipment.collectionFrom.slice(0, 10)).toBe("2026-08-10");
  });

  it("scans the SHOP'S OWN towns, not the transport's default ones", async () => {
    /*
     * The route travels with the booking, and the reason is a defect a second
     * host made visible: the scan lines read whichever origin the transport
     * happened to be CONSTRUCTED with, so a studio two hundred miles away
     * watched its parcel be collected from another shop's town, and the hub
     * was a place name out of the first app's fiction.
     */
    const SHOP = {
      name: "Birch Row",
      lines: ["Unit 6, Station Yard"],
      city: "Saltburn",
      postcode: "TS12 1HJ",
      country: "GB",
    };
    const impl = carrier();
    impl.rememberRoute("BR-2276", SHOP, TO);
    const [rate] = await impl.quote(parcel(), SHOP, TO);
    const shipment = await impl.book(rate!, { reference: "BR-2276" });
    const events = await impl.track(shipment.tracking);
    expect(events).toHaveLength(3);
    expect(events.map((e) => e.status)).toEqual(["collected", "at-hub", "out-for-delivery"]);
    expect(events[0]!.place).toBe(SHOP.city);
    expect(events[1]!.place).toBe(`${SHOP.city} depot`);
    expect(events[2]!.place).toBe(TO.city);
    // And not one town belonging to the transport's own fallback address.
    expect(JSON.stringify(events)).not.toContain(DEMO_ORIGIN.city);
  });

  it("makes a real PDF label whose bytes are stable across runs", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel(), DEMO_ORIGIN, TO);
    const shipment = await impl.book(rate!, { reference: "MP-4126" });
    const file = await impl.label(shipment.id);

    expect(file.mediaType).toBe("application/pdf");
    expect(file.filename).toBe("dhl-label-00-3400-1234-5678-9012.pdf");

    const bytes = impl.labels.read(file.fileId);
    expect(bytes?.startsWith("%PDF-1.4")).toBe(true);
    expect(bytes?.endsWith("%%EOF\n")).toBe(true);
    expect(bytes?.length).toBe(file.bytes);

    // A label that could be mistaken for a real one is the failure this line
    // guards against: it says so on the page, in the first row of text.
    expect(bytes).toContain("DEMO LABEL - NOT VALID FOR CARRIAGE");

    // Determinism, stated as bytes: a second carrier booking the same job must
    // produce the identical file, which is what lets `bytes` be asserted at all.
    const twin = carrier();
    const [twinRate] = await twin.quote(parcel(), DEMO_ORIGIN, TO);
    const twinShipment = await twin.book(twinRate!, { reference: "MP-4126" });
    expect(twin.labels.read(twinShipment.labelFileId)).toBe(bytes);
  });

  it("refuses the seeded address with the carrier's own words, verbatim", async () => {
    await expect(carrier().quote(parcel(), DEMO_ORIGIN, REFUSED_TO)).rejects.toThrow(
      POSTCODE_REFUSAL,
    );
    try {
      await carrier().quote(parcel(), DEMO_ORIGIN, REFUSED_TO);
      expect.unreachable("the seeded refusal should have thrown");
    } catch (err) {
      const carrierError = err as CarrierError;
      expect(carrierError).toBeInstanceOf(CarrierError);
      expect(carrierError.carrierMessage).toBe(POSTCODE_REFUSAL);
      expect(carrierError.code).toBe("POSTCODE_NOT_FOUND");
      // Retryable: the works fixes the postcode and books. A refusal the works
      // cannot act on would be a different, worse screen.
      expect(carrierError.retryable).toBe(true);
    }
  });

  it("quotes once the refused address is corrected — the retry is real", async () => {
    const fixed: Address = { ...REFUSED_TO, postcode: "A96 X4T2" };
    const rates = await carrier().quote(parcel(), DEMO_ORIGIN, fixed);
    expect(rates.length).toBe(3);
    // Crossing a border costs more; the same parcel domestically was $6.63.
    expect(rates[0]!.amount).toBeGreaterThan(6.63);
  });

  it("checks a postcode against its country and nothing else", () => {
    expect(postcodeFits("NW3 6BD", "GB")).toBe(true);
    expect(postcodeFits("ML9 4TT", "IE")).toBe(false);
    expect(postcodeFits("A96 X4T2", "IE")).toBe(true);
    // A country the carrier has no format for is accepted rather than guessed at.
    expect(postcodeFits("anything", "JP")).toBe(true);
    expect(postcodeFits("   ", "GB")).toBe(false);
  });

  it("cancels a booking and forgets it, so the order can be booked again", async () => {
    const impl = carrier();
    const [rate] = await impl.quote(parcel(), DEMO_ORIGIN, TO);
    const shipment = await impl.book(rate!, { reference: "MP-4126" });
    await impl.cancel(shipment.id);
    expect(impl.find("MP-4126")).toBeUndefined();
    await expect(impl.track(shipment.tracking)).resolves.toEqual([]);
    // Cancelling twice is not an error — the collection is not happening either way.
    await expect(impl.cancel(shipment.id)).resolves.toBeUndefined();
  });

  it("makes no real call and reads no real clock", async () => {
    // The strongest form of this assertion is a grep over the sources, which
    // `sources.test.ts` runs. Here it is behavioural: two carriers built from
    // the same pinned clock cannot disagree, which they would if either read
    // `Date.now()` between the two constructions.
    const a = createDemoCarrier({ clock: PINNED_NOW, cutoff: CUTOFF });
    const b = createDemoCarrier({ clock: PINNED_NOW, cutoff: CUTOFF });
    expect(await a.quote(parcel(), DEMO_ORIGIN, TO)).toEqual(
      await b.quote(parcel(), DEMO_ORIGIN, TO),
    );
  });
});
