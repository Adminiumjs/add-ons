import { describe, expect, it } from "vitest";

import { classifyBookFailure, CarrierError, type Address, type BookingDetails, type CustomsDeclaration, type Parcel, type Rate } from "@adminium/add-on-host/contracts";
import { describeShippingCarrier } from "@adminium/add-on-host/testing";

import { createShippingCarrier, createShippoCarrier, lineValue } from "./carrier.ts";
import { FAKE_KEY, fakeShippo, PDF, type FakeShippo } from "./testing/fake-shippo.ts";

const parcel: Parcel = { weightKg: 1, lengthCm: 20, widthCm: 15, heightCm: 10, contents: "Sample goods" };
const from: Address = { name: "Shop", lines: ["215 Clayton St"], city: "San Francisco", region: "CA", postcode: "94117", country: "US", phone: "+14155550100", email: "shop@example.com" };
const to: Address = { name: "Customer", lines: ["965 Mission St", "Floor 2", "Desk 3"], city: "San Francisco", region: "CA", postcode: "94103", country: "US", phone: "+14155550101", email: "customer@example.com" };
const details: BookingDetails = { parcel, from, to };

const carrierOn = (fake: FakeShippo) => createShippoCarrier({ http: fake.http, apiKey: FAKE_KEY });

async function firstRate(fake: FakeShippo): Promise<Rate> {
  const [rate] = await carrierOn(fake).quote(parcel, from, to);
  return rate!;
}

async function failureOf(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    return { error, ...classifyBookFailure(error) };
  }
  throw new Error("expected a failure");
}

const conformance = fakeShippo();
describeShippingCarrier(
  createShippingCarrier({ http: conformance.http, credentials: { api_key: FAKE_KEY }, todayIso: "2026-11-23" }),
  {
    parcel,
    from,
    to,
    rejectedTo: { ...to, postcode: "00000" },
    order: { reference: "MP-4118", rateRefs: ["rate_usps", "rate_evri", "rate_new"] },
  },
  { bookIsIdempotent: false, eventsAfterBooking: false },
);

describe("quoting", () => {
  it("reads Shippo's rates, cheapest first, keeping the exact decimal", async () => {
    const rates = await carrierOn(fakeShippo()).quote(parcel, from, to);
    expect(rates.map((rate) => rate.code)).toEqual(["hermes_uk_parcelshop_dropoff", "usps_ground_advantage", "newco_standard"]);
    expect(rates[1]).toMatchObject({ amount: 6.42, amountDecimal: "6.42", currency: "USD", estimatedDays: 2, ref: "rate_usps", carrier: "USPS", carrierToken: "usps" });
  });

  it("shows Evri under the name on its vans, and marks only a named drop-off", async () => {
    const rates = await carrierOn(fakeShippo()).quote(parcel, from, to);
    expect(rates[0]).toMatchObject({ carrier: "Evri", carrierToken: "hermes_uk", handover: "drop-off" });
    expect(rates[0]).not.toHaveProperty("estimatedDays");
    expect(rates[1]!.handover).toBe("unknown");
  });

  it("asks Shippo for a carrier token it cannot read off the service", async () => {
    const fake = fakeShippo();
    const rates = await carrierOn(fake).quote(parcel, from, to);
    expect(rates[2]!.carrierToken).toBe("newco");
    expect(fake.sent.filter((request) => request.url.includes("/carrier_accounts/"))).toHaveLength(1);
  });

  it("keeps the customer's phone and e-mail on this server, and sends the shop's", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, from, to);
    const body = fake.sent[0]!.body!;
    expect(body.address_to).not.toHaveProperty("phone");
    expect(body.address_to).not.toHaveProperty("email");
    expect(body.address_from).toMatchObject({ phone: from.phone, email: from.email });
    expect(body.address_to).toMatchObject({ street1: "965 Mission St", street2: "Floor 2", street3: "Desk 3", state: "CA", zip: "94103" });
  });

  it("on a return, the customer is the sender and their contact details still stay here", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, to, from, { purpose: "return" });
    const body = fake.sent[0]!.body!;
    expect(body.address_from).not.toHaveProperty("phone");
    expect(body.address_from).not.toHaveProperty("email");
    expect(body.address_to).toMatchObject({ phone: from.phone });
  });

  it("gives the address reason when no carrier will take it, not the accounts' noise", async () => {
    const failure = await failureOf(() => carrierOn(fakeShippo()).quote(parcel, from, { ...to, postcode: "00000" }));
    expect(failure.outcome).toBe("refused");
    expect(failure.reason).toBe("address");
    expect(failure.carrierMessage).toContain("Invalid Destination Postal Code");
  });

  it("reads a 5xx and a 429 as Shippo not answering, never as a refused parcel", async () => {
    for (const status of [500, 429]) {
      const fake = fakeShippo();
      fake.override = () => ({ status, body: { detail: "busy" } });
      const failure = await failureOf(() => carrierOn(fake).quote(parcel, from, to));
      expect(failure.error).not.toBeInstanceOf(CarrierError);
    }
  });
});

