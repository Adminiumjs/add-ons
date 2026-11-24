// @vitest-environment happy-dom
/**
 * PARCELS ABROAD, drawn against a fake engine client. Each case holds something
 * that would mislead a person or misdeclare goods if it broke, and the first
 * holds the promise that a shop not set up for abroad sees no change at all.
 */

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DispatchPayload } from "@adminium/add-on-host";
import {
  EngineCarrierError,
  type EngineAccess,
  type EngineBooking,
  type EngineCarrier,
  type EngineCustomsForm,
  type EngineInternational,
  type EngineInternationalBody,
  type EngineQuote,
} from "@adminium/add-on-host/engine-carrier";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PINNED_NOW } from "../clock.ts";
import { translate } from "../i18n/t.ts";
import type { StringKey } from "../i18n/strings.ts";
import { connectEngineCarrier, resetRuntime } from "../runtime.ts";
import { DEMO_ORIGIN } from "../seed.ts";
import { applySettings, DEFAULT_SETTINGS } from "../settings.ts";
import { cleanPrice, CountriesPanel, type CountryPrices } from "./CountriesPanel.tsx";
import { CustomsDefaultsPanel } from "./CustomsDefaultsPanel.tsx";
import { DispatchAction } from "./DispatchAction.tsx";
import { customsEdits, lineTotal, refusalCardOf } from "./engine/flow.ts";

const words = (key: string, params?: Record<string, string | number>) => translate("en-US", `addon.shipping-kit.${key}` as StringKey, params);

const ORDER: DispatchPayload["order"] = {
  ref: "BR-2288",
  source: { table: "orders", id: "2288" },
  recipient: { name: "Lena K.", key: "lena" },
  items: [{ id: "l1", key: "bag", label: "Canvas bag", quantity: 2, unitWeightGrams: 240 }],
  origin: DEMO_ORIGIN,
  destination: { name: "Lena K.", lines: ["Hauptstr. 1"], city: "Berlin", postcode: "10115", country: "DE" },
  parcelWeightGrams: 900,
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
  mayShipAbroad: true,
  shipsAbroad: true,
  pricesHidden: false,
  booking: "open",
};

const FORM: Extract<EngineCustomsForm, { offered: true }> = {
  abroad: true,
  offered: true,
  ownCountry: "GB",
  to: "DE",
  codeListUrl: "https://tariff.example/find",
  signer: "Ada Owner",
  currency: "GBP",
  lines: [{ line: "11", description: "Canvas tote bag", quantity: 2, unitValue: "32.00", originCountry: "GB", hsCode: "420222", skuCode: "BAG-1" }],
  faults: [],
  warnings: [{ line: "11", field: "manufacturerCode" }],
};

const QUOTE: EngineQuote = {
  quoteId: "q1",
  carrier: "shipping-test",
  mode: "live",
  expiresAt: 9_999,
  pricesHidden: false,
  rates: [{ rateId: "r1", code: "dpd", service: "DPD Classic", priced: true, amountDecimal: "14.20", currency: "GBP", withinLimit: true, estimatedDays: 3, tracked: true, carrier: "DPD" }],
};

const booking = (label: Partial<EngineBooking["label"]> = {}): EngineBooking => ({
  id: "b1",
  state: "booked",
  test: false,
  purpose: "outbound",
  parcelNumber: 1,
  carrier: "shipping-test",
  service: "DPD Classic",
  tracking: "TRK-1",
  carrierName: "DPD",
  reason: null,
  duplicates: 0,
  createdAt: 1_000,
  calledAt: 1_000,
  checkedAt: null,
  releaseAfter: null,
  applied: false,
  label: { state: "ready", size: "a6", sizeGot: "a6", sizeDiffers: false, customsInvoice: false, customsInvoiceOwed: false, ...label },
});

const refused = (code: string, over: { refusalDetail?: string; refusalFields?: string[] } = {}) =>
  new EngineCarrierError({ code, message: "engine words", status: 422, retryable: false, outcome: "refused", ...over });

