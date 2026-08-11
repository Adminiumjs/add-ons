/**
 * The three pure engines: the clock, the parcel and the rate card.
 *
 * THE PARCEL BLOCK USED TO ASSERT ANOTHER APP'S ARITHMETIC — press-sheet
 * imposition, paper grammages, a size table keyed by one shop's preset names —
 * because the engine held all of it. It does not any more: the shop says what
 * one of a thing weighs and how big it is, and this says what a parcel of them
 * weighs and what box it goes in. So what is asserted here is what carriage
 * actually turns on, and every case is driven with a plain item that could have
 * come out of either host.
 */

import { describe, expect, it } from "vitest";

import {
  addWorkingDays,
  collectionDay,
  dispatchDay,
  isWorkingDay,
  nextWorkingDay,
  parseTime,
  PINNED_NOW,
  workingDaysBetween,
} from "./clock.ts";
import type { CatalogueSample, SlotItem } from "@adminium/add-on-host";
import { ASSUMED_UNIT_GRAMS, parcelFor, parcelForSample } from "./parcel.ts";
import {
  chargeableKg,
  cheapestCode,
  postponedTo,
  priceCents,
  quoteAll,
  SERVICES,
  zoneFor,
} from "./rates.ts";

describe("the clock", () => {
  it("is pinned to the works' own Wednesday", () => {
    expect(PINNED_NOW).toEqual({ iso: "2026-08-05", hour: 10, minute: 20 });
  });

  it("counts Monday to Friday and steps over a weekend", () => {
    expect(isWorkingDay("2026-08-05")).toBe(true);
    expect(isWorkingDay("2026-08-08")).toBe(false);
    expect(isWorkingDay("2026-08-09")).toBe(false);
    // Friday's next working day is Monday.
    expect(nextWorkingDay("2026-08-07")).toBe("2026-08-10");
    expect(addWorkingDays("2026-08-05", 2)).toBe("2026-08-07");
    expect(addWorkingDays("2026-08-06", 2)).toBe("2026-08-10");
  });

  it("resolves a date the same way wherever the shop's laptop is standing", () => {
    // The UTC-midnight rule: a local `new Date('2026-08-05')` west of Greenwich
    // is the 4th, and a delivery date must not slide by a timezone.
    expect(nextWorkingDay("2026-08-05")).toBe("2026-08-06");
  });

  it("reads a cut-off, and refuses one that is not a time", () => {
    expect(parseTime("15:00")).toBe(900);
    expect(parseTime("9:05")).toBe(545);
    expect(parseTime("25:00")).toBeNull();
    expect(parseTime("half past three")).toBeNull();
  });

  it("puts the van on today before the cut-off and tomorrow after it", () => {
    expect(collectionDay(PINNED_NOW, "15:00")).toBe("2026-08-05");
    expect(collectionDay({ iso: "2026-08-05", hour: 15, minute: 1 }, "15:00")).toBe("2026-08-06");
    // Saturday is nobody's collection day whatever the clock says.
    expect(collectionDay({ iso: "2026-08-08", hour: 9, minute: 0 }, "15:00")).toBe("2026-08-10");
  });
});

