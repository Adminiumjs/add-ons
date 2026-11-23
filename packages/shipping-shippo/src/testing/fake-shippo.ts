/**
 * An offline Shippo, built from the real test-mode answers read on 2026-11-23:
 * the same field names, the same 201 on a failed label, the same 400 for a test
 * key tracking a real carrier, and tracking numbers that repeat.
 */

import type { ShippingHttpClient, ShippingHttpResponse } from "@adminium/add-on-host/contracts";

/** The prefix alone: a value shaped like a real key is refused by a push's secret scan. */
export const FAKE_KEY = "shippo_test_sample";
export const PDF = new TextEncoder().encode("%PDF-1.4 sample");

type Json = Record<string, unknown>;

export interface SentRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: Json;
}

export interface FakeShippo {
  http: ShippingHttpClient;
  sent: SentRequest[];
  transactions: Json[];
  /** The customs declarations made, in order. */
  declarations: Json[];
  /** Answers the next purchase with this instead of a label. */
  nextPurchase: { status: number; body?: unknown; raw?: string } | "throw" | null;
  /** Overrides one route: return null to fall through. */
  override: ((request: SentRequest) => { status: number; body?: unknown; raw?: string } | null) | null;
}

const rate = (id: string, provider: string, token: string, name: string, amount: string, currency: string, account: string, days: number | null): Json => ({
  object_id: id,
  object_created: "2026-11-23T00:02:05.000Z",
  object_owner: "owner@example.com",
  shipment: "ship_1",
  amount,
  currency,
  amount_local: amount,
  currency_local: currency,
  attributes: [],
  provider,
  arrives_by: null,
  duration_terms: "",
  messages: [],
  carrier_account: account,
  zone: "1",
  test: true,
  servicelevel: { name, token, terms: "", extended_token: token, display_name: null, parent_servicelevel: null },
  estimated_days: days,
  included_insurance_price: null,
});

export const RATES: readonly Json[] = [
  rate("rate_usps", "USPS", "usps_ground_advantage", "Ground Advantage", "6.42", "USD", "acct_usps", 2),
  rate("rate_evri", "Hermes UK", "hermes_uk_parcelshop_dropoff", "ParcelShop Drop-Off", "2.85", "GBP", "acct_evri", null),
  rate("rate_new", "Newco", "newco_standard", "Standard", "9.10", "USD", "acct_newco", 3),
];

const ACCOUNTS: readonly Json[] = [
  { carrier: "usps", carrier_name: "USPS", object_id: "acct_usps", object_owner: "owner@example.com", test: true, active: true, is_shippo_account: true },
  { carrier: "hermes_uk", carrier_name: "Hermes UK", object_id: "acct_evri", object_owner: "owner@example.com", test: true, active: true, is_shippo_account: true },
  { carrier: "dpd_de", carrier_name: "DPD DE", object_id: "acct_dpd", object_owner: "owner@example.com", test: true, active: true, is_shippo_account: true },
  { carrier: "fedex", carrier_name: "FedEx", object_id: "acct_off", object_owner: "owner@example.com", test: true, active: false, is_shippo_account: true },
  { carrier: "newco", carrier_name: "Newco", object_id: "acct_newco", object_owner: "owner@example.com", test: true, active: true, is_shippo_account: false },
];

const TRACK: Json = {
  tracking_number: "SHIPPO_TRANSIT",
  carrier: "shippo",
  transaction: null,
  test: true,
  tracking_status: {
    object_id: "st_2",
    status: "TRANSIT",
    status_details: "Your shipment is in transit.",
    status_date: "2026-11-18T15:21:03.011Z",
    location: { city: "San Francisco", state: "CA", zip: "94103", country: "US" },
  },
  tracking_history: [
    { object_id: "st_1", status: "UNKNOWN", status_details: "The carrier has received the electronic shipment information.", status_date: "2026-11-17T11:21:03.011Z", location: null },
    {
      object_id: "st_2",
      status: "TRANSIT",
      status_details: "Your shipment is in transit.",
      status_date: "2026-11-18T15:21:03.011Z",
      location: { city: "San Francisco", state: "CA", zip: "94103", country: "US" },
    },
  ],
};

function reply(status: number, body?: unknown, raw?: string, contentType = "application/json"): ShippingHttpResponse {
  const text = raw ?? (body === undefined ? "" : JSON.stringify(body));
  return {
    status,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    text: async () => text,
    arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer,
  };
}