type Spy = ReturnType<typeof vi.fn>;
type FakeClient = Record<"access" | "quote" | "bookings" | "book" | "customsForm" | "fetchDocument" | "downloadDocument", Spy> & { addOnKey: string };

function fake(over: Partial<Record<keyof EngineCarrier, unknown>> = {}): FakeClient {
  const client = {
    addOnKey: "shipping-test",
    access: vi.fn(async () => ACCESS),
    quote: vi.fn(async () => QUOTE),
    bookings: vi.fn(async () => ({ bookings: [], bookable: true, blockedBy: null })),
    book: vi.fn(async () => booking()),
    customsForm: vi.fn(async () => FORM as EngineCustomsForm),
    fetchDocument: vi.fn(),
    downloadDocument: vi.fn(async () => new Blob(["%PDF-"], { type: "application/pdf" })),
    ...over,
  };
  connectEngineCarrier(client as unknown as EngineCarrier);
  return client as unknown as FakeClient;
}

const draw = () => render(<DispatchAction order={ORDER} now={PINNED_NOW} chosen={null} />);
const press = async (id: string) => {
  const target = await screen.findByTestId(id);
  await act(async () => {
    fireEvent.click(target);
  });
};
const type = async (id: string, value: string) => {
  const target = await screen.findByTestId(id);
  await act(async () => {
    fireEvent.change(target, { target: { value } });
  });
};

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

describe("a shop that is not set up for abroad", () => {
  it("asks for no customs form and sends no declaration", async () => {
    const client = fake({ access: vi.fn(async () => ({ ...ACCESS, shipsAbroad: false })) });
    draw();
    await press("engine-open");
    await press("engine-get-rates");
    await screen.findByTestId("engine-rates");
    expect(client.customsForm).not.toHaveBeenCalled();
    expect(client.quote.mock.calls[0]![0]).not.toHaveProperty("customs");
    expect(screen.queryByTestId("customs-form")).toBeNull();
  });
});