describe("the parcel", () => {
  /** One line of goods, as either host would hand it over. */
  const item = (over: Partial<SlotItem> = {}): SlotItem => ({
    id: "l1",
    key: "thing",
    label: "Thing",
    quantity: 500,
    unitWeightGrams: 2.4,
    unitSize: { widthMm: 85, heightMm: 55 },
    ...over,
  });

  it("weighs the goods the shop declared, plus wrap and the box", () => {
    const parcel = parcelFor([item()]);
    // 500 × 2.4g = 1.2kg of goods, +8% wrap, + a 0.25kg box → 1.5kg.
    expect(parcel.weightKg).toBe(1.5);
    expect(parcel.from.quantity).toBe(500);
    expect(parcel.from.unitGrams).toBe(2.4);
    expect(parcel.from.assumed).toEqual([]);
  });

  it("SAYS SO when the shop declared no weight, rather than looking measured", () => {
    // The property that matters is not the number — it is that the estimate
    // carries the list of lines it guessed for, so the screen can print it and
    // the works can correct it. An assumed figure indistinguishable from a
    // declared one is the defect this field exists to prevent.
    const parcel = parcelFor([item({ unitWeightGrams: undefined, quantity: 2 })]);
    expect(parcel.from.assumed).toEqual(["Thing"]);
    expect(parcel.from.unitGrams).toBe(ASSUMED_UNIT_GRAMS);
    expect(parcel.weightKg).toBeGreaterThan(0.5);
  });

  it("takes a host that weighs nothing at all without throwing", () => {
    // A shop that sells appointments is not a broken host. It gets an estimate
    // and a list of everything the estimate assumed.
    const nothing: readonly SlotItem[] = [
      { id: "a", key: "a", label: "One", quantity: 1 },
      { id: "b", key: "b", label: "Two", quantity: 3 },
    ];
    const parcel = parcelFor(nothing);
    expect(parcel.from.assumed).toEqual(["One", "Two"]);
    expect(parcel.weightKg).toBeGreaterThan(0);
  });

  it("rolls anything too long for a box into a tube", () => {
    const parcel = parcelFor([
      item({ quantity: 2, unitWeightGrams: 1200, unitSize: { widthMm: 850, heightMm: 2000 } }),
    ]);
    expect(parcel.from.rolled).toBe(true);
    expect(parcel.lengthCm).toBe(205);
    expect(parcel.widthCm).toBe(16);
    expect(parcel.weightKg).toBeGreaterThan(2);
  });

  it("grows the box for something wider than the box the weight chose", () => {
    // Light but awkward: a single large sheet needs a big box rather than a
    // strong one, and sizing on weight alone gave it a 32cm one.
    const parcel = parcelFor([
      item({ quantity: 1, unitWeightGrams: 40, unitSize: { widthMm: 420, heightMm: 297 } }),
    ]);
    expect(parcel.from.rolled).toBe(false);
    expect(parcel.lengthCm).toBe(46);
  });

  it("puts a whole basket in ONE box rather than one box per line", () => {
    const one = parcelFor([item()]);
    const three = parcelFor([item(), item({ id: "l2" }), item({ id: "l3" })]);
    expect(three.weightKg).toBeGreaterThan(one.weightKg);
    /*
     * THE PROPERTY, and it is about the packing rather than the goods: three
     * lines carry the box's weight ONCE, so the total is less than three
     * single-line parcels. A checkout that added a box per line quotes a
     * customer for a parcel nobody is going to send.
     */
    expect(three.weightKg).toBeLessThan(one.weightKg * 3);
    expect(three.from.lines).toBe(3);
    expect(three.from.quantity).toBe(1500);
  });

  it("answers a catalogue sample with the same engine the dispatch screen uses", () => {
    // ONE piece of arithmetic. A settings form quoting a weight the dispatch
    // screen disagrees with is worse than a settings form with no table at all.
    const sample: CatalogueSample = {
      key: "thing",
      label: "Thing",
      quantity: 500,
      unitWeightGrams: 2.4,
      unitSize: { widthMm: 85, heightMm: 55 },
    };
    expect(parcelForSample(sample).weightKg).toBe(parcelFor([item()]).weightKg);
  });
});