export function fakeShippo(): FakeShippo {
  const fake: FakeShippo = {
    sent: [],
    transactions: [],
    declarations: [],
    nextPurchase: null,
    override: null,
    http: async (url, init) => {
      const request: SentRequest = {
        url,
        method: init?.method ?? "GET",
        headers: { ...(init?.headers ?? {}) },
        ...(init?.body === undefined ? {} : { body: JSON.parse(init.body) as Json }),
      };
      fake.sent.push(request);
      const parsed = new URL(url);
      if (parsed.hostname === "deliver.goshippo.com") {
        return {
          status: 200,
          headers: { get: (name) => (name.toLowerCase() === "content-type" ? "application/pdf; qs=1" : null) },
          text: async () => "",
          arrayBuffer: async () => PDF.slice().buffer as ArrayBuffer,
        };
      }
      const forced = fake.override?.(request) ?? null;
      if (forced !== null) return reply(forced.status, forced.body, forced.raw);
      const path = parsed.pathname;

      if (request.method === "POST" && path === "/customs/declarations/") {
        const declaration: Json = { object_id: `decl_${fake.declarations.length + 1}`, object_state: "VALID", test: true, ...request.body };
        fake.declarations.push(declaration);
        return reply(201, declaration);
      }
      if (request.method === "POST" && path === "/shipments/") {
        const zips = [request.body?.address_from, request.body?.address_to].map((a) => (a as Json).zip);
        if (zips.includes("00000")) {
          return reply(201, { status: "SUCCESS", test: true, rates: [], messages: [{ source: "Shippo", code: "", text: "Carrier account x doesn't support one or more shipment options" }, { source: "UPS", code: "", text: "Hard: Invalid Destination Postal Code and City." }] });
        }
        return reply(201, { status: "SUCCESS", test: true, rates: RATES, messages: [] });
      }
      if (request.method === "GET" && path === "/carrier_accounts/") return reply(200, { next: null, previous: null, results: ACCOUNTS });
      if (request.method === "GET" && path.startsWith("/carrier_accounts/")) {
        const account = ACCOUNTS.find((row) => row.object_id === path.split("/")[2]);
        return account === undefined ? reply(404, { detail: "Not found." }) : reply(200, account);
      }
      if (request.method === "GET" && path.startsWith("/rates/")) {
        const found = RATES.find((row) => row.object_id === path.split("/")[2]);
        return found === undefined ? reply(404, { detail: "Not found." }) : reply(200, found);
      }
      if (request.method === "POST" && path === "/transactions/") {
        const next = fake.nextPurchase;
        fake.nextPurchase = null;
        if (next === "throw") throw new Error(`socket hang up calling ${url}`);
        if (next !== null) return reply(next.status, next.body, next.raw);
        const rateId = String(request.body?.rate);
        if (!RATES.some((row) => row.object_id === rateId)) return reply(400, { rate: ["Rate with supplied object_id not found."] });
        const tx: Json = {
          object_state: "VALID",
          status: "SUCCESS",
          object_created: `2026-11-23T00:02:${String(fake.transactions.length).padStart(2, "0")}.000Z`,
          object_updated: "2026-11-23T00:02:07.052Z",
          object_id: `tx_${fake.transactions.length + 1}`,
          object_owner: "owner@example.com",
          test: true,
          rate: rateId,
          // Test numbers repeat: one per rate, however many labels it made.
          tracking_number: `TEST-${rateId}`,
          tracking_status: "UNKNOWN",
          eta: null,
          tracking_url_provider: "https://tools.usps.com/go/TrackConfirmAction_input?origTrackNum=1",
          label_url: `https://deliver.goshippo.com/signed-${fake.transactions.length + 1}.pdf?Signature=abc`,
          // Only a parcel with a declaration has one.
          commercial_invoice_url: fake.declarations.length > 0 ? `https://deliver.goshippo.com/invoice-${fake.transactions.length + 1}.pdf?Signature=abc` : null,
          messages: [],
          metadata: request.body?.metadata,
        };
        fake.transactions.push(tx);
        return reply(201, tx);
      }
      if (request.method === "GET" && path === "/transactions/") {
        const wanted = parsed.searchParams.get("rate");
        return reply(200, { next: null, previous: null, results: fake.transactions.filter((tx) => tx.rate === wanted) });
      }
      if (request.method === "GET" && path.startsWith("/transactions/")) {
        const tx = fake.transactions.find((row) => row.object_id === path.split("/")[2]);
        return tx === undefined ? reply(404, { detail: "Not found." }) : reply(200, tx);
      }
      if (request.method === "GET" && path === "/refunds/") return reply(200, { next: null, previous: null, results: [] });
      if (request.method === "POST" && path === "/refunds/") {
        const tx = fake.transactions.find((row) => row.object_id === request.body?.transaction);
        if (tx === undefined) return reply(400, { transaction: ["Not found."] });
        if (tx.status === "REFUNDED") return reply(400, { detail: "Refund requests are not available for refunded labels, or labels older than 90 days." });
        tx.status = "REFUNDED";
        return reply(201, { object_id: `refund_${String(tx.object_id)}`, status: "SUCCESS", transaction: tx.object_id, test: true });
      }
      if (request.method === "GET" && path.startsWith("/tracks/")) {
        const [, , carrier, number] = path.split("/");
        if (carrier !== "shippo") return reply(400, { detail: `${carrier} is not a valid test tracking carrier. Please use 'shippo'` });
        return number === "SHIPPO_TRANSIT" ? reply(200, TRACK) : reply(404, { detail: "Not found." });
      }
      return reply(500, { detail: `the fake has no route for ${request.method} ${path}` });
    },
  };
  return fake;
}
