/**
 * The real transport, under the SAME conformance suite as the demo one.
 *
 * This is the load-bearing test of the whole workstream. "Each delivery company
 * is its own add-on, and the next one is this repo with `carrier.ts` replaced"
 * is only true if the real transport satisfies the contract, and the only way
 * to know that offline is to drive it through the injected HTTP seam with a
 * fake standing in for the carrier.
 *
 * THE FAKE IS BUILT FROM `WIRE`, deliberately. It writes its responses at the
 * same dotted paths the module reads them from, so the test cannot hold a
 * second, quietly-diverging copy of a field name — and when the real paths and
 * field names are finally read from the vendor's documentation and pinned, this
 * suite moves with them for nothing.
 *
 * What it does NOT prove, stated plainly so nobody reads more into a green run:
 * that `WIRE`'s placeholder paths and field names match the vendor's live API.
 * They are marked TODO in the module and unverified until someone reads the
 * documentation and records the date in README.md.
 */

import { describe, expect, it } from "vitest";

import { createDhlCarrier, WIRE, wireIsPinned } from "./carrier.ts";
import { CarrierError } from "@adminium/add-on-host/contracts";
import type { HttpClient, HttpRequest, HttpResponse } from "./http.ts";
import { DEMO_ORIGIN } from "./seed.ts";

/**
 * A destination, supplied here rather than looked up: the address book this
 * add-on used to ship was one host's customer list, and a suite is a host like
 * any other.
 */
const TO = {
  name: "Kestrel Joinery",
  lines: ["The Joinery Shop", "Wold Lane"],
  city: "Nether Wold",
  postcode: "NW3 6BD",
  country: "GB",
};

/** The address the fake refuses: a GB postcode typed onto an IE address. */
const REFUSED_TO = {
  name: "Two Rivers Cycles",
  lines: ["Unit 4, Canal Wharf"],
  city: "Dun Laoghaire",
  postcode: "ML9 4TT",
  country: "IE",
};
import { describeShippingCarrier } from "@adminium/add-on-host/testing";

/** Write a value at a dotted path, creating the objects on the way down. */
function put(target: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(".");
  let node: Record<string, unknown> = target;
  parts.slice(0, -1).forEach((part, i) => {
    const nextIsIndex = /^\d+$/.test(parts[i + 1]!);
    node[part] ??= nextIsIndex ? [] : {};
    node = node[part] as Record<string, unknown>;
  });
  node[parts[parts.length - 1]!] = value;
}

const TRACKING = "00 3400 1234 5678 9012";
const LABEL_ID = "label-9876543210";

/**
 * `WIRE.fields.shipment.id` and `.tracking` resolve to the SAME dotted path,
 * which is not a mistake in the constant: a carrier that identifies a shipment
 * by its tracking number has one field, and the mapper reads it twice. So the
 * fake never assumes an id — it matches the label and cancel routes on the
 * shape of the path rather than on a value it made up, which is also what stops
 * this suite from quietly passing on a wrong `encodeURIComponent`.
 */
const [LABEL_PREFIX, LABEL_SUFFIX] = WIRE.paths.label.split("{id}") as [string, string];

function rateRow(code: string, service: string, amount: number, delivery: string) {
  const row: Record<string, unknown> = {};
  put(row, WIRE.fields.rate.code, code);
  put(row, WIRE.fields.rate.service, service);
  put(row, WIRE.fields.rate.amount, amount);
  put(row, WIRE.fields.rate.currency, "USD");
  // A datetime rather than a date, because a carrier returns one and the
  // module has to cut it back to the contract's ISO date.
  put(row, WIRE.fields.rate.delivery, `${delivery}T12:00:00 GMT+01:00`);
  return row;
}

function eventRow(at: string, place: string, status: string, description: string) {
  const row: Record<string, unknown> = {};
  put(row, WIRE.fields.event.at, at);
  put(row, WIRE.fields.event.place, place);
  put(row, WIRE.fields.event.status, status);
  put(row, WIRE.fields.event.description, description);
  return row;
}

const startOf = (path: string) => path.split("?")[0]!;

/**
 * A carrier that answers like the documentation says one should.
 *
 * It refuses the seeded address the same way the live service would: with a
 * 4xx and its own sentence in the body, which the module must lift into a
 * `CarrierError` without editorialising.
 */
