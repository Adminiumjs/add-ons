// @vitest-environment happy-dom
/**
 * THE BOOKING, HANDED BACK TO THE HOST (`DispatchPayload.onBooked`).
 *
 * A shop's desk keeps the tracking number with the order's Shipped move, so
 * it has to hear of a booking: once when the collection is booked, and again
 * when the panel opens on an order already booked. And it has to know a demo
 * booking from a real one, because a demo number belongs to no parcel and is
 * never mailed to a customer as their tracking.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DispatchBooking, DispatchPayload } from "@adminium/add-on-host";

import { PINNED_NOW } from "@adminium/add-on-shipping-kit/clock.ts";
import { strings } from "./testing/named-strings.ts";
import { renderLabelPdf } from "@adminium/add-on-shipping-kit/label.ts";
import { resetRuntime } from "@adminium/add-on-shipping-kit/runtime.ts";
import { DEMO_ORIGIN, resolveDestination } from "@adminium/add-on-shipping-kit/seed.ts";
import { applySettings, DEFAULT_SETTINGS } from "@adminium/add-on-shipping-kit/settings.ts";
import { DispatchAction } from "@adminium/add-on-shipping-kit/ui/DispatchAction.tsx";

const EN = strings["en-US"];

const ORDER: DispatchPayload["order"] = {
  ref: "NL-1061",
  recipient: { name: "Dana W.", key: "dana" },
  items: [{ id: "l1", key: "BSH-EMB-M", label: "Brushed shirt, Ember, M", quantity: 1, unitWeightGrams: 320 }],
  origin: { ...DEMO_ORIGIN, name: "Northline", city: "Portland", postcode: "97214", region: "OR", country: "US" },
  destination: { name: "Dana W.", lines: ["18 Alder St"], city: "Eugene", postcode: "97401", region: "OR", country: "US" },
  value: { amount: 6800, currency: "USD" },
};

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

async function book(heard: DispatchBooking[]): Promise<void> {
  render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} onBooked={(booking) => heard.push(booking)} />);
  fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.action.book"] }));
  fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.get"] }));
  await settle();
  fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.book"] }));
  await settle();
}

beforeEach(() => {
  resetRuntime();
  applySettings({ ...DEFAULT_SETTINGS });
  document.documentElement.setAttribute("lang", "en-US");
});
afterEach(cleanup);

describe("a booking, handed back", () => {
  it("tells the host once, with the number and the service, marked as the demo's", async () => {
    const heard: DispatchBooking[] = [];
    await book(heard);
    expect(heard).toHaveLength(1);
    expect(heard[0]!.demo).toBe(true);
    expect(heard[0]!.tracking).toMatch(/\d/);
    expect(heard[0]!.service.length).toBeGreaterThan(0);
    // The screen still says no real shipment was booked.
    expect(screen.getByText(EN["addon.shipping-kit.demoChip"])).toBeTruthy();
  });

  it("tells the host again when the panel opens on an order already booked, with the same number", async () => {
    const first: DispatchBooking[] = [];
    await book(first);
    cleanup();
    const again: DispatchBooking[] = [];
    render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} onBooked={(booking) => again.push(booking)} />);
    await settle();
    expect(again).toEqual(first);
  });

  it("never tells a host that passes nothing, and books all the same", async () => {
    render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} />);
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.action.book"] }));
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.get"] }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.book"] }));
    await settle();
    expect(screen.getByText(EN["addon.shipping-kit.demoChip"])).toBeTruthy();
  });

  it("does not tell the host again on a re-render with a fresh function", async () => {
    const heard: DispatchBooking[] = [];
    const { rerender } = render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} onBooked={(booking) => heard.push(booking)} />);
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.action.book"] }));
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.get"] }));
    await settle();
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-kit.rates.book"] }));
    await settle();
    for (let i = 0; i < 3; i += 1) rerender(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} onBooked={(booking) => heard.push(booking)} />);
    await settle();
    expect(heard).toHaveLength(1);
  });
});

describe("a region on the address", () => {
  it("is kept on the destination and printed after the city on the label", () => {
    const to = resolveDestination(ORDER);
    if (to.status !== "resolved") throw new Error("the address is whole");
    expect(to.address).toMatchObject({ city: "Eugene", region: "OR", postcode: "97401" });
    const pdf = renderLabelPdf({ carrier: "DHL", tracking: "1", service: "S", reference: "NL-1061", collection: "c", delivery: "d", to: to.address, from: { name: "Northline", city: "Portland", postcode: "97214", country: "US" } });
    expect(pdf).toContain("Eugene, OR");
  });

  it("is left out where the address has none", () => {
    const { region: _none, ...destination } = ORDER.destination!;
    const to = resolveDestination({ ...ORDER, destination });
    if (to.status !== "resolved") throw new Error("the address is whole");
    expect(to.address.city).toBe("Eugene");
    expect(to.address).not.toHaveProperty("region");
  });
});