describe("a parcel going abroad", () => {
  const abroad: Address = { name: "Kund", lines: ["Hauptstr. 1"], city: "Berlin", postcode: "10115", country: "DE", phone: "+49301234567" };
  const customs: CustomsDeclaration = {
    contents: "merchandise",
    signer: "Ada Quill",
    certified: true,
    nonDelivery: "return",
    items: [
      { description: "Printed cards", quantity: 3, unitValue: "19.99", currency: "gbp", unitWeightKg: 0.1, originCountry: "GB", hsCode: "49090000", skuCode: "CARD-1", manufacturerCode: "MFR-7" },
      { description: "Envelopes", quantity: 2, unitValue: "0.05", currency: "GBP", unitWeightKg: 0.25, originCountry: "CN" },
    ],
  };

  it("multiplies exactly, with no float in a declared value", () => {
    expect(lineValue("19.99", 3)).toBe("59.97");
    expect(lineValue("0.05", 2)).toBe("0.10");
    expect(lineValue("0.1", 3)).toBe("0.3");
    expect(lineValue("7", 4)).toBe("28");
    expect(lineValue("1234567890.123456", 1000)).toBe("1234567890123.456000");
  });

  it("declares each line's TOTAL value and weight, which is what Shippo's item holds", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, from, abroad, { customs });
    const sent = fake.sent[0]!;
    expect(sent.url).toContain("/customs/declarations/");
    expect(sent.body).toMatchObject({ contents_type: "MERCHANDISE", non_delivery_option: "RETURN", certify: true, certify_signer: "Ada Quill", incoterm: "DDU" });
    expect(sent.body!.items).toEqual([
      { description: "Printed cards", quantity: 3, net_weight: "0.3", mass_unit: "kg", value_amount: "59.97", value_currency: "GBP", origin_country: "GB", tariff_number: "49090000", sku_code: "CARD-1", manufacturer_code: "MFR-7" },
      { description: "Envelopes", quantity: 2, net_weight: "0.5", mass_unit: "kg", value_amount: "0.10", value_currency: "GBP", origin_country: "CN" },
    ]);
  });

  it("names the declaration on the shipment and sends the recipient's phone, and no e-mail", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, from, { ...abroad, email: "kund@example.com" }, { customs });
    const shipment = fake.sent.find((request) => request.url.endsWith("/shipments/"))!;
    expect(shipment.body!.customs_declaration).toBe("decl_1");
    expect(shipment.body!.address_to).toMatchObject({ phone: abroad.phone });
    expect(shipment.body!.address_to).not.toHaveProperty("email");
    expect(fake.declarations).toHaveLength(1);
  });

  it("makes no declaration for a parcel inside one country", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, from, to);
    expect(fake.sent.some((request) => request.url.includes("/customs/"))).toBe(false);
    expect(fake.sent[0]!.body).not.toHaveProperty("customs_declaration");
  });

  it("explains an `other` parcel, because Shippo asks for the words", async () => {
    const fake = fakeShippo();
    await carrierOn(fake).quote(parcel, from, abroad, { customs: { ...customs, contents: "other" } });
    expect(fake.sent[0]!.body).toMatchObject({ contents_type: "OTHER", contents_explanation: "Printed cards" });
  });

  it("refuses an empty declaration before calling anyone", async () => {
    const fake = fakeShippo();
    await expect(carrierOn(fake).quote(parcel, from, abroad, { customs: { ...customs, items: [] } })).rejects.toMatchObject({ reason: "customs", outcome: "refused" });
    expect(fake.sent).toHaveLength(0);
  });

  it("reads Shippo's no as a customs refusal and rates nothing", async () => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.includes("/customs/declarations/") ? { status: 400, body: { items: ["Each item needs a valid origin country."] } } : null);
    const failure = await failureOf(() => carrierOn(fake).quote(parcel, from, abroad, { customs }));
    expect(failure).toMatchObject({ outcome: "refused", reason: "customs" });
    expect(failure.carrierMessage).toContain("origin country");
    expect(fake.sent.some((request) => request.url.endsWith("/shipments/"))).toBe(false);
  });

  it("reads an INVALID declaration as a refusal, though it came back 201", async () => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.includes("/customs/declarations/") ? { status: 201, body: { object_id: "decl_x", object_state: "INVALID", messages: [{ text: "Customs item value is missing." }] } } : null);
    await expect(carrierOn(fake).quote(parcel, from, abroad, { customs })).rejects.toMatchObject({ reason: "customs", outcome: "refused" });
    expect(fake.sent.some((request) => request.url.endsWith("/shipments/"))).toBe(false);
  });

  it("reads a 5xx on the declaration as Shippo not answering", async () => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.includes("/customs/declarations/") ? { status: 503, body: { detail: "busy" } } : null);
    const failure = await failureOf(() => carrierOn(fake).quote(parcel, from, abroad, { customs }));
    expect(failure.error).not.toBeInstanceOf(CarrierError);
  });

  it("lists and fetches the customs invoice of a bought label", async () => {
    const fake = fakeShippo();
    const carrier = carrierOn(fake);
    const [rate] = await carrier.quote(parcel, from, abroad, { customs });
    const shipment = await carrier.book(rate!, { reference: "MP-4120" }, { parcel, from, to: abroad, customs });
    expect(shipment.documents?.map((document) => document.kind)).toEqual(["label", "customs-invoice"]);
    const file = await carrier.fetchDocument!(shipment.id, "customs-invoice");
    expect(file).toMatchObject({ kind: "customs-invoice", mediaType: "application/pdf" });
  });
});