describe("the rate card", () => {
  const parcel = { weightKg: 1.8, lengthCm: 34, widthCm: 26, heightCm: 12 };

  it("charges on the box when the box is bigger than the weight", () => {
    // 34 × 26 × 12 / 5000 = 2.12kg volumetric against 1.8kg actual, rounded up
    // to the next half kilo the way a carrier does.
    expect(chargeableKg(parcel)).toBe(2.5);
    expect(chargeableKg({ weightKg: 9, lengthCm: 10, widthCm: 10, heightCm: 10 })).toBe(9);
  });

  it("reads the zone off the route, not off the destination alone", () => {
    expect(zoneFor("GB", "GB")).toBe("domestic");
    expect(zoneFor("GB", "IE")).toBe("near");
    expect(zoneFor("GB", "AU")).toBe("far");
    expect(zoneFor("ie", "IE")).toBe("domestic");
  });

  it("prices the three services in whole cents", () => {
    const [exp1200, expNwd, eco] = SERVICES;
    expect(priceCents(exp1200!, 2.5, "domestic")).toBe(1890);
    expect(priceCents(expNwd!, 2.5, "domestic")).toBe(1143);
    expect(priceCents(eco!, 2.5, "domestic")).toBe(663);
    expect(Number.isInteger(priceCents(eco!, 2.5, "near"))).toBe(true);
  });

  it("orders cheapest first and marks exactly one row", () => {
    const rates = quoteAll({ parcel, zone: "domestic", collected: "2026-08-05", currency: "USD" });
    expect(rates.map((r) => r.amount)).toEqual([6.63, 11.43, 18.9]);
    expect(cheapestCode(rates)).toBe("ECO-2WD");
    expect(rates.filter((r) => r.code === cheapestCode(rates))).toHaveLength(1);
    expect(cheapestCode([])).toBeNull();
  });

  it("costs more the further it goes, on the same parcel", () => {
    const at = (zone: "domestic" | "near" | "far") =>
      quoteAll({ parcel, zone, collected: "2026-08-05", currency: "USD" })[0]!.amount;
    expect(at("near")).toBeGreaterThan(at("domestic"));
    expect(at("far")).toBeGreaterThan(at("near"));
  });

  /**
   * THE DATE THAT CONTRADICTED THE ONE ABOVE IT.
   *
   * Birch Row makes to order: its own basket says "posted by Mon 10 Aug" and
   * this panel, quoting transit from today, said "arrives Fri 7 Aug" directly
   * underneath. Both numbers were computed correctly; the payload simply had
   * nowhere to say that the studio cannot post something it has not made.
   */
  it("counts transit from the day the shop can post, not from today", () => {
    const wednesday = { iso: "2026-08-05", hour: 10, minute: 20 };
    const cutoff = "15:00";

    // Nothing to make: unchanged, and passing no ready date means the same as
    // passing today's.
    expect(dispatchDay(wednesday, cutoff)).toBe("2026-08-05");
    expect(dispatchDay(wednesday, cutoff, "2026-08-05")).toBe("2026-08-05");
    // A ready date already past is not a special case — it is just earlier.
    expect(dispatchDay(wednesday, cutoff, "2026-07-30")).toBe("2026-08-05");

    // Four studio days: the carrier's rules still apply on top, so a ready date
    // on a Saturday becomes the Monday.
    expect(dispatchDay(wednesday, cutoff, "2026-08-10")).toBe("2026-08-10");
    expect(dispatchDay(wednesday, cutoff, "2026-08-08")).toBe("2026-08-10");

    // And the cut-off is not overruled by an early ready date: booked at 16:20
    // with nothing to make, the van comes tomorrow.
    expect(dispatchDay({ ...wednesday, hour: 16 }, cutoff, "2026-08-05")).toBe("2026-08-06");
  });

  it("pushes every arrival by the working days the parcel waits, and no price", () => {
    const rates = quoteAll({ parcel, zone: "domestic", collected: "2026-08-05", currency: "USD" });
    expect(rates.map((r) => r.estimatedDelivery)).toEqual([
      "2026-08-07",
      "2026-08-06",
      "2026-08-06",
    ]);

    const moved = postponedTo(rates, "2026-08-05", "2026-08-10");
    expect(workingDaysBetween("2026-08-05", "2026-08-10")).toBe(3);
    expect(moved.map((r) => r.estimatedDelivery)).toEqual([
      "2026-08-12",
      "2026-08-11",
      "2026-08-11",
    ]);
    // The carrier's rate card is the carrier's. Waiting to post costs nothing.
    expect(moved.map((r) => r.amount)).toEqual(rates.map((r) => r.amount));

    // Same day in and out: a copy, not a shift.
    expect(postponedTo(rates, "2026-08-05", "2026-08-05")).toEqual([...rates]);
    expect(workingDaysBetween("2026-08-10", "2026-08-05")).toBe(0);
  });
});