describe("the customs form", () => {
  it("leaves a parcel inside the country exactly as it was", async () => {
    const client = fake({ customsForm: vi.fn(async () => ({ abroad: false })) });
    draw();
    await press("engine-open");
    await press("engine-get-rates");
    await screen.findByTestId("engine-rates");
    expect(screen.queryByTestId("customs-form")).toBeNull();
    expect(client.quote.mock.calls[0]![0]).not.toHaveProperty("customs");
  });

  it("is never ticked for anyone, and asks for no rates until it is", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    const tick = (await screen.findByTestId("customs-declare")) as HTMLInputElement;
    expect(tick.checked).toBe(false);
    expect(screen.getByText(words("customs.declare", { who: "Ada Owner" }))).toBeTruthy();
    await press("customs-save");
    expect(client.quote).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(words("customs.fault.tick"));
  });

  it("sends the tick alone when nothing was corrected, and folds away once rates are up", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    await press("customs-declare");
    await press("customs-save");
    await screen.findByTestId("engine-rates");
    expect((client.quote.mock.calls[0]![0] as { customs: unknown }).customs).toEqual({ certified: true });
    expect(screen.queryByTestId("customs-form")).toBeNull();
    expect(screen.getByTestId("customs-done")).toBeTruthy();
  });

  it("sends only what a person corrected, and a corrected code as bare digits", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    await type("customs-hs-1", "4202.92");
    await type("customs-maker-1", "GB-MFR-1");
    await press("customs-declare");
    await press("customs-save");
    await screen.findByTestId("engine-rates");
    expect((client.quote.mock.calls[0]![0] as { customs: unknown }).customs).toEqual({
      certified: true,
      lines: [{ line: "11", hsCode: "420292", manufacturerCode: "GB-MFR-1" }],
    });
  });

  it("refuses a blank over a code the shop holds, because the engine would declare the old one", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    await type("customs-hs-1", "");
    await press("customs-declare");
    await press("customs-save");
    expect(client.quote).not.toHaveBeenCalled();
    expect(screen.getByText(words("customs.fault.hsKept"))).toBeTruthy();
  });

  it("draws quantity and values as text nobody can type into", async () => {
    fake();
    draw();
    await press("engine-open");
    const box = await screen.findByTestId("customs-line-1");
    expect(box.textContent).toContain("£64.00");
    expect(box.querySelectorAll("input")).toHaveLength(3);
  });

  it("warns of a missing EU code and still lets the person go on", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    expect(await screen.findByText(words("customs.warn.maker"))).toBeTruthy();
    await press("customs-declare");
    await press("customs-save");
    expect(client.quote).toHaveBeenCalledTimes(1);
  });

  it("clears the rates when a person opens the form again", async () => {
    fake();
    draw();
    await press("engine-open");
    await press("customs-declare");
    await press("customs-save");
    await screen.findByTestId("engine-rates");
    await press("customs-reopen");
    expect(screen.queryByTestId("engine-rates")).toBeNull();
    expect(screen.getByTestId("customs-form")).toBeTruthy();
  });

  it("never leaves a person with no way on after a changed weight clears the rates", async () => {
    const client = fake();
    draw();
    await press("engine-open");
    await press("customs-declare");
    await press("customs-save");
    await screen.findByTestId("engine-rates");
    const weight = screen.getByRole("textbox", { name: words("parcel.weight") });
    await act(async () => {
      fireEvent.change(weight, { target: { value: "1.5" } });
    });
    expect(screen.queryByTestId("engine-rates")).toBeNull();
    await press("customs-save");
    await screen.findByTestId("engine-rates");
    expect(client.quote).toHaveBeenCalledTimes(2);
  });

  it("offers no tick when the named signer can no longer sign", async () => {
    fake({ customsForm: vi.fn(async () => ({ ...FORM, signer: null })) });
    draw();
    await press("engine-open");
    expect(await screen.findByTestId("customs-no-signer")).toBeTruthy();
    expect(screen.queryByTestId("customs-declare")).toBeNull();
    expect((screen.getByTestId("customs-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("stops at a line with no value, and says to fix it on the order", async () => {
    fake({ customsForm: vi.fn(async () => ({ ...FORM, lines: [{ ...FORM.lines[0]!, unitValue: null }], faults: [{ line: "11", field: "unitValue" }] })) });
    draw();
    await press("engine-open");
    expect(await screen.findByText(words("customs.fault.value"))).toBeTruthy();
    expect((screen.getByTestId("customs-save") as HTMLButtonElement).disabled).toBe(true);
  });

  it("names a country the shop does not deliver to, with no way to get rates", async () => {
    fake({ customsForm: vi.fn(async () => ({ abroad: true, offered: false, to: "JP" })) });
    draw();
    await press("engine-open");
    expect(await screen.findByTestId("customs-not-offered")).toBeTruthy();
    expect(screen.queryByTestId("engine-get-rates")).toBeNull();
  });

  it("does not read the form for someone who may not send it abroad, and says who books", async () => {
    const client = fake({
      access: vi.fn(async () => ({ ...ACCESS, manages: false, mayShipAbroad: false })),
      quote: vi.fn(async () => {
        throw refused("OWNER_BOOKS", { refusalDetail: "abroad" });
      }),
    });
    draw();
    await press("engine-open");
    await press("engine-get-rates");
    expect((await screen.findByTestId("engine-refused-abroad-owner")).textContent).toContain(words("customs.refused.ownerAbroad.title"));
    expect(client.customsForm).not.toHaveBeenCalled();
  });

  it("sends a carrier's customs refusal back to the form", async () => {
    const client = fake();
    client.book.mockImplementation(async () => {
      throw new EngineCarrierError({ code: "CARRIER_REFUSED", message: "Item 1: tariff number invalid.", status: 422, retryable: false, outcome: "refused", reason: "customs" });
    });
    draw();
    await press("engine-open");
    await press("customs-declare");
    await press("customs-save");
    await press("engine-book");
    await screen.findByTestId("engine-refused-customs");
    await press("engine-open-customs");
    expect(screen.getByTestId("customs-form")).toBeTruthy();
  });

  it("gives an order cancelled while rates were open its own plain card", async () => {
    const client = fake({ customsForm: vi.fn(async () => ({ abroad: false })) });
    client.book.mockImplementation(async () => {
      throw refused("ORDER_CANCELLED");
    });
    draw();
    await press("engine-open");
    await press("engine-get-rates");
    await press("engine-book");
    expect(await screen.findByTestId("engine-refused-cancelled")).toBeTruthy();
    expect(screen.queryByTestId("engine-new-rates")).toBeNull();
  });
});

describe("the customs invoice", () => {
  const onLabel = (label: Partial<EngineBooking["label"]>, access: Partial<EngineAccess> = {}) =>
    fake({
      access: vi.fn(async () => ({ ...ACCESS, ...access })),
      bookings: vi.fn(async () => ({ bookings: [booking(label)], bookable: false, blockedBy: "booking" })),
    });

  it("is offered to who may send the parcel abroad", async () => {
    const client = onLabel({ customsInvoice: true });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:invoice");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    draw();
    await press("engine-invoice-download");
    expect(client.downloadDocument).toHaveBeenCalledWith("b1", "customs-invoice");
  });

  it("is not drawn for anyone else, because it states what the goods are worth", async () => {
    onLabel({ customsInvoice: true }, { manages: false, mayShipAbroad: false });
    draw();
    await screen.findByTestId("engine-label-card-1");
    expect(screen.queryByTestId("engine-invoice")).toBeNull();
  });

  it("fetches an invoice that is owed when a person asks", async () => {
    const client = onLabel({ customsInvoiceOwed: true });
    client.fetchDocument.mockImplementation(async () => booking({ customsInvoice: true }));
    draw();
    await press("engine-invoice-retry");
    expect(client.fetchDocument).toHaveBeenCalledWith("b1", "customs-invoice");
    expect(await screen.findByTestId("engine-invoice-download")).toBeTruthy();
  });
});

describe("the rules", () => {
  it("gives each refusal its own card", () => {
    const cards = ["COUNTRY_NOT_OFFERED", "ORDER_CANCELLED", "CUSTOMS_NOT_DECLARED", "CUSTOMS_NOT_CONFIRMED", "CUSTOMS_NOT_NEEDED", "CUSTOMS_INCOMPLETE", "CUSTOMS_ONE_PARCEL", "CUSTOMS_SIGNER"].map((code) => refusalCardOf(code, undefined));
    expect(new Set(cards).size).toBe(cards.length);
    expect(cards).not.toContain("other");
    expect(refusalCardOf("ADDRESS_INCOMPLETE", "address", ["phone"])).toBe("phone");
    expect(refusalCardOf("ADDRESS_INCOMPLETE", "address", ["phone", "city"])).toBe("address-gap");
    expect(refusalCardOf("CUSTOMS_INCOMPLETE", "customs", ["weight"])).toBe("customs-weight");
  });

  it("works a total out exactly", () => {
    expect(lineTotal("19.99", 3)).toBe("59.97");
    expect(lineTotal("0.10", 3)).toBe("0.30");
    expect(lineTotal("5", 2)).toBe("10");
  });

  it("never sends a blank as a correction", () => {
    const edits = customsEdits([{ line: "1", description: "Cards", quantity: 1, unitValue: "1.00", originCountry: "GB" }], { "1": { hsCode: "", manufacturerCode: " " } });
    expect(edits).toEqual({ ok: true, edits: [] });
  });

  it("keeps a typed price exact", () => {
    expect(cleanPrice("12,50")).toBe("12.50");
    expect(cleanPrice("0")).toBeNull();
    expect(cleanPrice("3kg")).toBeNull();
    expect(cleanPrice("1.999")).toBeNull();
  });
});

const VIEW: EngineInternational = {
  ownCountry: "GB",
  codeListUrl: "https://tariff.example/find",
  shipsAbroad: false,
  settings: null,
};
const SAVED: NonNullable<EngineInternational["settings"]> = { countries: ["DE"], currency: "GBP", originCountry: "GB", signerId: "u1", signerName: "Ada Owner", products: [] };

describe("the two settings panels, open together", () => {
  /** An engine that keeps one record, and replaces all of it on a save, as the real one does. */
  const keeper = (start: NonNullable<EngineInternational["settings"]>) => {
    let settings = start;
    const read = (): EngineInternational => ({ ...VIEW, shipsAbroad: settings.countries.length > 0, settings });
    return {
      held: () => settings,
      engine: {
        international: vi.fn(async () => read()),
        customsSigners: vi.fn(async () => [{ id: "u1", name: "Ada Owner" }]),
        saveInternational: vi.fn(async (body: EngineInternationalBody) => {
          settings = { ...settings, ...body, description: body.description, hsCode: body.hsCode, products: body.products ?? [] } as typeof settings;
          return read();
        }),
      } as unknown as EngineCarrier,
    };
  };
  const prices = (): CountryPrices => ({ read: vi.fn(async () => ({})), save: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) });
  const both = async (engine: EngineCarrier) => {
    render(
      <>
        <CountriesPanel client={engine} prices={prices()} currency="GBP" />
        <CustomsDefaultsPanel client={engine} currency="GBP" />
      </>,
    );
    await screen.findByTestId("countries-open");
    await screen.findByTestId("defaults-save");
  };
  const addCountry = async (code: string) => {
    await press("countries-open");
    await screen.findByTestId("countries-pick");
    await type("countries-pick", code);
    await type("countries-price", "14.50");
    await press("countries-save");
    await screen.findByTestId(`countries-row-${code}`);
  };

  it("keeps a country added after the defaults opened when the defaults are saved", async () => {
    const { engine, held } = keeper({ ...SAVED, countries: [] });
    await both(engine);
    await addCountry("DE");
    expect(held().countries).toEqual(["DE"]);
    await type("defaults-hs", "4911.10");
    await press("defaults-save");
    await screen.findByTestId("defaults-saved");
    expect(held().countries).toEqual(["DE"]);
    expect(held().hsCode).toBe("4911.10");
  });

  it("keeps defaults saved after the countries opened when a country is added or removed", async () => {
    const { engine, held } = keeper({ ...SAVED, countries: ["FR"] });
    await both(engine);
    await type("defaults-hs", "4911.10");
    await press("defaults-save");
    await screen.findByTestId("defaults-saved");
    await addCountry("DE");
    expect(held()).toMatchObject({ countries: ["FR", "DE"], hsCode: "4911.10" });
    await press("countries-remove-FR");
    await waitFor(() => expect(held().countries).toEqual(["DE"]));
    expect(held().hsCode).toBe("4911.10");
  });
});