describe("buying a label", () => {
  it("sends the rate, the asked label size and the order's reference, and no retry", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    const before = fake.sent.length;
    const shipment = await carrierOn(fake).book(rate, { reference: "MP-4118" }, { ...details, labelSize: "4x6" });
    const purchases = fake.sent.slice(before);
    expect(purchases).toHaveLength(1);
    expect(purchases[0]!.body).toEqual({ rate: rate.ref, label_file_type: "PDF_4x6", async: false, metadata: "MP-4118" });
    expect(shipment).toMatchObject({ id: "tx_1", labelFileId: "tx_1", test: true, carrier: "Evri", carrierToken: "hermes_uk" });
    expect(JSON.stringify(shipment)).not.toContain("deliver.goshippo.com");
  });

  it.each([
    ["a4", "PDF_A4"],
    ["a6", "PDF_A6"],
    [undefined, "PDF_A4"],
  ] as const)("asks for size %s as %s", async (labelSize, wire) => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    await carrierOn(fake).book(rate, { reference: "MP-1" }, { ...details, ...(labelSize === undefined ? {} : { labelSize }) });
    expect(fake.sent.at(-1)!.body!.label_file_type).toBe(wire);
  });

  it("reads HTTP 201 with status ERROR as a clear refusal", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    fake.nextPurchase = { status: 201, body: { object_state: "VALID", status: "ERROR", tracking_number: "", label_url: "", messages: [{ source: "DPDDE", code: "", text: "There is a problem with the login in DPD DE." }] } };
    const failure = await failureOf(() => carrierOn(fake).book(rate, { reference: "MP-1" }, details));
    expect(failure).toMatchObject({ outcome: "refused", reason: "credentials", code: "shippo_label_error" });
    expect(failure.carrierMessage).toContain("login in DPD DE");
  });

  it("says a non-Latin address may be why, when the carrier gave no words", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    fake.nextPurchase = { status: 201, body: { status: "ERROR", messages: [] } };
    const failure = await failureOf(() => carrierOn(fake).book(rate, { reference: "MP-1" }, { ...details, to: { ...to, lines: ["٩٦٥ شارع ميشن"] } }));
    expect(failure).toMatchObject({ outcome: "refused", reason: "address" });
    expect(failure.carrierMessage).toContain("Latin letters");
  });

  it("does not blame the script of a Latin address with accents", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    fake.nextPurchase = { status: 201, body: { status: "ERROR", messages: [] } };
    const failure = await failureOf(() => carrierOn(fake).book(rate, { reference: "MP-1" }, { ...details, to: { ...to, city: "München", lines: ["Straße 1"] } }));
    expect(failure).toMatchObject({ outcome: "refused", reason: "unavailable" });
  });

  it("reads a rate Shippo no longer has as a clear refusal", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    const failure = await failureOf(() => carrierOn(fake).book({ ...rate, ref: "rate_gone" }, { reference: "MP-1" }, details));
    expect(failure).toMatchObject({ outcome: "refused", reason: "rate-expired" });
  });

  it.each([
    ["a 500", { status: 500, body: { detail: "Internal" } }],
    ["a 502 with HTML", { status: 502, raw: "<html>Bad gateway</html>" }],
    ["a 429", { status: 429, body: { detail: "Too many" } }],
    ["a 400 with no JSON", { status: 400, raw: "bad gateway" }],
    ["a 404", { status: 404, body: { detail: "Not found." } }],
    ["a label still queued", { status: 201, body: { status: "QUEUED", object_id: "tx_q" } }],
    ["a label still waiting", { status: 200, body: { status: "WAITING", object_id: "tx_w" } }],
    ["a status nobody knows", { status: 201, body: { status: "SOMETHING" } }],
    ["no status at all", { status: 201, body: { object_id: "tx_x" } }],
    ["a body that is not JSON", { status: 201, raw: "ok" }],
    ["success with no tracking number", { status: 201, body: { status: "SUCCESS", object_id: "tx_n", tracking_number: "" } }],
  ])("reads %s as unknown, so nothing is bought twice", async (_name, answer) => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    fake.nextPurchase = answer;
    const failure = await failureOf(() => carrierOn(fake).book(rate, { reference: "MP-1" }, details));
    expect(failure.outcome).toBe("unknown");
    expect(failure.retryable).toBe(false);
  });

  it("reads a dropped connection as unknown, and does not repeat the address it was calling", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    fake.nextPurchase = "throw";
    const failure = await failureOf(() => carrierOn(fake).book(rate, { reference: "MP-1" }, details));
    expect(failure).toMatchObject({ outcome: "unknown", code: "shippo_unreachable" });
    expect(failure.carrierMessage).not.toContain("goshippo");
  });
});

