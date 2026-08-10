/**
 * The three pure engines: the clock, the parcel and the rate card.
 *
 * Two figures below are not this repo's to choose — the imposition numbers come
 * from the host's own engine (24 D5), and a parcel weight that disagreed with
 * the app's delivery band would be a defect the works notices before any test
 * does. They are asserted here for exactly that reason.
 */

import { describe, expect, it } from "vitest";

import {
  addWorkingDays,
  collectionDay,
  isWorkingDay,
  nextWorkingDay,
  parseTime,
  PINNED_NOW,
} from "./clock.ts";
import { parcelFor, parcelForBasket, sheetsFor, sizeOf } from "./parcel.ts";
import { chargeableKg, cheapestCode, priceCents, quoteAll, SERVICES, zoneFor } from "./rates.ts";

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
  it("reproduces the host's imposition, including the rotation that wins", () => {
    // 500 business cards 85 × 55 → 21 up on SRA3 → 24 sheets (24 D5).
    expect(sheetsFor(85, 55, 500)).toBe(24);
    // 250 A6 flyers → 6 up ROTATED, against 4 up upright → 42 sheets.
    expect(sheetsFor(105, 148, 250)).toBe(42);
  });

  it("weighs a boxed run of cards the way the host does, plus the box", () => {
    const parcel = parcelFor({
      productKey: "business-cards",
      materialKey: "silk-350",
      quantity: 500,
      trimWidthMm: 85,
      trimHeightMm: 55,
      packagingKey: "boxed",
    });
    // 24 sheets × 0.144m² × 350gsm = 1.21kg, +8% wrap, + a 0.45kg box.
    expect(parcel.weightKg).toBe(1.8);
    expect(parcel.from.sheets).toBe(24);
    expect(parcel.from.gsm).toBe(350);
    expect([parcel.lengthCm, parcel.widthCm, parcel.heightCm]).toEqual([34, 26, 12]);
  });

  it("sends roll work down a different arm, in a tube", () => {
    const parcel = parcelFor({
      productKey: "roll-up-banners",
      materialKey: "pvc-510",
      quantity: 2,
      trimWidthMm: 850,
      trimHeightMm: 2000,
      packagingKey: "boxed",
    });
    expect(parcel.from.sheets).toBeUndefined();
    expect(parcel.from.packagingKey).toBe("tube");
    expect(parcel.lengthCm).toBe(120);
    expect(parcel.weightKg).toBeGreaterThan(2);
  });

  it("puts a whole basket in one box rather than three", () => {
    const line = (quantity: number) => ({
      config: {
        product: "business-cards",
        material: "silk-350",
        size: "business-card",
        quantity,
        packaging: "boxed",
      },
    });
    const one = parcelForBasket([line(500)]);
    const three = parcelForBasket([line(500), line(500), line(500)]);
    expect(three.weightKg).toBeGreaterThan(one.weightKg);
    // The box gets taller, never wider.
    expect(three.widthCm).toBe(one.widthCm);
    expect(three.heightCm).toBeGreaterThan(one.heightCm);
  });

  it("resolves a preset size, and a custom one", () => {
    expect(sizeOf({ size: "a6" })).toEqual({ widthMm: 105, heightMm: 148 });
    expect(sizeOf({ size: "custom", customWidthMm: 400, customHeightMm: 600 })).toEqual({
      widthMm: 400,
      heightMm: 600,
    });
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
});