describe("countries we deliver to", () => {
  const store = (over: Partial<CountryPrices> = {}): CountryPrices => ({
    read: vi.fn(async () => ({})),
    save: vi.fn(async () => undefined),
    remove: vi.fn(async () => undefined),
    ...over,
  });
  const client = (over: Record<string, unknown> = {}) =>
    ({ international: vi.fn(async () => VIEW), saveInternational: vi.fn(async () => ({ ...VIEW, shipsAbroad: true, settings: SAVED })), ...over }) as unknown as EngineCarrier & { saveInternational: ReturnType<typeof vi.fn> };

  it("adds no country without its price", async () => {
    const engine = client();
    const prices = store();
    render(<CountriesPanel client={engine} prices={prices} currency="GBP" />);
    await press("countries-open");
    await press("countries-save");
    expect(prices.save).not.toHaveBeenCalled();
    expect(engine.saveInternational).not.toHaveBeenCalled();
    expect(screen.getByText(words("countries.priceFault", { cur: "GBP" }))).toBeTruthy();
  });

  it("writes the price and the country, and offers neither the home country nor a listed one", async () => {
    const engine = client();
    const prices = store();
    render(<CountriesPanel client={engine} prices={prices} currency="GBP" />);
    await press("countries-open");
    const picker = (await screen.findByTestId("countries-pick")) as HTMLSelectElement;
    expect([...picker.options].map((one) => one.value)).not.toContain("GB");
    await type("countries-pick", "DE");
    await type("countries-price", "12,50");
    await press("countries-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(prices.save).toHaveBeenCalledWith("DE", "12.50");
    expect(engine.saveInternational.mock.calls[0]![0]).toMatchObject({ countries: ["DE"], currency: "GBP", originCountry: "GB" });
  });

  it("leaves an origin and currency the owner chose where they are", async () => {
    const held = { ...VIEW, shipsAbroad: true, settings: { ...SAVED, originCountry: "CN", currency: "EUR" } };
    const engine = client({ international: vi.fn(async () => held), saveInternational: vi.fn(async () => held) });
    render(<CountriesPanel client={engine} prices={store()} currency="GBP" />);
    await press("countries-open");
    await type("countries-pick", "FR");
    await type("countries-price", "9");
    await press("countries-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).toMatchObject({ originCountry: "CN", currency: "EUR", countries: ["DE", "FR"], signerId: "u1" });
  });

  it("takes the price back when the country is refused", async () => {
    const engine = client({ saveInternational: vi.fn(async () => { throw refused("CUSTOMS_NOT_DECLARED"); }) });
    const prices = store();
    render(<CountriesPanel client={engine} prices={prices} currency="GBP" />);
    await press("countries-open");
    await type("countries-pick", "DE");
    await type("countries-price", "12.50");
    await press("countries-save");
    expect(await screen.findByTestId("countries-fault")).toBeTruthy();
    expect(prices.remove).toHaveBeenCalledWith("DE");
  });

  it("takes a country off the list before its price", async () => {
    const order: string[] = [];
    const held = { ...VIEW, shipsAbroad: true, settings: SAVED };
    const engine = client({
      international: vi.fn(async () => held),
      saveInternational: vi.fn(async () => {
        order.push("list");
        return { ...held, settings: { ...SAVED, countries: [] } };
      }),
    });
    const prices = store({
      read: vi.fn(async () => ({ DE: "12.50" })),
      remove: vi.fn(async () => {
        order.push("price");
      }),
    });
    render(<CountriesPanel client={engine} prices={prices} currency="GBP" />);
    await press("countries-remove-DE");
    await waitFor(() => expect(order).toEqual(["list", "price"]));
  });
});

describe("customs defaults", () => {
  const engineWith = (view: EngineInternational = VIEW) =>
    ({
      international: vi.fn(async () => view),
      customsSigners: vi.fn(async () => [{ id: "u1", name: "Ada Owner" }]),
      saveInternational: vi.fn(async () => ({ ...view, settings: SAVED })),
    }) as unknown as EngineCarrier & { saveInternational: ReturnType<typeof vi.fn> };

  it("starts every code empty", async () => {
    render(<CustomsDefaultsPanel client={engineWith()} currency="GBP" />);
    expect(((await screen.findByTestId("defaults-hs")) as HTMLInputElement).value).toBe("");
    expect((screen.getByTestId("defaults-eori") as HTMLInputElement).value).toBe("");
  });

  it("asks for a US filing statement only of a shop in the US, and starts on none", async () => {
    const { unmount } = render(<CustomsDefaultsPanel client={engineWith()} currency="GBP" />);
    await screen.findByTestId("defaults-hs");
    expect(screen.queryByTestId("defaults-filing")).toBeNull();
    unmount();
    render(<CustomsDefaultsPanel client={engineWith({ ...VIEW, ownCountry: "US" })} currency="USD" />);
    const filing = (await screen.findByTestId("defaults-filing")) as HTMLSelectElement;
    expect(filing.value).toBe("");
    expect([...filing.options].map((one) => one.value)).toEqual(["", "NOEEI_30_37_a", "NOEEI_30_36"]);
  });

  it("saves a chosen statement, and sends null to take one back", async () => {
    const engine = engineWith({ ...VIEW, ownCountry: "US", settings: { ...SAVED, filingCode: "NOEEI_30_36" } });
    render(<CustomsDefaultsPanel client={engine} currency="USD" />);
    expect(((await screen.findByTestId("defaults-filing")) as HTMLSelectElement).value).toBe("NOEEI_30_36");
    await type("defaults-filing", "NOEEI_30_37_a");
    await press("defaults-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).toMatchObject({ filingCode: "NOEEI_30_37_a" });
    await waitFor(() => expect((screen.getByTestId("defaults-save") as HTMLButtonElement).getAttribute("aria-busy")).not.toBe("true"));
    await type("defaults-filing", "");
    await press("defaults-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(2));
    expect(engine.saveInternational.mock.calls[1]![0]).toMatchObject({ filingCode: null });
  });

  it("leaves the statement alone for a shop outside the US", async () => {
    const engine = engineWith({ ...VIEW, settings: { ...SAVED, filingCode: "NOEEI_30_36" } });
    render(<CustomsDefaultsPanel client={engine} currency="GBP" />);
    await press("defaults-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).not.toHaveProperty("filingCode");
  });

  it("lists only the people who may sign", async () => {
    render(<CustomsDefaultsPanel client={engineWith()} currency="GBP" />);
    const signer = (await screen.findByTestId("defaults-signer")) as HTMLSelectElement;
    expect([...signer.options].map((one) => one.text)).toEqual([words("defaults.signerYou"), "Ada Owner"]);
  });

  it("names nobody on a first save unless a person chose, so the engine names whoever saved it", async () => {
    const engine = engineWith();
    render(<CustomsDefaultsPanel client={engine} currency="GBP" />);
    await press("defaults-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).not.toHaveProperty("signerId");
  });

  it("saves the export numbers cleaned, and refuses one that cannot be right", async () => {
    const engine = engineWith();
    render(<CustomsDefaultsPanel client={engine} currency="GBP" />);
    await type("defaults-ioss", "not-a-number");
    await press("defaults-save");
    expect(engine.saveInternational).not.toHaveBeenCalled();
    expect(screen.getByText(words("defaults.iossFault"))).toBeTruthy();
    await type("defaults-ioss", "im 3720000224");
    await type("defaults-eori", "gb 123456789000");
    await type("defaults-signer", "u1");
    await press("defaults-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).toMatchObject({ exporter: { eori: "GB123456789000", ioss: "IM3720000224", taxId: { type: "VAT", number: "" } }, signerId: "u1" });
  });

  it("gives a product its own code, and refuses a bad one", async () => {
    const engine = engineWith();
    render(<CustomsDefaultsPanel client={engine} currency="GBP" />);
    await press("defaults-own-open");
    await type("defaults-own-sku", "BAG-1");
    await type("defaults-own-hs", "12");
    await press("defaults-own-save");
    expect(engine.saveInternational).not.toHaveBeenCalled();
    await type("defaults-own-hs", "4202.92");
    await press("defaults-own-save");
    await waitFor(() => expect(engine.saveInternational).toHaveBeenCalledTimes(1));
    expect(engine.saveInternational.mock.calls[0]![0]).toMatchObject({ products: [{ sku: "BAG-1", hsCode: "420292" }] });
  });
});
