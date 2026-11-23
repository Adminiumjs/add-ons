// @vitest-environment jsdom
/** The refund states as a person meets them: what each offers, and what it refuses to promise. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EngineAccess, EngineBooking, EngineCarrier, EngineRefund } from "@adminium/add-on-host/engine-carrier";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RefundBlock, RefundedCard } from "./RefundBlock.tsx";

const ACCESS = { appUpdated: true, carrier: "shipping-shippo", activeHere: true, mode: "live", manages: true, mayBook: true, mayCancel: true, mayCustoms: true, pricesHidden: false, booking: "open" } as EngineAccess;
const REFUND: EngineRefund = { state: null, askedAt: null, settledAt: null, heardAt: null, unconfirmed: false, expectedBy: null, claimBy: Date.UTC(2026, 8, 16, 23, 59), tooLate: false, scanned: false, canRequest: true, message: null };
const booking = (refund: Partial<EngineRefund>, over: Partial<EngineBooking> = {}): EngineBooking =>
  ({ id: "b1", state: "booked", test: false, purpose: "outbound", parcelNumber: 1, carrier: "shipping-shippo", service: "Evri 48", tracking: "T1", carrierName: "Evri", reason: null, duplicates: 0, createdAt: 1, calledAt: 1, checkedAt: null, releaseAfter: null, applied: true, label: { state: "ready", size: null, sizeGot: null, sizeDiffers: false, customsInvoice: false }, amount: "3.10", currency: "GBP", refund: { ...REFUND, ...refund }, ...over }) as EngineBooking;

function draw(shown: EngineBooking, client: Partial<EngineCarrier> = {}, access = ACCESS, onReplace?: () => void) {
  const onChange = vi.fn();
  render(<RefundBlock booking={shown} access={access} client={client as EngineCarrier} company="Shippo" say={() => undefined} onChange={onChange} onStale={() => undefined} onReplace={onReplace} />);
  return { onChange };
}

afterEach(cleanup);

describe("a refund on a label", () => {
  it("asks first, tells staff to destroy the label, and only then sends it", async () => {
    const requestRefund = vi.fn(async () => ({ outcome: "pending" as const, booking: booking({ state: "pending" }, { state: "voiding" }) }));
    const { onChange } = draw(booking({}), { requestRefund });
    fireEvent.click(screen.getByTestId("engine-refund-open"));
    expect(requestRefund).not.toHaveBeenCalled();
    expect(screen.getByTestId("engine-refund-facts").textContent).toContain("Destroy the old label");
    fireEvent.click(screen.getByTestId("engine-refund-confirm"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(requestRefund).toHaveBeenCalledTimes(1);
  });

  it("shows the real request date, promises no date, and blocks nothing it should not", () => {
    draw(booking({ state: "pending", askedAt: Date.UTC(2026, 7, 18), expectedBy: Date.UTC(2026, 8, 7) }, { state: "voiding" }));
    expect(screen.getByTestId("engine-refund-asked").textContent).toContain("18");
    expect(screen.getByTestId("engine-refund-expected").textContent).toContain("Expected by");
    expect(screen.queryByTestId("engine-refund-open")).toBeNull();
    expect(screen.getByTestId("engine-refund-check")).toBeTruthy();
  });

  it("offers no refund on a scanned label, and quotes the carrier's reason", () => {
    draw(booking({ state: "refused", scanned: true, canRequest: false, message: "Label was scanned by the carrier." }));
    expect(screen.queryByTestId("engine-refund-open")).toBeNull();
    expect(screen.getByTestId("engine-refund-refused").textContent).toContain("Label was scanned");
    expect(screen.getByTestId("engine-refund-scanned")).toBeTruthy();
  });

  it("says when the 30 days have passed", () => {
    draw(booking({ tooLate: true, canRequest: false }));
    expect(screen.getByTestId("engine-refund-too-late")).toBeTruthy();
    expect(screen.queryByTestId("engine-refund-open")).toBeNull();
  });

  it("tells someone without the right to ask the owner", () => {
    draw(booking({}), {}, { ...ACCESS, mayCancel: false, manages: false });
    expect(screen.queryByTestId("engine-refund-open")).toBeNull();
    expect(screen.getByText("Ask the owner about a refund.")).toBeTruthy();
  });

  it("warns that both labels are paid before booking another", () => {
    const onReplace = vi.fn();
    draw(booking({ state: "pending" }, { state: "voiding" }), {}, ACCESS, onReplace);
    fireEvent.click(screen.getByTestId("engine-refund-rebook"));
    expect(onReplace).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").textContent).toContain("you pay for both");
    fireEvent.click(screen.getByTestId("engine-refund-both-yes"));
    expect(onReplace).toHaveBeenCalledTimes(1);
  });

  it("names a credit on a later invoice, labels the price as the price, and shows no money on a test label", () => {
    render(<RefundedCard booking={booking({ state: "refunded" }, { state: "voided" })} access={ACCESS} />);
    expect(screen.getByTestId("engine-refund-credit").textContent).toContain("The label cost");
    cleanup();
    render(<RefundedCard booking={booking({ state: "refunded", amount: "2.90", currency: "GBP" }, { state: "voided" })} access={ACCESS} />);
    expect(screen.getByTestId("engine-refund-credit").textContent).toContain("2.90");
    cleanup();
    render(<RefundedCard booking={booking({ state: "refunded" }, { state: "voided", test: true })} access={ACCESS} />);
    expect(screen.getByTestId("engine-refund-credit").textContent).not.toMatch(/3\.10|£/);
  });
});
