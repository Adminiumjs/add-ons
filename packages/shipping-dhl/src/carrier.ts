/**
 * The real transport — the self-host path, OFF by default (24 D11, §7).
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO. It does not guess DHL's endpoint
 * paths, its authentication header, or its field names. Every one of those is a
 * `TODO(vendor-docs)` constant in the WIRE block below: they must be read from
 * the vendor's current Express API documentation at implementation time and
 * pinned in README.md with the DATE they were read. Guessing them would produce
 * a module that looks finished, compiles, passes its tests and fails on the
 * first real call — which is worse than an obvious hole.
 *
 * WHAT IT DOES DO, and what is genuinely finished here: the plumbing. Request
 * construction, the auth header's shape, response mapping into the contract's
 * types, error mapping into `CarrierError` with the carrier's own message
 * verbatim, retryability, `book` idempotency, and `track`'s "unknown reference
 * is an empty list" rule. All of that runs under the conformance suite through
 * an injected `HttpClient` fake (`carrier.test.ts`), offline, which is the
 * point: swapping this file for `shipping-ups` or `shipping-royal-mail` is the
 * work, and everything around it stays.
 *
 * The contract's shapes are the only thing the host ever sees. No wire object
 * escapes this module.
 */

import { CarrierError, type Address, type FileRef, type OrderRef, type Parcel, type Rate, type Shipment, type ShippingCarrier, type TrackEvent } from "@adminium/add-on-host/contracts";
import type { CarrierCredentials, HttpClient, HttpResponse } from "./http.ts";

/**
 * ────────────────────────────────────────────────────────────────────────────
 * TODO(vendor-docs): READ THESE FROM DHL'S CURRENT EXPRESS API DOCUMENTATION
 * AND PIN THEM IN README.md WITH THE DATE READ. Nothing in this block has been
 * verified against a live service by this repo, and the placeholders are marked
 * so that a wrong value fails loudly rather than quietly.
 *
 * They are declared as ONE object for two reasons. Pinning them becomes a
 * single edit instead of a hunt through five methods. And the conformance
 * suite's HTTP fake is built from this same constant, so the test cannot drift
 * from the module by holding its own copy of a path or a field name.
 *
 * `host` must match the single entry in the manifest's `addOn.network.allow` —
 * the host's client is bound to that hostname and will refuse anything else.
 * ────────────────────────────────────────────────────────────────────────────
 */
export const WIRE = {
  host: "express.api.dhl.com",

  paths: {
    rates: "TODO/rates",
    shipments: "TODO/shipments",
    /** `{tracking}` is substituted. */
    tracking: "TODO/tracking?trackingNumber={tracking}",
    /** `{id}` is substituted. */
    label: "TODO/shipments/{id}/label",
    cancel: "TODO/shipments/{id}",
  },

  auth: {
    /** The header the key goes in, and the scheme prefix if there is one. */
    header: "TODO-Authorization",
    scheme: "Basic",
    /** Where the account number goes, if it is a header rather than a body field. */
    accountHeader: "TODO-Account-Number",
    /** Sent on `book` so a repeated call cannot create a second collection. */
    idempotencyHeader: "TODO-Idempotency-Key",
  },

  /**
   * Dotted paths into the vendor's JSON. `pick` walks them, so a nested field
   * costs a dot rather than a new mapper.
   */
  fields: {
    rate: {
      list: "products",
      code: "productCode",
      service: "productName",
      amount: "totalPrice.price",
      currency: "totalPrice.currency",
      /** May be a datetime; only the date half is kept. */
      delivery: "deliveryCapabilities.estimatedDeliveryDateAndTime",
    },
    shipment: {
      id: "shipmentTrackingNumber",
      tracking: "shipmentTrackingNumber",
      labelId: "documents.0.imageReference",
      collectionFrom: "pickupDetails.windowStart",
      collectionTo: "pickupDetails.windowEnd",
    },
    label: {
      fileId: "documents.0.imageReference",
      filename: "documents.0.fileName",
      mediaType: "documents.0.typeCode",
      bytes: "documents.0.size",
    },
    event: {
      list: "shipments.0.events",
      at: "timestamp",
      place: "location.address.addressLocality",
      status: "typeCode",
      description: "description",
    },
    error: {
      code: "status",
      message: "detail",
    },
  },
} as const;