function fakeCarrierApi(): HttpClient & { calls: HttpRequest[] } {
  const calls: HttpRequest[] = [];
  let booked = false;

  return {
    calls,
    async send(request: HttpRequest): Promise<HttpResponse> {
      calls.push(request);

      if (request.path === WIRE.paths.rates) {
        const to = (request.body as { to: { postcode: string; country: string } }).to;
        if (to.country === "IE" && to.postcode.startsWith("ML")) {
          const error: Record<string, unknown> = {};
          put(error, WIRE.fields.error.code, "998");
          put(error, WIRE.fields.error.message, "Postcode not recognised for the destination country");
          return { status: 422, body: error };
        }
        const body: Record<string, unknown> = {};
        put(body, WIRE.fields.rate.list, [
          rateRow("EXP-1200", "Express by 12:00", 18.9, "2026-08-06"),
          rateRow("ECO-2WD", "Economy, second working day", 6.63, "2026-08-07"),
        ]);
        return { status: 200, body };
      }

      if (request.path === WIRE.paths.shipments) {
        booked = true;
        const body: Record<string, unknown> = {};
        put(body, WIRE.fields.shipment.id, TRACKING);
        put(body, WIRE.fields.shipment.tracking, TRACKING);
        put(body, WIRE.fields.shipment.labelId, LABEL_ID);
        put(body, WIRE.fields.shipment.collectionFrom, "2026-08-05T14:00:00");
        put(body, WIRE.fields.shipment.collectionTo, "2026-08-05T17:00:00");
        return { status: 201, body };
      }

      if (request.path.startsWith(startOf(WIRE.paths.tracking))) {
        if (!booked || !request.path.includes(encodeURIComponent(TRACKING))) {
          return { status: 404 };
        }
        const body: Record<string, unknown> = {};
        put(body, WIRE.fields.event.list, [
          eventRow("2026-08-05T14:32:00", "Marlow", "PU", "Shipment picked up"),
          eventRow("2026-08-05T20:14:00", "Kingsbridge", "PL", "Processed at the sorting depot"),
        ]);
        return { status: 200, body };
      }

      if (request.path.startsWith(LABEL_PREFIX) && request.path.endsWith(LABEL_SUFFIX)) {
        const body: Record<string, unknown> = {};
        put(body, WIRE.fields.label.fileId, LABEL_ID);
        put(body, WIRE.fields.label.filename, "label.pdf");
        put(body, WIRE.fields.label.mediaType, "application/pdf");
        put(body, WIRE.fields.label.bytes, 48_112);
        return { status: 200, body };
      }

      if (request.method === "DELETE") return { status: 204 };

      return { status: 404 };
    },
  };
}

const credentials = { apiKey: "test-key", accountNumber: "123456789" };

describeShippingCarrier(
  createDhlCarrier({ http: fakeCarrierApi(), credentials, todayIso: "2026-08-05" }),
  {
    parcel: {
      weightKg: 1.8,
      lengthCm: 34,
      widthCm: 26,
      heightCm: 12,
      contents: "500 × Sample goods",
    },
    from: DEMO_ORIGIN,
    to: TO,
    rejectedTo: REFUSED_TO,
    order: { reference: "MP-4126" },
  },
);

