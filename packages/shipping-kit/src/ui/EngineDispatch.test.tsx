// @vitest-environment happy-dom
/**
 * THE REAL BOOKING FLOW, drawn against a fake engine client.
 *
 * No carrier and no network. Each case holds one thing that would cost a shop
 * money or mislead a person if it broke: a second paid label, a price shown to
 * someone who may not see it, a test label that reads as real.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DispatchPayload } from "@adminium/add-on-host";
import {
  EngineCarrierError,
  ENGINE_NO_DOWNLOAD,
  type EngineAccess,
  type EngineBooking,
  type EngineBookings,
  type EngineCarrier,
  type EngineLookUpOutcome,
  type EngineQuote,
  type EngineRefreshOutcome,
} from "@adminium/add-on-host/engine-carrier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PINNED_NOW } from "../clock.ts";
import { strings, type StringKey } from "../i18n/strings.ts";
import { translate } from "../i18n/t.ts";
import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { DEMO_ORIGIN } from "../seed.ts";
import { applySettings, DEFAULT_SETTINGS } from "../settings.ts";
import { DispatchAction } from "./DispatchAction.tsx";

const words = (key: StringKey, params?: Record<string, string | number>) => translate("en-US", key, params);
const engineKey = (key: string) => `addon.shipping-kit.engine.${key}` as StringKey;

const ORDER: DispatchPayload["order"] = {
  ref: "NL-1059",
  source: { table: "orders", id: "1059" },
  recipient: { name: "Iris P.", key: "iris" },
  items: [{ id: "l1", key: "mug", label: "Stoneware mug", quantity: 2, unitWeightGrams: 240 }],
  origin: DEMO_ORIGIN,
  destination: { name: "Iris P.", lines: ["4 Mill Row"], city: "Colne", postcode: "BB8 9ZZ", country: "GB" },
  parcelWeightGrams: 900,
  deliveryPromise: { label: "Tracked, next day", maxDays: 1, tracked: true },
};

const ACCESS: EngineAccess = {
  appUpdated: true,
  carrier: "shipping-test",
  activeHere: true,
  mode: "live",
  manages: true,
  mayBook: true,
  mayCancel: true,
  mayCustoms: true,
  pricesHidden: false,
  booking: "open",
};

const PRICED: EngineQuote = {
  quoteId: "q1",
  carrier: "shipping-test",
  mode: "live",
  expiresAt: 9_999,
  pricesHidden: false,
  rates: [
    { rateId: "fast", code: "fast", service: "Next Day", priced: true, amountDecimal: "4.20", currency: "GBP", withinLimit: true, estimatedDays: 1, tracked: true, carrier: "Northway", handover: "drop-off" },
    { rateId: "slow", code: "slow", service: "Economy", priced: true, amountDecimal: "2.85", currency: "GBP", withinLimit: true, estimatedDays: 5, tracked: true, carrier: "Northway", handover: "carrier-collects" },
    { rateId: "vague", code: "vague", service: "Saver", priced: true, amountDecimal: "3.10", currency: "GBP", withinLimit: true, tracked: true, carrier: "Eastline", handover: "unknown" },
    { rateId: "dear", code: "dear", service: "Courier", priced: true, amountDecimal: "19.99", currency: "GBP", withinLimit: false, estimatedDays: 1, tracked: true, carrier: "Eastline", handover: "collection-booked" },
  ],
};

const PRICELESS: EngineQuote = {
  quoteId: "q2",
  carrier: "shipping-test",
  mode: "live",
  expiresAt: 9_999,
  pricesHidden: true,
  rates: [
    { rateId: "fast", code: "fast", service: "Next Day", priced: false, withinLimit: true, estimatedDays: 1, tracked: true, carrier: "Northway" },
    { rateId: "slow", code: "slow", service: "Economy", priced: false, withinLimit: true, estimatedDays: 5, tracked: true, carrier: "Northway" },
  ],
};

const booking = (over: Partial<EngineBooking> = {}): EngineBooking => ({
  id: "b1",
  state: "booked",
  test: false,
  purpose: "outbound",
  parcelNumber: 1,
  carrier: "shipping-test",
  service: "Next Day",
  tracking: "TRK-778899",
  carrierName: "Northway",
  reason: null,
  duplicates: 0,
  createdAt: 1_000,
  calledAt: 1_000,
  checkedAt: null,
  releaseAfter: null,
  applied: false,
  label: { state: "ready", size: "a6", sizeGot: "a6", sizeDiffers: false, customsInvoice: false },
  amount: "4.20",
  currency: "GBP",
  ...over,
});

const OPEN: EngineBookings = { bookings: [], bookable: true, blockedBy: null };
const held = (...list: EngineBooking[]): EngineBookings => ({ bookings: list, bookable: false, blockedBy: "booking" });

const refusal = (code: string, over: { reason?: "address" | "payment" | "rate-expired"; message?: string; refusalDetail?: string; status?: number } = {}) =>
  new EngineCarrierError({
    code,
    message: over.message ?? "engine words",
    status: over.status ?? 409,
    retryable: false,
    outcome: "refused",
    ...(over.reason === undefined ? {} : { reason: over.reason }),
    ...(over.refusalDetail === undefined ? {} : { refusalDetail: over.refusalDetail }),
  });

const noAnswer = () => new EngineCarrierError({ code: "ENGINE_NO_ANSWER", message: "Adminium did not answer.", status: null, retryable: false, outcome: "unknown" });

function fake(over: Partial<Record<keyof EngineCarrier, unknown>> = {}) {
  const client = {
    addOnKey: "shipping-test",
    access: vi.fn(async () => ACCESS),
    quote: vi.fn(async () => PRICED),
    bookings: vi.fn(async () => OPEN),
    book: vi.fn(async () => booking()),
    checkBooking: vi.fn(),
    releaseBooking: vi.fn(),
    fetchDocument: vi.fn(),
    downloadDocument: vi.fn(async () => new Blob(["%PDF-"], { type: "application/pdf" })),
    refreshBooking: vi.fn(),
    refreshOpenParcels: vi.fn(),
    ...over,
  };
  connectEngineCarrier(client as unknown as EngineCarrier);
  return client;
}

const draw = (order: DispatchPayload["order"] = ORDER) => render(<DispatchAction order={order} now={PINNED_NOW} chosen={null} />);
const press = async (id: string) => {
  const target = await screen.findByTestId(id);
  await act(async () => {
    fireEvent.click(target);
  });
};
const toRates = async () => {
  await press("engine-open");
  await press("engine-get-rates");
  await screen.findByTestId("engine-rates");
};
const radio = (name: RegExp) => screen.getByRole("radio", { name });

beforeEach(() => {
  document.documentElement.setAttribute("lang", "en-US");
  applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
});

afterEach(() => {
  cleanup();
  resetRuntime();
  applySettings({ ...DEFAULT_SETTINGS });
  vi.restoreAllMocks();
});

describe("the gate", () => {
  it("draws today's demo with no engine client", () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: true });
    draw();
    expect(screen.getByRole("button", { name: words("addon.shipping-kit.action.book") })).toBeTruthy();
  });

  it("draws the real flow when this add-on is the active carrier", async () => {
    fake();
    draw();
    expect(await screen.findByTestId("engine-dispatch")).toBeTruthy();
  });

  it("keeps the demo for another carrier, or says not connected with the demo off", async () => {
    fake({ access: vi.fn(async () => ({ ...ACCESS, carrier: "shipping-other", activeHere: false })) });
    draw();
    expect(await screen.findByTestId("carrier-not-connected")).toBeTruthy();
    cleanup();
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: true });
    draw();
    expect(await screen.findByRole("button", { name: words("addon.shipping-kit.action.book") })).toBeTruthy();
  });

  it("treats a carrier with no mode as not connected", async () => {
    fake({ access: vi.fn(async () => ({ ...ACCESS, mode: null })) });
    draw();
    expect(await screen.findByTestId("carrier-not-connected")).toBeTruthy();
  });

  it("on a 403 keeps the demo when it is on, and says no right when it is off", async () => {
    const denied = () => new EngineCarrierError({ code: "FORBIDDEN", message: "no", status: 403, retryable: false, outcome: "refused" });
    fake({ access: vi.fn(async () => Promise.reject(denied())) });
    draw();
    expect(await screen.findByTestId("engine-gate-no-right")).toBeTruthy();
    cleanup();
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: true });
    draw();
    expect(await screen.findByRole("button", { name: words("addon.shipping-kit.action.book") })).toBeTruthy();
  });

  it("never falls back to the demo when the engine did not answer", async () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: true });
    fake({ access: vi.fn(async () => Promise.reject(noAnswer())) });
    draw();
    expect(await screen.findByTestId("engine-gate-failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: words("addon.shipping-kit.action.book") })).toBeNull();
  });

  it("offers no booking when the app has not passed the order's row", async () => {
    const client = fake();
    const { source: _source, ...withoutRow } = ORDER;
    draw(withoutRow);
    expect(await screen.findByTestId("engine-gate-app-update")).toBeTruthy();
    expect(client.bookings).not.toHaveBeenCalled();
  });
});

describe("Book is drawn only on bookable", () => {
  it("shows it once the engine says this parcel is free", async () => {
    fake();
    draw();
    await toRates();
    expect(screen.getByTestId("engine-book")).toBeTruthy();
  });

  it.each([
    ["booking", "engine-blocked-booking"],
    ["label-on-order", "engine-blocked-label-on-order"],
    ["no-carrier", "engine-blocked-no-carrier"],
    [null, "engine-blocked-no-right"],
  ] as const)("blockedBy %s has its own card and no way to book", async (blockedBy, card) => {
    const client = fake({ bookings: vi.fn(async () => ({ bookings: [], bookable: false, blockedBy })) });
    draw();
    expect(await screen.findByTestId(card)).toBeTruthy();
    expect(screen.queryByTestId("engine-open")).toBeNull();
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
    expect(client.quote).not.toHaveBeenCalled();
  });

  it("offers nothing when the list cannot be read", async () => {
    fake({ bookings: vi.fn(async () => Promise.reject(noAnswer())) });
    draw();
    expect(await screen.findByTestId("engine-load-failed")).toBeTruthy();
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
  });

  it("has no path back to Book from a bought label", async () => {
    fake({ bookings: vi.fn(async () => held(booking())) });
    draw();
    await screen.findByTestId("engine-label-card-1");
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
    expect(screen.queryByTestId("engine-book")).toBeNull();
    expect(screen.getByTestId("engine-address").textContent).toContain("4 Mill Row");
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("the parcel form", () => {
  it("clears the rates on any edit, and drops a quote that lands after one", async () => {
    fake();
    draw();
    await toRates();
    fireEvent.change(screen.getByLabelText(words("addon.shipping-kit.parcel.weight")), { target: { value: "2" } });
    expect(screen.queryByTestId("engine-rates")).toBeNull();
    expect(screen.queryByTestId("engine-book")).toBeNull();
    expect(screen.getByTestId("engine-cleared")).toBeTruthy();
  });

  it("clears the rates when the order's address changes", async () => {
    fake();
    const view = draw();
    await toRates();
    await act(async () => {
      view.rerender(<DispatchAction order={{ ...ORDER, destination: { ...ORDER.destination!, postcode: "BB8 1AA" } }} now={PINNED_NOW} chosen={null} />);
    });
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });

  it("refuses a bad weight on the field, tied to it, and asks nothing", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    const field = screen.getByLabelText(words("addon.shipping-kit.parcel.weight"));
    fireEvent.change(field, { target: { value: "abc" } });
    await press("engine-get-rates");
    expect(client.quote).not.toHaveBeenCalled();
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const tied = document.getElementById(field.getAttribute("aria-describedby")!.split(" ")[0]!);
    expect(tied?.textContent).toContain("kilograms");
    expect(document.activeElement).toBe(field);
  });

  it("sends the order's row and this parcel's number", async () => {
    const client = fake();
    draw();
    await toRates();
    expect(client.quote).toHaveBeenCalledWith(expect.objectContaining({ source: { table: "orders", id: "1059" }, parcelNumber: 1 }));
  });
});

describe("rates and money", () => {
  it("draws no figure of money for someone with prices hidden", async () => {
    fake({ access: vi.fn(async () => ({ ...ACCESS, manages: false, pricesHidden: true })), quote: vi.fn(async () => PRICELESS) });
    const { container } = draw();
    await toRates();
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/£|\$|€|4\.20|2\.85/);
    expect(text).not.toContain(words("addon.shipping-kit.engine.book.charges"));
    expect(text.toLowerCase()).not.toContain("cheapest");
  });

  it("draws no money from a bought label for someone with prices hidden", async () => {
    fake({ access: vi.fn(async () => ({ ...ACCESS, manages: false, pricesHidden: true })), bookings: vi.fn(async () => held(booking())) });
    const { container } = draw();
    await screen.findByTestId("engine-label-card-1");
    expect(container.textContent).not.toMatch(/£|4\.20/);
    expect(screen.queryByTestId("engine-charges-line")).toBeNull();
  });

  it("shows the price and the later-charges line to someone who may see them", async () => {
    fake();
    const { container } = draw();
    await toRates();
    expect(container.textContent).toContain("£4.20");
    expect(container.textContent).toContain(words("addon.shipping-kit.engine.book.charges"));
  });

  it("will not select a service above the limit", async () => {
    fake();
    draw();
    await toRates();
    const dear = radio(/Courier/);
    expect(dear.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(dear);
    expect(dear.getAttribute("aria-checked")).toBe("false");
  });

  it.each([
    ["no-limit", "limit.noLimit"],
    ["daily-limit", "limit.daily"],
  ] as const)("gives the whole panel to the owner on %s", async (state, key) => {
    const client = fake({ access: vi.fn(async () => ({ ...ACCESS, manages: false, booking: state })) });
    draw();
    await press("engine-open");
    expect(screen.getByTestId("engine-owner-block").textContent).toContain(words(engineKey(key)));
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
    expect(client.quote).not.toHaveBeenCalled();
  });

  it("walks the list with the arrow keys, selecting only what needs no confirm", async () => {
    fake();
    draw();
    await toRates();
    const fast = radio(/Next Day/);
    fast.focus();
    fireEvent.keyDown(fast, { key: "ArrowDown" });
    const slow = radio(/Economy/);
    expect(document.activeElement).toBe(slow);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(fast.getAttribute("aria-checked")).toBe("true");
  });
});

describe("the deliberate confirm", () => {
  it.each([
    [/Economy/, "confirm.slower.title"],
    [/Saver/, "confirm.unstated.title"],
  ])("puts first focus on the safe button for %s", async (row, title) => {
    fake();
    draw();
    await toRates();
    fireEvent.click(radio(row));
    expect(await screen.findByRole("dialog", { name: words(engineKey(title)) })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByTestId("engine-confirm-keep"));
    expect(radio(row).getAttribute("aria-checked")).toBe("false");
  });

  it("closes on Escape, keeps the choice, and returns focus to the row", async () => {
    fake();
    draw();
    await toRates();
    const slow = radio(/Economy/);
    slow.focus();
    fireEvent.click(slow);
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(slow);
    expect(slow.getAttribute("aria-checked")).toBe("false");
  });

  it("holds Tab inside the dialog", async () => {
    fake();
    draw();
    await toRates();
    fireEvent.click(radio(/Economy/));
    const dialog = await screen.findByRole("dialog");
    screen.getByTestId("engine-confirm-use").focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByTestId("engine-confirm-keep"));
  });

  it("selects the slower service only after the confirm", async () => {
    fake();
    draw();
    await toRates();
    fireEvent.click(radio(/Economy/));
    await press("engine-confirm-use");
    expect(radio(/Economy/).getAttribute("aria-checked")).toBe("true");
  });
});

describe("booking", () => {
  it("asks once, however fast it is pressed, and keeps focus on the button", async () => {
    let answer: (value: EngineBooking) => void = () => undefined;
    const client = fake({ book: vi.fn(() => new Promise<EngineBooking>((resolve) => (answer = resolve))) });
    draw();
    await toRates();
    const book = screen.getByTestId("engine-book");
    book.focus();
    await act(async () => {
      fireEvent.click(book);
      fireEvent.click(book);
    });
    expect(client.book).toHaveBeenCalledTimes(1);
    expect(book.getAttribute("aria-disabled")).toBe("true");
    expect(book.hasAttribute("disabled")).toBe(false);
    expect(document.activeElement).toBe(book);
    await act(async () => answer(booking()));
    expect(await screen.findByTestId("engine-label-card-1")).toBeTruthy();
  });

  it("never tells the host a label means the order moved", async () => {
    const onBooked = vi.fn();
    fake();
    render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} onBooked={onBooked} />);
    await toRates();
    await press("engine-book");
    await screen.findByTestId("engine-label-card-1");
    expect(onBooked).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toMatch(/shipped/i);
  });

  it("treats a purchase answered as unknown like a thrown one", async () => {
    const unknown = booking({ state: "unknown", tracking: null, releaseAfter: 5_000 });
    const list = vi.fn<() => Promise<EngineBookings>>().mockResolvedValueOnce(OPEN).mockResolvedValue(held(unknown));
    fake({ bookings: list, book: vi.fn(async () => unknown) });
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-unknown")).toBeTruthy();
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });
});

describe("a purchase with no clear answer", () => {
  const afterThrow = (next: EngineBookings) => {
    const list = vi.fn<() => Promise<EngineBookings>>().mockResolvedValueOnce(OPEN).mockResolvedValue(next);
    return fake({ bookings: list, book: vi.fn(async () => Promise.reject(noAnswer())) });
  };

  it("never shows Book, and reads the list", async () => {
    const client = afterThrow(held(booking({ state: "unknown", tracking: null, releaseAfter: 5_000 })));
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-unknown")).toBeTruthy();
    expect(client.bookings).toHaveBeenCalledTimes(2);
    expect(client.book).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("engine-book")).toBeNull();
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
  });

  it("says the label was bought when the list shows one", async () => {
    afterThrow(held(booking()));
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-found")).toBeTruthy();
    expect(screen.getByTestId("engine-label-card-1")).toBeTruthy();
  });

  it("says it is safe to try again on a recorded failure, through new rates", async () => {
    afterThrow({ bookings: [booking({ state: "refused", tracking: null })], bookable: true, blockedBy: null });
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-safe")).toBeTruthy();
    expect(screen.queryByTestId("engine-book")).toBeNull();
    await press("engine-start-again");
    expect(await screen.findByTestId("engine-get-rates")).toBeTruthy();
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });

  it("does not call it a failure when nothing was recorded", async () => {
    afterThrow(OPEN);
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-no-record")).toBeTruthy();
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });

  it("offers no Book when the list cannot be read afterwards", async () => {
    const list = vi.fn<() => Promise<EngineBookings>>().mockResolvedValueOnce(OPEN).mockRejectedValue(noAnswer());
    fake({ bookings: list, book: vi.fn(async () => Promise.reject(noAnswer())) });
    draw();
    await toRates();
    await press("engine-book");
    expect(await screen.findByTestId("engine-read-failed")).toBeTruthy();
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });
});

describe("a refused purchase", () => {
  it("draws the card for its reason, with the carrier's words for someone who may see prices", async () => {
    fake({ book: vi.fn(async () => Promise.reject(refusal("CARRIER_REFUSED", { reason: "payment", message: "Card declined." }))) });
    draw();
    await toRates();
    await press("engine-book");
    const card = await screen.findByTestId("engine-refused-payment");
    expect(card.textContent).toContain(words("addon.shipping-kit.engine.refused.eyebrow"));
    expect(card.textContent).toContain("Card declined.");
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });

  it("keeps the carrier's words from someone who may not see prices", async () => {
    fake({
      access: vi.fn(async () => ({ ...ACCESS, manages: false, pricesHidden: true })),
      quote: vi.fn(async () => PRICELESS),
      book: vi.fn(async () => Promise.reject(refusal("CARRIER_REFUSED", { reason: "address", message: "Postcode mismatch at depot." }))),
    });
    draw();
    await toRates();
    await press("engine-book");
    const card = await screen.findByTestId("engine-refused-address");
    expect(card.textContent).not.toContain("Postcode mismatch");
  });

  it("gives someone who cannot fix it a note instead of a button", async () => {
    fake({
      access: vi.fn(async () => ({ ...ACCESS, manages: false })),
      book: vi.fn(async () => Promise.reject(refusal("CARRIER_REFUSED", { reason: "payment" }))),
    });
    draw();
    await toRates();
    await press("engine-book");
    await screen.findByTestId("engine-refused-payment");
    expect(screen.queryByTestId("engine-new-rates")).toBeNull();
  });

  it("gets new rates rather than reusing a spent quote", async () => {
    const client = fake({ book: vi.fn(async () => Promise.reject(refusal("QUOTE_EXPIRED", { reason: "rate-expired" }))) });
    draw();
    await toRates();
    await press("engine-book");
    await screen.findByTestId("engine-refused-rate-old");
    expect(screen.queryByTestId("engine-book")).toBeNull();
    await press("engine-new-rates");
    await screen.findByTestId("engine-rates");
    expect(client.quote).toHaveBeenCalledTimes(2);
    expect(client.book).toHaveBeenCalledTimes(1);
  });

  it("says to reload on a stale CSRF token, and never retries", async () => {
    const client = fake({ book: vi.fn(async () => Promise.reject(refusal("CSRF_FAILED", { status: 403 }))) });
    draw();
    await toRates();
    await press("engine-book");
    const card = await screen.findByTestId("engine-refused-csrf");
    expect(card.textContent).toContain(words("addon.shipping-kit.engine.refused.csrf.next"));
    expect(screen.queryByTestId("engine-new-rates")).toBeNull();
    expect(client.book).toHaveBeenCalledTimes(1);
    expect(client.bookings).toHaveBeenCalledTimes(1);
  });

  it("takes the whole panel to the owner when the day's limit ran out", async () => {
    fake({
      access: vi.fn(async () => ({ ...ACCESS, manages: false })),
      book: vi.fn(async () => Promise.reject(refusal("OWNER_BOOKS", { status: 403, refusalDetail: "daily-limit" }))),
    });
    draw();
    await toRates();
    await press("engine-book");
    expect((await screen.findByTestId("engine-owner-block")).textContent).toContain(words("addon.shipping-kit.engine.limit.daily"));
    expect(screen.queryByTestId("engine-book")).toBeNull();
  });
});

describe("confirmEarlier", () => {
  const rebuy = () => Promise.reject(refusal("REBUY_UNCHECKED"));

  it("lets a manager confirm, with first focus on the safe button", async () => {
    const book = vi.fn<(request: unknown) => Promise<EngineBooking>>().mockImplementationOnce(rebuy).mockResolvedValue(booking());
    fake({ book });
    draw();
    await toRates();
    await press("engine-book");
    await press("engine-rebuy-open");
    expect(document.activeElement).toBe(screen.getByTestId("engine-rebuy-keep"));
    expect(book).toHaveBeenCalledTimes(1);
    await press("engine-rebuy-confirm");
    await screen.findByTestId("engine-label-card-1");
    expect(book).toHaveBeenLastCalledWith({ quoteId: "q1", rateId: "fast", confirmEarlier: true });
  });

  it("sends someone who does not manage shipping to the owner", async () => {
    const book = vi.fn(rebuy);
    fake({ access: vi.fn(async () => ({ ...ACCESS, manages: false })), book });
    draw();
    await toRates();
    await press("engine-book");
    const card = await screen.findByTestId("engine-rebuy");
    expect(card.textContent).toContain(words("addon.shipping-kit.engine.rebuy.ask"));
    expect(screen.queryByTestId("engine-rebuy-open")).toBeNull();
    expect(book).toHaveBeenCalledTimes(1);
  });
});

describe("the unknown card", () => {
  const unknown = (over: Partial<EngineBooking> = {}) => booking({ state: "unknown", tracking: null, releaseAfter: 5_000, ...over });

  it.each([
    ["no-match", "outcome.noMatch"],
    ["no-answer", "outcome.noAnswer"],
    ["cannot-check", "outcome.cannotCheck"],
    ["other-account", "outcome.otherAccount"],
    ["other-rate", "outcome.otherRate"],
  ] as const)("words %s and stays blocked", async (outcome: EngineLookUpOutcome, key) => {
    fake({ bookings: vi.fn(async () => held(unknown())), checkBooking: vi.fn(async () => ({ outcome, booking: unknown({ checkedAt: 2_000 }) })) });
    draw();
    await press("engine-check");
    expect((await screen.findByTestId("engine-check-outcome")).textContent).toBe(words(engineKey(key)));
    expect(screen.queryByTestId("engine-book")).toBeNull();
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
  });

  it("opens the label on found", async () => {
    fake({ bookings: vi.fn(async () => held(unknown())), checkBooking: vi.fn(async () => ({ outcome: "found", booking: booking() })) });
    draw();
    await press("engine-check");
    expect(await screen.findByTestId("engine-found")).toBeTruthy();
    expect(screen.queryByTestId("engine-unknown")).toBeNull();
  });

  it("says safe on not-bought", async () => {
    fake({ bookings: vi.fn(async () => held(unknown())), checkBooking: vi.fn(async () => ({ outcome: "not-bought", booking: booking({ state: "refused", tracking: null }) })) });
    draw();
    await press("engine-check");
    expect(await screen.findByTestId("engine-safe")).toBeTruthy();
  });

  it("offers no release to someone who does not manage shipping", async () => {
    fake({ access: vi.fn(async () => ({ ...ACCESS, manages: false })), bookings: vi.fn(async () => held(unknown({ checkedAt: 9_000 }))) });
    draw();
    const card = await screen.findByTestId("engine-unknown");
    expect(screen.queryByTestId("engine-release-open")).toBeNull();
    expect(card.textContent).toContain("Ask the owner");
  });

  it("holds the release shut before the quiet period, with first focus on the safe button", async () => {
    const client = fake({ bookings: vi.fn(async () => held(unknown({ checkedAt: 4_999 }))) });
    draw();
    await press("engine-release-open");
    expect(document.activeElement).toBe(screen.getByTestId("engine-release-keep"));
    expect(screen.getByTestId("engine-release-wait")).toBeTruthy();
    const confirm = screen.getByTestId("engine-release-confirm") as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.click(confirm);
    expect(client.releaseBooking).not.toHaveBeenCalled();
  });

  it("needs the declaration ticked, then releases", async () => {
    const release = vi.fn(async () => unknown({ state: "released" }));
    const list = vi.fn<() => Promise<EngineBookings>>().mockResolvedValueOnce(held(unknown({ checkedAt: 5_000 }))).mockResolvedValue(OPEN);
    fake({ bookings: list, releaseBooking: release });
    draw();
    await press("engine-release-open");
    await press("engine-release-confirm");
    expect(release).not.toHaveBeenCalled();
    expect(screen.getByText(words("addon.shipping-kit.engine.release.tickNeeded"))).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByTestId("engine-release-tick"));
    });
    await press("engine-release-confirm");
    expect(release).toHaveBeenCalledWith("b1");
    expect(await screen.findByTestId("engine-get-rates")).toBeTruthy();
  });

  it("says when the engine finds the release too early", async () => {
    const tooSoon = refusal("RELEASE_TOO_SOON");
    fake({ bookings: vi.fn(async () => held(unknown({ checkedAt: 6_000 }))), releaseBooking: vi.fn(async () => Promise.reject(tooSoon)) });
    draw();
    await press("engine-release-open");
    await act(async () => {
      fireEvent.click(screen.getByTestId("engine-release-tick"));
    });
    await press("engine-release-confirm");
    expect(await screen.findByText(/too soon/)).toBeTruthy();
  });
});

describe("the label", () => {
  const withLabel = (label: Partial<EngineBooking["label"]>, over: Partial<EngineBooking> = {}) =>
    booking({ label: { state: "ready", size: "a6", sizeGot: "a6", sizeDiffers: false, customsInvoice: false, ...label }, ...over });

  it("offers Download and Print only on ready", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:label");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const client = fake({ bookings: vi.fn(async () => held(withLabel({}))) });
    draw();
    await press("engine-label-download");
    expect(client.downloadDocument).toHaveBeenCalledWith("b1", "label");
    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("engine-label-print")).toBeTruthy();
    expect(screen.getByTestId("engine-label-download").textContent).toContain(words("addon.shipping-kit.engine.label.again"));
  });

  it("prints by opening the file in its own tab, cut off from this page", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:label");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const opened: { href: string; target: string; rel: string; download: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      opened.push({ href: this.href, target: this.target, rel: this.rel, download: this.download });
    });
    Object.defineProperty(navigator, "userActivation", { value: { isActive: true }, configurable: true });
    try {
      fake({ bookings: vi.fn(async () => held(withLabel({}))) });
      draw();
      await press("engine-label-print");
      await waitFor(() => expect(opened).toEqual([{ href: "blob:label", target: "_blank", rel: "noopener noreferrer", download: "" }]));
      expect(document.querySelector("iframe")).toBeNull();
      expect(screen.queryByTestId("engine-label-print-open")).toBeNull();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).userActivation;
    }
  });

  it.each([["has run out", { value: { isActive: false }, configurable: true }], ["cannot be read", null]] as const)("asks for one more press when the press %s, and opens nothing until then", async (_name, activation) => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:label");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    if (activation !== null) Object.defineProperty(navigator, "userActivation", activation);
    try {
      fake({ bookings: vi.fn(async () => held(withLabel({}))) });
      draw();
      await press("engine-label-print");
      expect(await screen.findByTestId("engine-label-print-open")).toBeTruthy();
      expect(click).not.toHaveBeenCalled();
      await press("engine-label-print-open");
      expect(click).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("engine-label-print-open")).toBeNull();
    } finally {
      delete (navigator as unknown as Record<string, unknown>).userActivation;
    }
  });

  it("opens nothing when the file cannot be fetched", async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const downloadDocument = vi.fn(async () => Promise.reject(new Error("no")));
    fake({ bookings: vi.fn(async () => held(withLabel({}))), downloadDocument });
    draw();
    await press("engine-label-print");
    await waitFor(() => expect(downloadDocument).toHaveBeenCalledTimes(1));
    expect(click).not.toHaveBeenCalled();
  });

  it.each(["owed", "gone", "none"] as const)("offers no file on %s", async (state) => {
    fake({ bookings: vi.fn(async () => held(withLabel({ state }))) });
    draw();
    expect(await screen.findByTestId(`engine-label-${state}`)).toBeTruthy();
    expect(screen.queryByTestId("engine-label-download")).toBeNull();
    expect(screen.queryByTestId("engine-label-print")).toBeNull();
  });

  it("retries an owed file and then offers it", async () => {
    const fetchDocument = vi.fn(async () => withLabel({}));
    fake({ bookings: vi.fn(async () => held(withLabel({ state: "owed" }))), fetchDocument });
    draw();
    await press("engine-label-retry");
    expect(fetchDocument).toHaveBeenCalledWith("b1", "label");
    expect(await screen.findByTestId("engine-label-download")).toBeTruthy();
  });

  it("says asked for one size, got another", async () => {
    fake({ bookings: vi.fn(async () => held(withLabel({ size: "a4", sizeGot: "a6", sizeDiffers: true }))) });
    draw();
    const line = await screen.findByTestId("engine-label-size");
    expect(line.textContent).toContain("A4");
    expect(line.textContent).toContain("A6");
  });

  it("says the app needs updating when it cannot hand back a file", async () => {
    const stale = new EngineCarrierError({ code: ENGINE_NO_DOWNLOAD, message: "no", status: null, retryable: false });
    fake({ bookings: vi.fn(async () => held(withLabel({}))), downloadDocument: vi.fn(async () => Promise.reject(stale)) });
    draw();
    await press("engine-label-download");
    expect((await screen.findByTestId("engine-label-fault")).textContent).toBe(words("addon.shipping-kit.engine.label.noUpdate"));
  });

  it("shows a real label's charge", async () => {
    fake({ bookings: vi.fn(async () => held(withLabel({}))) });
    const { container } = draw();
    await screen.findByTestId("engine-label-card-1");
    expect(container.textContent).toContain("£4.20");
    expect(screen.getByTestId("engine-charges-line")).toBeTruthy();
  });
});

describe("test mode", () => {
  const TEST_ACCESS: EngineAccess = { ...ACCESS, mode: "test" };

  it("keeps a permanent banner", async () => {
    fake({ access: vi.fn(async () => TEST_ACCESS) });
    draw();
    expect(await screen.findByTestId("engine-test-banner")).toBeTruthy();
  });

  it("shows no charges and never reads the number as real", async () => {
    const sample = booking({ test: true, tracking: "SHOULD-NOT-SHOW" });
    const client = fake({ access: vi.fn(async () => TEST_ACCESS), bookings: vi.fn(async () => held(sample)) });
    const { container } = draw();
    await screen.findByTestId("engine-label-card-1");
    const text = container.textContent ?? "";
    expect(text).not.toContain("SHOULD-NOT-SHOW");
    expect(screen.getByTestId("engine-label-number").textContent).toBe("SAMPLE");
    expect(text).not.toContain(words("addon.shipping-kit.engine.label.charged"));
    expect(text).not.toContain("£4.20");
    expect(screen.queryByTestId("engine-charges-line")).toBeNull();
    expect(screen.queryByTestId("engine-track-refresh")).toBeNull();
    expect(client.refreshBooking).not.toHaveBeenCalled();
  });

  it("does not say nothing was charged on a refused test label", async () => {
    fake({
      access: vi.fn(async () => TEST_ACCESS),
      quote: vi.fn(async () => ({ ...PRICED, mode: "test" as const })),
      book: vi.fn(async () => Promise.reject(refusal("QUOTE_EXPIRED", { reason: "rate-expired" }))),
    });
    draw();
    await toRates();
    expect(screen.getByTestId("engine-book").textContent).toContain(words("addon.shipping-kit.engine.book.test"));
    expect(screen.getByTestId("engine-rates").textContent).not.toContain(words("addon.shipping-kit.engine.book.charges"));
    await press("engine-book");
    const card = await screen.findByTestId("engine-refused-rate-old");
    expect(card.textContent).not.toContain("charged");
  });

  it("does not let a test label hold a live parcel", async () => {
    fake({ bookings: vi.fn(async () => ({ bookings: [booking({ test: true })], bookable: true, blockedBy: null })) });
    draw();
    expect(await screen.findByTestId("engine-open")).toBeTruthy();
    expect(screen.queryByTestId("engine-label-card-1")).toBeNull();
    expect(screen.getByTestId("engine-other-key")).toBeTruthy();
  });
});

describe("tracking on the card", () => {
  const track = { status: "TRANSIT" as const, statusAt: 2_000, checkedAt: 3_000, flag: null, newNumber: true };

  it("shows the status, the last check and a new number", async () => {
    fake({ bookings: vi.fn(async () => held(booking({ track }))) });
    draw();
    const block = await screen.findByTestId("engine-tracking");
    expect(block.textContent).toContain(words("addon.shipping-kit.engine.track.moving"));
    expect(block.textContent).toContain(words("addon.shipping-kit.engine.track.lastChecked"));
    expect(block.textContent).toContain(words("addon.shipping-kit.engine.track.newNumber"));
  });

  it.each([
    ["updated", "refresh.updated"],
    ["unchanged", "refresh.unchanged"],
    ["no-events", "refresh.noEvents"],
    ["recent", "refresh.recent"],
    ["test", "track.test"],
    ["not-open", "refresh.notOpen"],
    ["other-account", "refresh.otherAccount"],
    ["no-answer", "refresh.noAnswer"],
    ["rate-limited", "refresh.rateLimited"],
  ] as const)("words a refresh that answers %s", async (outcome: EngineRefreshOutcome, key) => {
    const refreshBooking = vi.fn(async () => ({ outcome, track: { ...track, status: "DELIVERED" as const } }));
    fake({ bookings: vi.fn(async () => held(booking({ track }))), refreshBooking });
    draw();
    await press("engine-track-refresh");
    expect((await screen.findByTestId("engine-track-words")).textContent).toBe(words(engineKey(key), { company: "Northway" }));
    expect(refreshBooking).toHaveBeenCalledWith("b1");
  });
});

describe("another parcel", () => {
  it("goes through its own read, form, rates and Book", async () => {
    const first = booking();
    const second = booking({ id: "b2", parcelNumber: 2, tracking: "TRK-2" });
    const list = vi.fn(async (query: { parcelNumber?: number }) =>
      query.parcelNumber === 2 ? { bookings: [first], bookable: true, blockedBy: null } : held(first),
    );
    const client = fake({ bookings: list, book: vi.fn(async () => second) });
    draw();
    await press("engine-add-parcel");
    expect(client.book).not.toHaveBeenCalled();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ parcelNumber: 2 }));
    await press("engine-get-rates");
    expect(client.quote).toHaveBeenCalledWith(expect.objectContaining({ parcelNumber: 2 }));
    await press("engine-book");
    expect(await screen.findByTestId("engine-label-card-2")).toBeTruthy();
    expect(screen.getByTestId("engine-label-card-1")).toBeTruthy();
    expect(client.book).toHaveBeenCalledTimes(1);
  });

  it("is not offered while another parcel has no answer", async () => {
    const list = held(booking(), booking({ id: "b2", parcelNumber: 2, state: "unknown", tracking: null, releaseAfter: 5_000 }));
    fake({ bookings: vi.fn(async () => list) });
    draw();
    await screen.findByTestId("engine-unknown");
    expect(screen.queryByTestId("engine-add-parcel")).toBeNull();
  });

  it("leaves the added parcel's form without booking", async () => {
    const first = booking();
    const list = vi.fn(async (query: { parcelNumber?: number }) =>
      query.parcelNumber === 2 ? { bookings: [first], bookable: true, blockedBy: null } : held(first),
    );
    const client = fake({ bookings: list });
    draw();
    await press("engine-add-parcel");
    await press("engine-parcel-close");
    await waitFor(() => expect(screen.queryByTestId("engine-get-rates")).toBeNull());
    expect(client.book).not.toHaveBeenCalled();
  });
});

describe("announcements", () => {
  it("speaks through one polite region", async () => {
    fake();
    draw();
    await toRates();
    const regions = document.querySelectorAll('[data-testid="engine-live"]');
    expect(regions).toHaveLength(1);
    expect(regions[0]!.getAttribute("aria-live")).toBe("polite");
    expect(regions[0]!.textContent).toContain("4");
  });
});

describe("the copy", () => {
  it("names no status the purchase did not cause", () => {
    const english = Object.entries(strings["en-US"]).filter(([key]) => key.startsWith("addon.shipping-kit.engine."));
    expect(english.length).toBeGreaterThan(200);
    expect(english.filter(([, value]) => /shipped|refund|\blater\b tag/i.test(value))).toEqual([]);
  });
});