describe("recovering a purchase", () => {
  it("names no purchase without a rate to look it up by", async () => {
    const fake = fakeShippo();
    await expect(carrierOn(fake).recover!({ reference: "MP-1" })).resolves.toEqual({ outcome: "no-match" });
    expect(fake.sent).toHaveLength(0);
  });

  it("reports the same rate bought twice as one label and one duplicate", async () => {
    const fake = fakeShippo();
    const rate = await firstRate(fake);
    const carrier = carrierOn(fake);
    const first = await carrier.book(rate, { reference: "MP-1" }, details);
    const second = await carrier.book(rate, { reference: "MP-1" }, details);
    const result = await carrier.recover!({ reference: "MP-1", rateRefs: [rate.ref!] });
    expect(result.outcome).toBe("found");
    if (result.outcome !== "found") return;
    expect(result.shipment.id).toBe(first.id);
    expect(result.duplicates?.map((shipment) => shipment.id)).toEqual([second.id]);
    expect(result.shipment.rate).toMatchObject({ ref: rate.ref, amountDecimal: rate.amountDecimal });
  });

  it("checks each row's own rate, because Shippo's filter is undocumented", async () => {
    const fake = fakeShippo();
    fake.override = (request) =>
      request.url.includes("/transactions/?") ? { status: 200, body: { next: null, results: [{ object_id: "tx_other", status: "SUCCESS", rate: "rate_other", tracking_number: "T" }] } } : null;
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).resolves.toEqual({ outcome: "no-match" });
  });

  it("says not bought only when every rate's every label failed", async () => {
    const fake = fakeShippo();
    fake.override = (request) =>
      request.url.includes("/transactions/?") ? { status: 200, body: { next: null, results: [{ object_id: "tx_e", status: "ERROR", rate: new URL(request.url).searchParams.get("rate"), messages: [{ text: "No." }] }] } } : null;
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).resolves.toEqual({ outcome: "not-bought", carrierMessage: "No." });
  });

  it("never reads silence on one of two rates as not bought", async () => {
    const fake = fakeShippo();
    fake.override = (request) => {
      if (!request.url.includes("/transactions/?")) return null;
      const wanted = new URL(request.url).searchParams.get("rate");
      return { status: 200, body: { next: null, results: wanted === "rate_usps" ? [{ object_id: "tx_e", status: "ERROR", rate: wanted }] : [] } };
    };
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps", "rate_evri"] })).resolves.toEqual({ outcome: "no-match" });
  });

  const onlyRow = (fake: FakeShippo, row: Record<string, unknown>) => {
    fake.override = (request) => (request.url.includes("/transactions/?") ? { status: 200, body: { next: null, results: [{ object_id: "tx_s", rate: "rate_usps", tracking_number: "T", ...row }] } } : null);
  };

  it.each(["QUEUED", "WAITING", "REFUNDPENDING", "SOMETHING_NEW"])("throws on a label that is %s, because no-match would let the engine buy again", async (status) => {
    const fake = fakeShippo();
    onlyRow(fake, { status });
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).rejects.toMatchObject({ code: "shippo_purchase_unsettled" });
  });

  it("reads a refunded label as neither found nor not bought", async () => {
    const fake = fakeShippo();
    onlyRow(fake, { status: "REFUNDED" });
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).resolves.toEqual({ outcome: "no-match" });
  });

  it("finds a label whose refund was rejected, because it is still paid for and valid", async () => {
    const fake = fakeShippo();
    onlyRow(fake, { status: "REFUNDREJECTED" });
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).resolves.toMatchObject({ outcome: "found", shipment: { id: "tx_s" } });
  });

  it("stops a rebuy on a paid label with no number", async () => {
    const fake = fakeShippo();
    onlyRow(fake, { status: "SUCCESS", tracking_number: "" });
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).rejects.toMatchObject({ code: "shippo_no_tracking" });
  });

  it("keeps a good label first, and counts a numberless one as a duplicate", async () => {
    const fake = fakeShippo();
    fake.override = (request) =>
      request.url.includes("/transactions/?")
        ? {
            status: 200,
            body: {
              next: null,
              results: [
                { object_id: "tx_blank", object_created: "2026-11-23T00:00:00Z", status: "SUCCESS", rate: "rate_usps", tracking_number: "" },
                { object_id: "tx_good", object_created: "2026-11-23T00:01:00Z", status: "SUCCESS", rate: "rate_usps", tracking_number: "T1" },
              ],
            },
          }
        : null;
    const result = await carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] });
    expect(result).toMatchObject({ outcome: "found", shipment: { id: "tx_good", tracking: "T1" } });
    expect(result.outcome === "found" ? result.duplicates?.map((one) => one.id) : []).toEqual(["tx_blank"]);
  });

  it("refuses to answer from a list it could not read to the end", async () => {
    const fake = fakeShippo();
    fake.override = (request) =>
      request.url.includes("/transactions/?") ? { status: 200, body: { next: "https://evil.example/more", results: [{ object_id: "tx_e", status: "ERROR", rate: "rate_usps" }] } } : null;
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).rejects.toMatchObject({ code: "shippo_list_cut_off" });
  });

  it("refuses more rates than it will look up, rather than dropping some", async () => {
    const fake = fakeShippo();
    const rateRefs = Array.from({ length: 21 }, (_, index) => `rate_${String(index)}`);
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs })).rejects.toMatchObject({ code: "shippo_too_many_rates" });
    expect(fake.sent).toHaveLength(0);
  });

  it("throws rather than answer when Shippo cannot be asked", async () => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.includes("/transactions/?") ? { status: 503, body: { detail: "down" } } : null);
    await expect(carrierOn(fake).recover!({ reference: "MP-1", rateRefs: ["rate_usps"] })).rejects.toBeInstanceOf(CarrierError);
  });
});

