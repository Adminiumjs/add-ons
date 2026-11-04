/**
 * THE SERVICE THE SHOPPER CHOSE IS THE ONE DISPATCH OPENS WITH.
 *
 * A shopper picks a DHL service at checkout and the shop keeps it on the order.
 * At dispatch the host hands it back (`DispatchPayload.chosen`), and the works
 * should find that service already picked, not the first rate on the list: a
 * parcel the shopper paid express for must not go out on the cheaper service
 * because nobody looked twice.
 */

import { beforeEach, describe, expect, it } from "vitest";

import type { DeliveryChoice, DispatchPayload } from "@adminium/add-on-host";
import manifest from "../manifest.json";
import { ADD_ON_KEY } from "./add-on-key.ts";
import { PINNED_NOW } from "./clock.ts";
import { preselectedCode, type QuotedRate } from "./rates.ts";
import { carrier, resetRuntime, setHostClock } from "./runtime.ts";
import { DEMO_ORIGIN } from "./seed.ts";

const TO = {
  name: "Kestrel Joinery",
  lines: ["The Joinery Shop", "Wold Lane"],
  city: "Nether Wold",
  postcode: "NW3 6BD",
  country: "GB",
};

const parcel = { weightKg: 1.2, lengthCm: 30, widthCm: 20, heightCm: 10, contents: "Oak sign" };

async function quoted(): Promise<QuotedRate[]> {
  return (await carrier().quote(parcel, DEMO_ORIGIN, TO)) as QuotedRate[];
}

describe("dispatch opens with the service the order stores", () => {
  beforeEach(() => {
    resetRuntime();
    setHostClock(PINNED_NOW);
  });

  it("reads back the key it writes on a delivery choice", () => {
    expect(ADD_ON_KEY).toBe(manifest.key);
  });

  it("picks the stored service when it is quoted again", async () => {
    const rates = await quoted();
    expect(rates.length).toBeGreaterThan(1);
    const last = rates[rates.length - 1]!.code;
    expect(last).not.toBe(rates[0]!.code);
    expect(preselectedCode(rates, { addOn: ADD_ON_KEY, code: last }, ADD_ON_KEY)).toBe(last);
  });

  it("takes a whole delivery choice as the host stored it", async () => {
    const rates = await quoted();
    const stored = rates[1]!;
    const whole: DeliveryChoice = {
      addOn: ADD_ON_KEY,
      code: stored.code,
      label: "as the checkout showed it",
      amount: 9.5,
      currency: "GBP",
      estimatedDelivery: "2026-08-12",
    };
    // Type-checked: the checkout's own object is a valid dispatch field.
    const chosen: DispatchPayload["chosen"] = whole;
    expect(preselectedCode(rates, chosen, ADD_ON_KEY)).toBe(stored.code);
  });

  it("ignores a code another delivery add-on made", async () => {
    const rates = await quoted();
    const code = rates[1]!.code;
    expect(preselectedCode(rates, { addOn: "another-carrier", code }, ADD_ON_KEY)).toBe(rates[0]!.code);
  });

  it("keeps its usual first pick for a service it no longer quotes, or none stored", async () => {
    const rates = await quoted();
    expect(preselectedCode(rates, { addOn: ADD_ON_KEY, code: "GONE" }, ADD_ON_KEY)).toBe(rates[0]!.code);
    expect(preselectedCode(rates, null, ADD_ON_KEY)).toBe(rates[0]!.code);
    expect(preselectedCode(rates, undefined, ADD_ON_KEY)).toBe(rates[0]!.code);
    expect(preselectedCode([], { addOn: ADD_ON_KEY, code: "N" }, ADD_ON_KEY)).toBeNull();
  });
});
