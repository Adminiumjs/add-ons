// @vitest-environment jsdom
/** The return label: for the owner, on a return, from real figures, and never bought twice by an unclear answer. */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RecordActionsPayload } from "@adminium/add-on-host";
import { EngineCarrierError, type EngineAccess, type EngineBooking, type EngineCarrier } from "@adminium/add-on-host/engine-carrier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { kitBrand } from "../brand.ts";
import { EngineReturnLabel } from "./EngineReturnLabel.tsx";

const ACCESS = { appUpdated: true, carrier: "shipping-shippo", activeHere: true, mode: "live", manages: true, mayBook: true, mayCancel: true, mayCustoms: true, mayShipAbroad: true, shipsAbroad: false, pricesHidden: false, booking: "open" } as EngineAccess;
const RATE = { rateId: "r1", code: "evri", service: "Evri 48", priced: true, amountDecimal: "3.10", currency: "GBP", withinLimit: true };
const payload = (over: Partial<RecordActionsPayload> = {}) => ({ entity: "return", recordId: "7", record: { number: "RT-7" }, order: { table: "orders", id: "42" }, ...over }) as unknown as RecordActionsPayload;

function client(over: Partial<EngineCarrier> = {}, access = ACCESS) {
  const fake = {
    key: kitBrand().addOnKey,
    addOnKey: kitBrand().addOnKey,
    access: vi.fn(async () => access),
    bookings: vi.fn(async () => ({ bookings: [] as EngineBooking[], bookable: true, blockedBy: null, parcelNumber: 1 })),
    quote: vi.fn(async () => ({ quoteId: "q1", mode: "live", rates: [RATE] })),
    book: vi.fn(async () => { throw new Error("socket hang up"); }),
    ...over,
  } as unknown as EngineCarrier;
  connectEngineCarrier(fake);
  return fake;
}

beforeEach(() => {
  resetRuntime();
});
afterEach(cleanup);

describe("a return label", () => {
  it("draws nothing for someone who is not the owner, or on another record", async () => {
    const fake = client({}, { ...ACCESS, manages: false });
    const { container } = render(<EngineReturnLabel payload={payload()} />);
    await waitFor(() => expect(fake.access).toHaveBeenCalled());
    expect(container.textContent).toBe("");
    cleanup();
    const other = render(<EngineReturnLabel payload={payload({ entity: "invoice" })} />);
    expect(other.container.textContent).toBe("");
  });

  it("asks for real figures, names the return, and says when it is charged", async () => {
    const fake = client();
    render(<EngineReturnLabel payload={payload()} />);
    await screen.findByTestId("engine-return");
    expect(screen.getByTestId("engine-return").textContent).toContain("charged when it is made");
    fireEvent.click(screen.getByTestId("engine-return-rates"));
    expect(await screen.findByTestId("engine-return-fault")).toBeTruthy();
    expect(fake.quote).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("engine-return-weight"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByTestId("engine-return-size"), { target: { value: "30x20x10" } });
    fireEvent.click(screen.getByTestId("engine-return-rates"));
    await screen.findByTestId("engine-return-buy");
    expect(fake.quote).toHaveBeenCalledWith(expect.objectContaining({ purpose: "return", returnId: "7", source: { table: "orders", id: "42" } }));
  });

  it("says in plain words that a return from abroad cannot be booked yet", async () => {
    client({ quote: vi.fn(async () => { throw new EngineCarrierError({ code: "CUSTOMS_ONE_PARCEL", message: "engine words", status: 422, retryable: false, outcome: "refused" }); }) } as never);
    render(<EngineReturnLabel payload={payload()} />);
    await screen.findByTestId("engine-return");
    fireEvent.change(screen.getByTestId("engine-return-weight"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByTestId("engine-return-size"), { target: { value: "30x20x10" } });
    fireEvent.click(screen.getByTestId("engine-return-rates"));
    expect((await screen.findByTestId("engine-return-fault")).textContent).toContain("from abroad");
  });

  it("treats a lost answer as unclear and offers no second purchase", async () => {
    const unknown = { id: "b1", state: "unknown", purpose: "return", parcelNumber: 1, test: false } as EngineBooking;
    const bookings = vi.fn().mockResolvedValueOnce({ bookings: [], bookable: true, blockedBy: null, parcelNumber: 1 }).mockResolvedValue({ bookings: [unknown], bookable: false, blockedBy: "booking", parcelNumber: 1 });
    const fake = client({ bookings } as never);
    render(<EngineReturnLabel payload={payload()} />);
    await screen.findByTestId("engine-return");
    fireEvent.change(screen.getByTestId("engine-return-weight"), { target: { value: "1.2" } });
    fireEvent.change(screen.getByTestId("engine-return-size"), { target: { value: "30x20x10" } });
    fireEvent.click(screen.getByTestId("engine-return-rates"));
    fireEvent.click(await screen.findByTestId("engine-return-buy"));
    expect(await screen.findByTestId("engine-return-unclear")).toBeTruthy();
    expect(fake.book).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("engine-return-buy")).toBeNull();
  });
});
