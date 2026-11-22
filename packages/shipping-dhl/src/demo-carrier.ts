/**
 * The shared demo transport, answering as DHL Shipping. It holds no credential
 * and makes no call, so both halves may carry it.
 */
import {
  createDemoCarrier as createKitDemoCarrier,
  type DemoCarrier,
  type DemoCarrierOptions,
} from "@adminium/add-on-shipping-kit/demo-carrier.ts";

import { DHL_BRAND } from "./brand.ts";

export { POSTCODE_REFUSAL, postcodeFits, SENDER_POSTCODE_REFUSAL, type DemoCarrier } from "@adminium/add-on-shipping-kit/demo-carrier.ts";

export function createDemoCarrier(options: Omit<DemoCarrierOptions, "brand">): DemoCarrier {
  return createKitDemoCarrier({ ...options, brand: DHL_BRAND });
}