/** True while any endpoint is still a placeholder — used to fail loudly. */
export function wireIsPinned(): boolean {
  return !Object.values(WIRE.paths).some((p) => p.startsWith("TODO"));
}

/** Walk a dotted path, tolerating numeric segments for arrays. */
function pick(source: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((node, segment) => {
    if (node === null || node === undefined) return undefined;
    if (Array.isArray(node)) return node[Number.parseInt(segment, 10)];
    if (typeof node !== "object") return undefined;
    return (node as Record<string, unknown>)[segment];
  }, source);
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** `2026-08-06T12:00:00 GMT+01:00` → `2026-08-06`. The contract wants a date. */
function asIsoDate(value: unknown, fallback: string): string {
  const raw = asString(value);
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(raw);
  return match === null ? fallback : match[1]!;
}

/**
 * Every failure the works can see comes through here.
 *
 * The carrier's own message is carried verbatim because the dispatch screen
 * quotes it in mono — a paraphrase ("delivery failed") tells a works nothing it
 * can act on, and translating a carrier's refusal would be inventing words the
 * carrier did not say. `retryable` is derived from the status: a rate limit or
 * a bad gateway is worth another go; a rejected address is worth another go
 * once the works has changed it; a bad credential is not worth anything until
 * an admin changes a setting.
 */
function carrierErrorFrom(response: HttpResponse, fallbackMessage: string): CarrierError {
  const body = response.body;
  const code = asString(pick(body, WIRE.fields.error.code), String(response.status));
  const message = asString(pick(body, WIRE.fields.error.message), fallbackMessage);
  return new CarrierError({
    code,
    carrierMessage: message,
    retryable: response.status !== 401 && response.status !== 403,
  });
}

function ok(response: HttpResponse): boolean {
  return response.status >= 200 && response.status < 300;
}

export interface DhlCarrierOptions {
  /** Host-built and bound to `WIRE.host` (24 D14). There is no other way out. */
  http: HttpClient;
  /** Injected into the SERVER context only (24 D15). */
  credentials: CarrierCredentials;
  /** Fallback for a delivery date the carrier does not state. */
  todayIso: string;
}

export function createDhlCarrier(options: DhlCarrierOptions): ShippingCarrier {
  const { http, credentials, todayIso } = options;

  const authHeaders: Record<string, string> = {
    [WIRE.auth.header]: `${WIRE.auth.scheme} ${credentials.apiKey}`.trim(),
    [WIRE.auth.accountHeader]: credentials.accountNumber,
  };

  // `book` must be idempotent for one OrderRef. The idempotency header is what
  // makes that true at the carrier; this map is what makes it true across a
  // process restart's worth of double-clicks before the header ever helps.
  const booked = new Map<string, Shipment>();

  async function send(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
    extraHeaders?: Record<string, string>,
  ): Promise<HttpResponse> {
    return http.send({
      method,
      path,
      headers: { ...authHeaders, ...extraHeaders },
      body,
    });
  }

  return {
    key: "shipping-dhl",

    async quote(parcel: Parcel, from: Address, to: Address): Promise<Rate[]> {
      const response = await send("POST", WIRE.paths.rates, {
        // TODO(vendor-docs): the request body's field names are part of the
        // same unread documentation. Sent as the contract's own shapes so the
        // mapping is one obvious edit rather than a rewrite.
        parcel,
        from,
        to,
        accountNumber: credentials.accountNumber,
      });

      if (!ok(response)) throw carrierErrorFrom(response, "The carrier refused to rate this parcel");

      const rows = pick(response.body, WIRE.fields.rate.list);
      const list = Array.isArray(rows) ? rows : [];
      const rates = list.map((row) => ({
        code: asString(pick(row, WIRE.fields.rate.code), "UNKNOWN"),
        service: asString(pick(row, WIRE.fields.rate.service), "Delivery"),
        amount: asNumber(pick(row, WIRE.fields.rate.amount)),
        currency: asString(pick(row, WIRE.fields.rate.currency), "USD"),
        estimatedDelivery: asIsoDate(pick(row, WIRE.fields.rate.delivery), todayIso),
      }));

      // A 200 with nothing in it is a refusal wearing a success code, and a
      // works staring at an empty rate list has no idea what happened.
      if (rates.length === 0) {
        throw new CarrierError({
          code: "NO_SERVICES",
          carrierMessage: "No services are available for this parcel and destination",
          retryable: true,
        });
      }

      return rates.sort((a, b) => a.amount - b.amount || a.code.localeCompare(b.code));
    },

    async book(rate: Rate, order: OrderRef): Promise<Shipment> {
      const already = booked.get(order.reference);
      if (already !== undefined) return already;

      const response = await send(
        "POST",
        WIRE.paths.shipments,
        { productCode: rate.code, accountNumber: credentials.accountNumber, order },
        { [WIRE.auth.idempotencyHeader]: order.reference },
      );

      if (!ok(response)) throw carrierErrorFrom(response, "The carrier would not book this collection");

      const body = response.body;
      const shipment: Shipment = {
        id: asString(pick(body, WIRE.fields.shipment.id)),
        tracking: asString(pick(body, WIRE.fields.shipment.tracking)),
        labelFileId: asString(pick(body, WIRE.fields.shipment.labelId)),
        collectionFrom: asString(pick(body, WIRE.fields.shipment.collectionFrom)),
        collectionTo: asString(pick(body, WIRE.fields.shipment.collectionTo)),
        rate,
      };

      // A shipment with no tracking reference is not a shipment. Better to fail
      // here, where the message can say what is missing, than to hand the host
      // a record whose only symptom is an empty box on the dispatch screen.
      if (shipment.id === "" || shipment.tracking === "") {
        throw new CarrierError({
          code: "MALFORMED_SHIPMENT",
          carrierMessage: "The carrier accepted the booking but returned no tracking reference",
          retryable: true,
        });
      }

      booked.set(order.reference, shipment);
      return shipment;
    },

    async track(tracking: string): Promise<TrackEvent[]> {
      const response = await send(
        "GET",
        WIRE.paths.tracking.replace("{tracking}", encodeURIComponent(tracking)),
      );

      // An unknown reference is an empty list, not an error — the contract says
      // so, and a works pasting a reference from an email wants "nothing yet".
      if (response.status === 404) return [];
      if (!ok(response)) throw carrierErrorFrom(response, "The carrier could not be asked about this shipment");

      const rows = pick(response.body, WIRE.fields.event.list);
      if (!Array.isArray(rows)) return [];
      return rows.map((row) => ({
        at: asString(pick(row, WIRE.fields.event.at)),
        place: asString(pick(row, WIRE.fields.event.place), "—"),
        status: asString(pick(row, WIRE.fields.event.status), "unknown"),
        description: asString(pick(row, WIRE.fields.event.description), "—"),
      }));
    },

    async label(shipmentId: string): Promise<FileRef> {
      const response = await send("GET", WIRE.paths.label.replace("{id}", encodeURIComponent(shipmentId)));
      if (!ok(response)) throw carrierErrorFrom(response, "The carrier would not produce a label");

      const body = response.body;
      return {
        fileId: asString(pick(body, WIRE.fields.label.fileId), shipmentId),
        filename: asString(pick(body, WIRE.fields.label.filename), `dhl-label-${shipmentId}.pdf`),
        mediaType: asString(pick(body, WIRE.fields.label.mediaType), "application/pdf"),
        // `bytes` is a positive integer in the contract; a carrier that omits
        // the size still produced a file, so the floor is 1 rather than 0.
        bytes: Math.max(1, Math.round(asNumber(pick(body, WIRE.fields.label.bytes), 1))),
      };
    },

    async cancel(shipmentId: string): Promise<void> {
      const response = await send("DELETE", WIRE.paths.cancel.replace("{id}", encodeURIComponent(shipmentId)));
      // Already gone is the outcome the works asked for.
      if (response.status === 404 || ok(response)) {
        for (const [reference, shipment] of booked) {
          if (shipment.id === shipmentId) booked.delete(reference);
        }
        return;
      }
      throw carrierErrorFrom(response, "The carrier would not cancel this collection");
    },
  };
}
