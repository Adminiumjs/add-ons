/**
 * `@adminium/add-on-host/testing` — the conformance suites and the validators
 * they run.
 *
 * TEST-ONLY, AND THE SEPARATE ENTRY POINT IS THE ENFORCEMENT. `zod` is the one
 * runtime dependency the host does not carry, D7 forbids an add-on's shipped
 * bundle from taking it, and nothing under `../` imports anything from here —
 * so no add-on's `dist/` can reach it even by accident. Importing this from a
 * shipped module is the mistake this layout is shaped to prevent.
 */

export {
  describeArtworkSource,
  type ArtworkSourceFixtures,
} from './artwork-source.ts';
export {
  describeShippingCarrier,
  type ShippingCarrierFixtures,
} from './shipping-carrier.ts';
export {
  addressSchema,
  artworkRefSchema,
  jobSpecSchema,
  parcelSchema,
  rateSchema,
  shipmentSchema,
  trackEventSchema,
} from './schemas.ts';
