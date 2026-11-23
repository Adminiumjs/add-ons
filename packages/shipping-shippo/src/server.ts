/**
 * The server half's entry point, kept apart from `index.ts` because everything
 * reachable from that file ends up in a browser. The manifest's
 * `addOn.provides[].server` resolves here, and the engine loads
 * `createShippingCarrier` by name.
 */

export { createShippingCarrier, createShippoCarrier, WIRE, type ShippoCarrierOptions } from "./carrier.ts";
export { CarrierError } from "@adminium/add-on-host/contracts";