describe("label files", () => {
  it("gets a fresh address with the key, then fetches the file without it", async () => {
    const fake = fakeShippo();
    const carrier = carrierOn(fake);
    const shipment = await carrier.book(await firstRate(fake), { reference: "MP-1" }, details);
    const file = await carrier.fetchDocument!(shipment.id, "label");
    expect(file).toEqual({ kind: "label", mediaType: "application/pdf", bytes: PDF });
    const [read, download] = fake.sent.slice(-2);
    expect(read!.url).toContain(`/transactions/${shipment.id}`);
    expect(read!.headers.authorization).toBe(`ShippoToken ${FAKE_KEY}`);
    expect(new URL(download!.url).hostname).toBe("deliver.goshippo.com");
    expect(download!.headers).toEqual({ accept: "application/pdf" });
  });

  it.each(["https://evil.example/label.pdf", "http://deliver.goshippo.com/label.pdf", "not a url"])("refuses a file address of %s", async (label_url) => {
    const fake = fakeShippo();
    const carrier = carrierOn(fake);
    const shipment = await carrier.book(await firstRate(fake), { reference: "MP-1" }, details);
    fake.transactions[0]!.label_url = label_url;
    const before = fake.sent.length;
    await expect(carrier.fetchDocument!(shipment.id, "label")).rejects.toMatchObject({ code: "shippo_bad_file_address" });
    expect(fake.sent.slice(before).some((request) => !request.url.includes("api.goshippo.com"))).toBe(false);
  });

  it("says plainly when a label has no customs invoice", async () => {
    const fake = fakeShippo();
    const carrier = carrierOn(fake);
    const shipment = await carrier.book(await firstRate(fake), { reference: "MP-1" }, details);
    await expect(carrier.fetchDocument!(shipment.id, "customs-invoice")).rejects.toMatchObject({ code: "shippo_no_file" });
  });
});

