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
  describeProductPersonalizer,
  FONT_REFERENCE,
  type ProductPersonalizerFixtures,
} from './product-personalizer.ts';
export {
  describeShippingCarrier,
  type ShippingCarrierFixtures,
} from './shipping-carrier.ts';
export {
  HOST_BEHAVIOURS,
  type HostBehaviour,
} from './host-behaviours.ts';
export {
  describeNumerals,
  latinNumbersIn,
  type NumeralFixtures,
} from './numerals.ts';
export {
  BANNED_IDEAS,
  IDEA_IN_LANGUAGE,
  OTHER_LANGUAGES,
  TIERING_WORDS,
  type BannedIdea,
} from './tiering.ts';
export {
  addressesIn,
  foreignImportsIn,
  offendingAddresses,
  originOf,
  reachesElsewhere,
  SENDERS,
  sendersIn,
  watchEgress,
  type EgressAttempt,
  type InertOrigin,
} from './egress.ts';
export {
  IMPURITIES,
  RESTATEMENTS,
  impuritiesIn,
  restatementsIn,
  type Impurity,
} from './purity.ts';
export {
  addressSchema,
  artworkRefSchema,
  jobSpecSchema,
  parcelSchema,
  personalizationSchema,
  rateSchema,
  shipmentSchema,
  templateSchema,
  trackEventSchema,
  zoneSchema,
} from './schemas.ts';
