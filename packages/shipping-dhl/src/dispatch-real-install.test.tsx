// @vitest-environment happy-dom
/**
 * THE DISPATCH FLOW AS A REAL SHOP MET IT.
 *
 * Four things the walk of a real Maker Shop install found, each held here on
 * the rendered flow, with the order shaped as the shop hands it over: two
 * stoneware mugs and a set of coasters, a shop that sells in pounds and keeps
 * its own packed weight (190 g) beside the order.
 *
 *  1. The rates were priced in US dollars, this repo's sample currency.
 *  2. The weight field read 0.3 kg while the shop's own row read 0.19 kg.
 *  3. The contents read "3 × Stoneware mug and 1 more": three mugs that were
 *     never in the box.
 *  4. With the demo carrier switched off and no DHL account, "Get rates"
 *     answered from the demo anyway, with nothing to say no account was there.
 */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { DispatchPayload } from "@adminium/add-on-host";

import { PINNED_NOW } from "./clock.ts";
import { strings } from "./i18n/strings.ts";
import { parcelFor } from "./parcel.ts";
import { resetRuntime } from "./runtime.ts";
import { DEMO_ORIGIN } from "./seed.ts";
import { applySettings, DEFAULT_SETTINGS } from "./settings.ts";
import { contentsLine } from "./ui/labels.ts";
import { DeliveryMethods } from "./ui/DeliveryMethods.tsx";
import { DispatchAction } from "./ui/DispatchAction.tsx";

const EN = strings["en-US"];

const ORDER: DispatchPayload["order"] = {
  ref: "BR-2268",
  recipient: { name: "Iris P.", key: "iris" },
  items: [
    { id: "l1", key: "mug", label: "Stoneware mug", quantity: 2, unitWeightGrams: 24 },
    { id: "l2", key: "coasters", label: "Engraved walnut coasters", quantity: 1, unitWeightGrams: 24 },
  ],
  origin: { ...DEMO_ORIGIN, name: "Birch Row", city: "Settle", postcode: "BD24 9AA" },
  destination: { name: "Iris P.", lines: ["4 Mill Row"], city: "Colne", postcode: "BB8 9ZZ", country: "GB" },
  value: { amount: 3950, currency: "GBP" },
  parcelWeightGrams: 190,
};

const payload = (order: DispatchPayload["order"] = ORDER): DispatchPayload => ({ order, now: PINNED_NOW, chosen: null });

const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1)
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
};

/** Open the flow, as the works does, and return the parcel's three fields. */
function opened(): { contents: HTMLInputElement; weight: HTMLInputElement } {
  fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-dhl.action.book"] }));
  const inputs = [...document.querySelectorAll("input")] as HTMLInputElement[];
  return { contents: inputs[0]!, weight: inputs[1]! };
}

beforeEach(() => {
  resetRuntime();
  applySettings({ ...DEFAULT_SETTINGS });
  document.documentElement.setAttribute("lang", "en-US");
});
afterEach(cleanup);

describe("the parcel, as the shop handed it over", () => {
  it("names each line by its own quantity", () => {
    render(<DispatchAction {...payload()} />);
    expect(opened().contents.value).toBe("2 × Stoneware mug, 1 × Engraved walnut coasters");
  });

  it("names three lines whole, and says how many more follow a fourth", () => {
    const lines = ["A", "B", "C", "D", "E"].map((label, i) => ({ label, quantity: i + 1 }));
    const t = (key: keyof typeof EN, params: Record<string, string | number> = {}) => EN[key].replace(/\{(\w+)\}/g, (_m, name: string) => String(params[name]));
    expect(contentsLine(t as never, { from: { items: lines.slice(0, 3) } })).toBe("1 × A, 2 × B, 3 × C");
    expect(contentsLine(t as never, { from: { items: lines } })).toBe("1 × A, 2 × B, 3 × C and 2 more");
  });

  it("starts from the shop's own packed weight, as the shop's row shows it, and says whose it is", () => {
    render(<DispatchAction {...payload()} />);
    expect(opened().weight.value).toBe("0.19");
    expect(screen.getByText("0.19kg — order BR-2268's own weight, packed")).toBeTruthy();
    expect(parcelFor(ORDER.items, { packedGrams: 190 }).weightKg).toBe(0.19);
  });

  it("works one out where the shop keeps none, and never calls a mixed parcel's average each", () => {
    const { parcelWeightGrams: _kept, ...order } = ORDER;
    render(<DispatchAction {...payload(order)} />);
    expect(opened().weight.value).toBe("0.3");
    expect(screen.getByText("0.3kg — 3 items weighing 72g, plus the box")).toBeTruthy();
    expect(screen.queryByText(/at 24g each/)).toBeNull();
  });
});

describe("the rates, and who answers for them", () => {
  it("prices the demo carrier's rates in the shop's currency, and says before quoting that nothing reaches DHL", async () => {
    render(<DispatchAction {...payload()} />);
    opened();
    expect(screen.getByTestId("dhl-demo-notice").textContent).toBe(EN["addon.shipping-dhl.account.demoNotice"]);
    fireEvent.click(screen.getByRole("button", { name: EN["addon.shipping-dhl.rates.get"] }));
    await settle();
    const prices = [...document.querySelectorAll("button[aria-pressed]")].map((row) => row.textContent ?? "");
    expect(prices.length).toBe(3);
    for (const price of prices) {
      expect(price).toContain("£");
      expect(price).not.toContain("$");
    }
  });

  it("with the demo off and no DHL account, says the account is not connected and quotes nothing", async () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
    render(<DispatchAction {...payload()} />);
    opened();
    const card = screen.getByTestId("dhl-not-connected");
    expect(card.textContent).toContain(EN["addon.shipping-dhl.account.notConnectedTitle"]);
    expect(card.textContent).toContain(EN["addon.shipping-dhl.account.notConnectedBody"]);
    expect(screen.queryByRole("button", { name: EN["addon.shipping-dhl.rates.get"] })).toBeNull();
    expect(screen.queryByTestId("dhl-demo-notice")).toBeNull();
    await settle();
    expect(document.querySelectorAll("button[aria-pressed]").length).toBe(0);
  });
});

describe("the checkout's delivery rows", () => {
  const basket = { items: ORDER.items, origin: ORDER.origin, destination: ORDER.destination, now: PINNED_NOW, total: { amount: 3950, currency: "GBP" } };

  it("are priced in the shop's currency", async () => {
    render(<DeliveryMethods {...basket} />);
    await settle();
    const prices = [...document.querySelectorAll("button[aria-pressed]")].map((row) => row.textContent ?? "");
    expect(prices.length).toBe(3);
    expect(prices.every((price) => price.includes("£") && !price.includes("$"))).toBe(true);
  });

  it("are not drawn at all with the demo off and no DHL account: the shop's own delivery stays", async () => {
    applySettings({ ...DEFAULT_SETTINGS, demo_transport: false });
    const { container } = render(<DeliveryMethods {...basket} />);
    await settle();
    expect(container.innerHTML).toBe("");
  });
});
