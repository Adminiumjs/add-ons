/**
 * The SERVER half's entry point (24 §5.3, D15).
 *
 * Kept apart from `src/index.ts` for one reason, and it is not organisation:
 * `index.ts` is what the client bundle is built from, so everything reachable
 * from it ends up in a browser. The real transport reads `api_key` and
 * `account_number` — settings marked `secret: true` — and those may only ever
 * be injected into the server context. Two entry points is how that becomes a
 * property of the build rather than a promise in a review.
 *
 * The manifest names both halves: `addOn.provides[].server` and
 * `addOn.demoTransport` resolve here; `addOn.slots[].client` resolves to the
 * bundle built from `index.ts`.
 *
 * The demo transport is exported from BOTH halves on purpose. It holds no
 * credential and makes no call, so it is safe in a browser — and it has to be
 * in one, because in demo mode there is no server for it to run on.
 */

export { createDhlCarrier, WIRE, wireIsPinned, type DhlCarrierOptions } from "./carrier.ts";
export { createDemoCarrier, postcodeFits, POSTCODE_REFUSAL, type DemoCarrier } from "./demo-carrier.ts";
export type { CarrierCredentials, HttpClient, HttpRequest, HttpResponse } from "./http.ts";
export { PINNED_NOW, type Clock } from "./clock.ts";
export type {
  Address,
  FileRef,
  OrderRef,
  Parcel,
  Rate,
  Shipment,
  ShippingCarrier,
  TrackEvent,
} from "@adminium/add-on-host/contracts";
export { CarrierError } from "@adminium/add-on-host/contracts";