describe("real transport — the plumbing that is actually finished", () => {
  const build = () => {
    const http = fakeCarrierApi();
    return { http, impl: createDhlCarrier({ http, credentials, todayIso: "2026-08-05" }) };
  };

  const parcel = {
    weightKg: 1.8,
    lengthCm: 34,
    widthCm: 26,
    heightCm: 12,
    contents: "500 × Sample goods",
  };

  it("declares its endpoints as unread placeholders until someone pins them", () => {
    // The point of this assertion is that it FAILS the day the paths are
    // filled in — at which point the README's "read on" date must be filled in
    // too, and this test flipped to `toBe(true)` in the same commit.
    expect(wireIsPinned()).toBe(false);
    expect(WIRE.host).toBe("express.api.dhl.com");
  });

  it("sends the credentials as headers and never in a query string", async () => {
    const { http, impl } = build();
    await impl.quote(parcel, DEMO_ORIGIN, TO);
    const request = http.calls[0]!;
    expect(request.headers?.[WIRE.auth.header]).toContain(credentials.apiKey);
    expect(request.headers?.[WIRE.auth.accountHeader]).toBe(credentials.accountNumber);
    expect(request.path).not.toContain(credentials.apiKey);
  });

  it("sorts what the carrier sends into cheapest-first order", async () => {
    const { impl } = build();
    const rates = await impl.quote(parcel, DEMO_ORIGIN, TO);
    expect(rates.map((r) => r.code)).toEqual(["ECO-2WD", "EXP-1200"]);
  });

  it("cuts a carrier datetime back to the contract's ISO date", async () => {
    const { impl } = build();
    const rates = await impl.quote(parcel, DEMO_ORIGIN, TO);
    expect(rates.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.estimatedDelivery))).toBe(true);
  });

  it("lifts a refusal into a CarrierError with the carrier's own words", async () => {
    const { impl } = build();
    try {
      await impl.quote(parcel, DEMO_ORIGIN, REFUSED_TO);
      expect.unreachable("the fake refuses that address");
    } catch (err) {
      const error = err as CarrierError;
      expect(error).toBeInstanceOf(CarrierError);
      expect(error.carrierMessage).toBe("Postcode not recognised for the destination country");
      expect(error.code).toBe("998");
      expect(error.retryable).toBe(true);
    }
  });

  it("marks a credential failure as not worth retrying", async () => {
    const impl = createDhlCarrier({
      http: { send: async () => ({ status: 401, body: { detail: "Unauthorized" } }) },
      credentials,
      todayIso: "2026-08-05",
    });
    await expect(impl.quote(parcel, DEMO_ORIGIN, REFUSED_TO)).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("treats an empty rate list as a refusal, not as a result", async () => {
    const impl = createDhlCarrier({
      http: { send: async () => ({ status: 200, body: { products: [] } }) },
      credentials,
      todayIso: "2026-08-05",
    });
    // A 200 with nothing in it leaves a works staring at a blank panel with no
    // idea whether it is loading, broken or genuinely unservable.
    await expect(impl.quote(parcel, DEMO_ORIGIN, TO)).rejects.toBeInstanceOf(
      CarrierError,
    );
  });

  it("refuses a booking that comes back with no tracking reference", async () => {
    const impl = createDhlCarrier({
      http: {
        send: async (request) =>
          request.path === WIRE.paths.rates
            ? { status: 200, body: { products: [rateRow("ECO-2WD", "Economy", 6.63, "2026-08-07")] } }
            : { status: 201, body: {} },
      },
      credentials,
      todayIso: "2026-08-05",
    });
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    await expect(impl.book(rate!, { reference: "MP-4126" })).rejects.toMatchObject({
      code: "MALFORMED_SHIPMENT",
    });
  });

  it("sends an idempotency key and calls the carrier once for one order", async () => {
    const { http, impl } = build();
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    await impl.book(rate!, { reference: "MP-4126" });
    await impl.book(rate!, { reference: "MP-4126" });
    const bookings = http.calls.filter((c) => c.path === WIRE.paths.shipments);
    expect(bookings).toHaveLength(1);
    expect(bookings[0]!.headers?.[WIRE.auth.idempotencyHeader]).toBe("MP-4126");
  });

  it("turns a 404 on tracking into an empty list rather than an error", async () => {
    const { impl } = build();
    await expect(impl.track("nothing-like-this")).resolves.toEqual([]);
  });

  it("keeps a status code the add-on has never seen, rather than dropping the event", async () => {
    const { impl } = build();
    const [rate] = await impl.quote(parcel, DEMO_ORIGIN, TO);
    const shipment = await impl.book(rate!, { reference: "MP-4126" });
    const events = await impl.track(shipment.tracking);
    expect(events.map((e) => e.status)).toEqual(["PU", "PL"]);
    expect(events[0]!.description).toBe("Shipment picked up");
  });

  it("treats an already-cancelled shipment as cancelled", async () => {
    const impl = createDhlCarrier({
      http: { send: async () => ({ status: 404 }) },
      credentials,
      todayIso: "2026-08-05",
    });
    await expect(impl.cancel("gone-already")).resolves.toBeUndefined();
  });
});
