// @vitest-environment jsdom
/** S39: a refused move becomes a question, and only the person's answer sends it again. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { EngineCarrier } from "@adminium/add-on-host/engine-carrier";
import { afterEach, describe, expect, it, vi } from "vitest";

import { kitBrand } from "../brand.ts";
import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { isPaidLabelStopped, PaidLabelHost, readPaidLabelRefusal, withPaidLabel } from "./PaidLabelDialog.tsx";

const SOURCE = { table: "orders", id: "7" };
const DAY = 24 * 60 * 60_000;
const label = (over: Record<string, unknown> = {}) => ({ booking: "b1", carrier: "UPS", parcel: 1, scanned: false, claimBy: Date.now() + 5 * DAY, canRequest: true, ...over });
const refused = (over: Record<string, unknown> = {}) =>
  Object.assign(new Error("This order has a paid label."), { code: "ORDER_HAS_PAID_LABEL", params: { from: "ready", to: "cancelled", mayKeep: true, labels: [label()], ...over } });

function connect(state = "voiding") {
  const requestRefund = vi.fn(async (id: string) => ({ outcome: state === "booked" ? "refused" : "requested", booking: { id, state } }));
  const bookings = vi.fn(async () => ({ bookings: [{ id: "b1", carrierName: "UPS", service: "Ground", amount: "8.40", currency: "USD" }] }));
  connectEngineCarrier({ addOnKey: kitBrand().addOnKey, requestRefund, bookings } as unknown as EngineCarrier);
  return { requestRefund, bookings };
}

/** A move the engine refuses until it is told which labels are kept, or until they stop being live. */
function moving(error: Error = refused()) {
  return vi.fn(async (keep: readonly string[]) => {
    if (moving.calls++ === 0) throw error;
    return keep;
  });
}
moving.calls = 0;

afterEach(() => {
  cleanup();
  resetRuntime();
  moving.calls = 0;
});

describe("readPaidLabelRefusal", () => {
  it("reads the staff refusal, and leaves a customer's or another error alone", () => {
    expect(readPaidLabelRefusal(refused())?.labels[0]?.booking).toBe("b1");
    expect(readPaidLabelRefusal(Object.assign(new Error("x"), { code: "ORDER_HAS_PAID_LABEL", params: {} }))).toBeNull();
    expect(readPaidLabelRefusal(Object.assign(new Error("x"), { code: "ROW_CHANGED", params: { to: "cancelled", labels: [label()] } }))).toBeNull();
  });
});

describe("withPaidLabel", () => {
  it("keeps the refusal when no host is mounted, so a move cannot hang", async () => {
    const error = refused();
    await expect(withPaidLabel(SOURCE, moving(error))).rejects.toBe(error);
  });

  it("keeps the label only on the person's answer, naming it", async () => {
    connect();
    render(<PaidLabelHost />);
    const attempt = moving();
    const result = withPaidLabel(SOURCE, attempt);
    fireEvent.click(await screen.findByTestId("paid-label-keep"));
    await expect(result).resolves.toEqual(["b1"]);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("requests the refund, then moves with nothing to keep", async () => {
    const { requestRefund } = connect();
    render(<PaidLabelHost />);
    const result = withPaidLabel(SOURCE, moving());
    fireEvent.click(await screen.findByTestId("paid-label-refund"));
    await expect(result).resolves.toEqual([]);
    expect(requestRefund).toHaveBeenCalledWith("b1");
  });

  it("does not move when the refund was refused", async () => {
    connect("booked");
    render(<PaidLabelHost />);
    const attempt = moving();
    void withPaidLabel(SOURCE, attempt).catch(() => undefined);
    fireEvent.click(await screen.findByTestId("paid-label-refund"));
    await screen.findByTestId("paid-label-fault");
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("starts on Go back, which moves nothing", async () => {
    connect();
    render(<PaidLabelHost />);
    const attempt = moving();
    const result = withPaidLabel(SOURCE, attempt).catch((error: unknown) => error);
    const back = await screen.findByTestId("paid-label-back");
    await waitFor(() => expect(document.activeElement).toBe(back));
    fireEvent.click(back);
    expect(isPaidLabelStopped(await result)).toBe(true);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  it("offers someone who may not keep it nothing but Go back", async () => {
    connect();
    render(<PaidLabelHost />);
    void withPaidLabel(SOURCE, moving(refused({ mayKeep: false }))).catch(() => undefined);
    await screen.findByTestId("paid-label-back");
    expect(screen.queryByTestId("paid-label-keep")).toBeNull();
    expect(screen.queryByTestId("paid-label-refund")).toBeNull();
    fireEvent.click(screen.getByTestId("paid-label-back"));
  });

  it("offers no refund on a scanned label, and shows the price only when the engine sent it", async () => {
    connect();
    render(<PaidLabelHost />);
    void withPaidLabel(SOURCE, moving(refused({ labels: [label({ scanned: true, canRequest: false })] }))).catch(() => undefined);
    await screen.findByTestId("paid-label-keep");
    expect(screen.queryByTestId("paid-label-refund")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("paid-label-line").textContent).toContain("$8.40"));
    fireEvent.click(screen.getByTestId("paid-label-back"));
  });
});
