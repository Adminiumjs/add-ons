/** The rules that decide what a person may press, on their own. */
import type { EngineBooking } from "@adminium/add-on-host/engine-carrier";
import { describe, expect, it } from "vitest";

import {
  contentsFor,
  firstPick,
  holderOf,
  moneyText,
  needsConfirm,
  nextParcel,
  outboundIn,
  ownerBooksAll,
  quietPassed,
  readFigure,
  readSize,
  readWeight,
  refusalCardOf,
  speedFit,
  type EngineRate,
} from "./flow.ts";

const rate = (over: Partial<EngineRate>): EngineRate =>
  ({ rateId: "r", code: "c", service: "S", withinLimit: true, priced: false, ...over }) as EngineRate;

const booking = (over: Partial<EngineBooking>): EngineBooking => ({
  id: "b",
  state: "booked",
  test: false,
  purpose: "outbound",
  parcelNumber: 1,
  carrier: "shipping-test",
  service: "S",
  tracking: null,
  carrierName: null,
  reason: null,
  duplicates: 0,
  createdAt: 1,
  calledAt: null,
  checkedAt: null,
  releaseAfter: null,
  applied: false,
  label: { state: "none", size: null, sizeGot: null, sizeDiffers: false, customsInvoice: false, customsInvoiceOwed: false },
  ...over,
});

describe("a typed figure is read or refused, never guessed", () => {
  it("refuses what the lenient reader would have turned into a number", () => {
    for (const bad of ["abc", "3kg", "1,5", "", "-1", "1 2"]) expect(readFigure(bad, "."), bad).toBeNull();
  });

  it("reads the reader's own digits and decimal mark", () => {
    expect(readFigure("٠٫٥", "٫")).toBe(0.5);
    expect(readFigure("0,5", ",")).toBe(0.5);
  });

  it("refuses a point where the decimal mark is a comma, because 1.500 means fifteen hundred there", () => {
    expect(readFigure("1.500", ",")).toBeNull();
  });

  it("holds the engine's limits", () => {
    expect(readWeight("0", ".")).toEqual({ ok: false, fault: "range" });
    expect(readWeight("1001", ".")).toEqual({ ok: false, fault: "range" });
    expect(readWeight("x", ".")).toEqual({ ok: false, fault: "format" });
    expect(readSize("30 × 20", ".")).toEqual({ ok: false, fault: "format" });
    expect(readSize("401 x 1 x 1", ".")).toEqual({ ok: false, fault: "range" });
    expect(readSize("30 × 20 × 5", ".")).toEqual({ ok: true, lengthCm: 30, widthCm: 20, heightCm: 5 });
  });

  it("never sends empty or over-long contents", () => {
    expect(contentsFor("  ", "MP-1")).toBe("MP-1");
    expect([...contentsFor("x".repeat(300), "MP-1")]).toHaveLength(200);
  });
});

describe("what the customer paid for", () => {
  const speed = { label: "Tracked, next day", maxDays: 1, tracked: true };

  it("tests speed and tracking together", () => {
    expect(speedFit({ estimatedDays: 1, tracked: true }, speed)).toBe("keeps");
    expect(speedFit({ estimatedDays: 3, tracked: true }, speed)).toBe("slower");
    expect(speedFit({ estimatedDays: 1, tracked: false }, speed)).toBe("untracked");
    expect(speedFit({ tracked: true }, speed)).toBe("unstated");
    expect(speedFit({ estimatedDays: 1 }, speed)).toBe("unstated");
    expect(speedFit({ estimatedDays: 9 }, undefined)).toBeNull();
  });

  it("asks for a deliberate confirm on everything but a service that keeps it", () => {
    expect(needsConfirm("keeps")).toBe(false);
    expect(needsConfirm(null)).toBe(false);
    for (const fit of ["slower", "untracked", "unstated"] as const) expect(needsConfirm(fit)).toBe(true);
  });

  it("never starts on a service that needs a confirm, or one above the limit", () => {
    const slow = rate({ rateId: "slow", code: "slow", estimatedDays: 5, tracked: true });
    const above = rate({ rateId: "above", code: "above", estimatedDays: 1, tracked: true, withinLimit: false });
    expect(firstPick([slow, above], speed, "slow")).toBeNull();
    const good = rate({ rateId: "good", code: "good", estimatedDays: 1, tracked: true });
    expect(firstPick([slow, above, good], speed, null)).toBe("good");
  });

  it("gives the panel to the owner when every service that keeps it is above the limit", () => {
    const above = rate({ rateId: "above", estimatedDays: 1, tracked: true, withinLimit: false });
    const slow = rate({ rateId: "slow", estimatedDays: 5, tracked: true });
    expect(ownerBooksAll([above, slow], speed)).toBe("keepers");
    expect(ownerBooksAll([above], undefined)).toBe("all");
    expect(ownerBooksAll([slow], undefined)).toBeNull();
  });
});

describe("which booking holds a parcel", () => {
  it("is never a refused or released one", () => {
    expect(holderOf([booking({ state: "refused" }), booking({ id: "c", state: "released" })], 1)).toBeNull();
    expect(holderOf([booking({ state: "unknown" })], 1)?.state).toBe("unknown");
  });

  it("keeps test and live labels apart", () => {
    const list = [booking({ id: "t", test: true }), booking({ id: "l" }), booking({ id: "r", purpose: "return" })];
    expect(outboundIn(list, "live").map((one) => one.id)).toEqual(["l"]);
    expect(outboundIn(list, "test").map((one) => one.id)).toEqual(["t"]);
  });

  it("gives an added parcel the first free number", () => {
    expect(nextParcel([booking({})])).toBe(2);
    expect(nextParcel([booking({ parcelNumber: 2 })])).toBe(1);
  });

  it("reads the quiet period from the server's own stamp", () => {
    expect(quietPassed({ releaseAfter: 100, checkedAt: null })).toBe(false);
    expect(quietPassed({ releaseAfter: 100, checkedAt: 99 })).toBe(false);
    expect(quietPassed({ releaseAfter: 100, checkedAt: 100 })).toBe(true);
    expect(quietPassed({ releaseAfter: null, checkedAt: 100 })).toBe(false);
  });
});

describe("refusals and money", () => {
  it("maps the engine's code before the carrier's reason", () => {
    expect(refusalCardOf("CSRF_FAILED", "address")).toBe("csrf");
    expect(refusalCardOf("CARRIER_REFUSED", "payment")).toBe("payment");
    expect(refusalCardOf("CARRIER_REFUSED", "credentials")).toBe("key");
    expect(refusalCardOf("CARRIER_REFUSED", undefined)).toBe("other");
  });

  it("keeps every digit it was quoted", () => {
    expect(moneyText("3.575", "GBP", "en-US")).toBe("£3.575");
    expect(moneyText("4.2", "GBP", "en-US")).toBe("£4.20");
    expect(moneyText("500", "JPY", "en-US")).toBe("¥500");
  });
});