describe("tracking", () => {
  it("reads Shippo's history, with the place when there is one", async () => {
    const events = await carrierOn(fakeShippo()).track("SHIPPO_TRANSIT", { carrierToken: "shippo" });
    expect(events).toHaveLength(2);
    expect(events[0]).not.toHaveProperty("place");
    expect(events[1]).toMatchObject({ status: "TRANSIT", place: "San Francisco, CA, US", at: "2026-11-18T15:21:03.011Z" });
  });

  it("answers empty for a test key asking about a real carrier's number", async () => {
    await expect(carrierOn(fakeShippo()).track("9205", { carrierToken: "usps" })).resolves.toEqual([]);
  });

  it("throws a code the engine's stop-on-limit can see on a 429", async () => {
    const fake = fakeShippo();
    fake.override = () => ({ status: 429, body: { detail: "Too many" } });
    const error = (await failureOf(() => carrierOn(fake).track("X", { carrierToken: "usps" }))).error as CarrierError;
    expect(error.name).toBe("CarrierError");
    expect(error.code).toMatch(/rate_limited/);
    expect(error.code).toMatch(/rate.?limit|too.?many|429/i);
  });

  it("does not read a real failure as an empty history", async () => {
    const fake = fakeShippo();
    fake.override = () => ({ status: 400, body: { detail: "Something else" } });
    await expect(carrierOn(fake).track("X", { carrierToken: "usps" })).rejects.toBeInstanceOf(CarrierError);
  });
});

describe("refunds", () => {
  it("reports a refund, and a second request reports the first one's result", async () => {
    const fake = fakeShippo();
    const carrier = carrierOn(fake);
    const shipment = await carrier.book(await firstRate(fake), { reference: "MP-1" }, details);
    await expect(carrier.requestCancel!(shipment.id)).resolves.toMatchObject({ state: "refunded", reference: "refund_tx_1" });
    await expect(carrier.requestCancel!(shipment.id)).resolves.toEqual({ state: "refunded" });
    await expect(carrier.cancelStatus!(shipment.id)).resolves.toEqual({ state: "refunded" });
  });

  it.each([
    ["QUEUED", "requested"],
    ["PENDING", "pending"],
    ["SUCCESS", "refunded"],
    ["ERROR", "refused"],
  ])("reads a refund that is %s as %s", async (status, state) => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.endsWith("/refunds/") ? { status: 201, body: { object_id: "r1", status } } : null);
    await expect(carrierOn(fake).requestCancel!("tx_1")).resolves.toMatchObject({ state });
  });

  it.each([
    ["REFUNDPENDING", "pending"],
    ["REFUNDREJECTED", "refused"],
    ["SUCCESS", "requested"],
  ])("reads a label that is %s as %s", async (status, state) => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.includes("/transactions/tx_1") ? { status: 200, body: { object_id: "tx_1", status } } : null);
    await expect(carrierOn(fake).cancelStatus!("tx_1")).resolves.toEqual({ state });
  });

  const secondRequest = (fake: FakeShippo, refunds: Record<string, unknown>[], next: string | null = null) => {
    fake.override = (request) => {
      if (request.method === "POST" && request.url.endsWith("/refunds/")) return { status: 400, body: { detail: "Refund requests are not available." } };
      if (request.url.includes("/transactions/tx_1")) return { status: 200, body: { object_id: "tx_1", status: "SUCCESS" } };
      if (request.method === "GET" && request.url.includes("/refunds/")) return { status: 200, body: { next, results: refunds } };
      return null;
    };
  };

  it("reads a queued earlier request as still going, while the label says SUCCESS", async () => {
    const fake = fakeShippo();
    secondRequest(fake, [{ object_id: "r_other", status: "SUCCESS", transaction: "tx_9" }, { object_id: "r1", status: "QUEUED", transaction: "tx_1" }]);
    await expect(carrierOn(fake).requestCancel!("tx_1")).resolves.toEqual({ state: "requested", reference: "r1" });
  });

  it("reads a 400 with no earlier request as Shippo's refusal", async () => {
    const fake = fakeShippo();
    secondRequest(fake, [{ object_id: "r_other", status: "SUCCESS", transaction: "tx_9" }]);
    await expect(carrierOn(fake).requestCancel!("tx_1")).resolves.toEqual({ state: "refused", carrierMessage: "Refund requests are not available." });
  });

  it("does not say refused when it could not read every refund", async () => {
    const fake = fakeShippo();
    secondRequest(fake, [], "https://evil.example/more");
    await expect(carrierOn(fake).requestCancel!("tx_1")).rejects.toMatchObject({ code: "shippo_refund_unclear" });
  });

  it("makes a plain cancel throw when the refund is refused", async () => {
    const fake = fakeShippo();
    fake.override = (request) => (request.url.endsWith("/refunds/") ? { status: 201, body: { status: "ERROR" } } : null);
    await expect(carrierOn(fake).cancel("tx_1")).rejects.toBeInstanceOf(CarrierError);
  });
});

describe("checking a key", () => {
  it("takes test or live from Shippo's answer, not the key's prefix", async () => {
    const fake = fakeShippo();
    const live = createShippoCarrier({ http: fake.http, apiKey: "shippo_test_sample" });
    fake.override = (request) =>
      request.url.includes("/carrier_accounts/") ? { status: 200, body: { next: null, results: [{ carrier: "usps", carrier_name: "USPS", test: false, active: true, is_shippo_account: true }] } } : null;
    await expect(live.checkCredentials!({ country: "US" })).resolves.toMatchObject({ outcome: "ok", mode: "live" });
  });

  it("never calls a live key test, even if its accounts say test", async () => {
    const fake = fakeShippo();
    const live = createShippoCarrier({ http: fake.http, apiKey: "shippo_live_fake" });
    await expect(live.checkCredentials!({ country: "US" })).resolves.toMatchObject({ outcome: "ok", mode: "live" });
  });

  it("lists the carriers for the shop's country, its own accounts, and no switched-off one", async () => {
    const check = await carrierOn(fakeShippo()).checkCredentials!({ country: "GB" });
    expect(check).toMatchObject({ outcome: "ok", mode: "test", carriers: ["Evri", "Newco"] });
  });

  it("tells a refused key from an unreachable service", async () => {
    const wrong = fakeShippo();
    wrong.override = () => ({ status: 401, body: { detail: "Token does not exist" } });
    await expect(carrierOn(wrong).checkCredentials!()).resolves.toEqual({ outcome: "refused", carrierMessage: "Token does not exist" });
    const down = fakeShippo();
    down.override = () => ({ status: 503, body: { detail: "down" } });
    await expect(carrierOn(down).checkCredentials!()).resolves.toEqual({ outcome: "unreachable" });
  });

  it("does not follow a next page off Shippo's own API", async () => {
    const fake = fakeShippo();
    fake.override = (request) =>
      request.url.includes("/carrier_accounts/") ? { status: 200, body: { next: "https://evil.example/steal", results: [{ carrier: "usps", carrier_name: "USPS", test: true, active: true }] } } : null;
    await carrierOn(fake).checkCredentials!();
    expect(fake.sent.every((request) => new URL(request.url).hostname === "api.goshippo.com")).toBe(true);
  });
});
