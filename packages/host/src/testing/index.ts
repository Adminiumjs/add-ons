/**
 * `@adminium/add-on-host/testing` — the conformance suites and the validators
 * they run.
 *
 * TEST-ONLY, AND THE SEPARATE ENTRY POINT IS THE ENFORCEMENT. `zod` is the one
 * runtime dependency the host does not carry, an add-on's shipped bundle may
 * take no dependency its host lacks, and nothing under `../` imports anything
 * from here — so no add-on's `dist/` can reach it even by accident. Importing
 * this from a shipped module is the mistake this layout is shaped to prevent.
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
  ENCODING_RESTATEMENTS,
  RAW_CONTROL_EXPLANATION,
  encodingRestatementsIn,
  rawControlOffences,
  rawControlsIn,
  type EncodingRestatement,
  type RawControl,
} from './encoding.ts';
export {
  addressSchema,
  artworkRefSchema,
  documentPictureValueSchema,
  jobSpecSchema,
  parcelSchema,
  personalizationSchema,
  rateSchema,
  shipmentSchema,
  templateSchema,
  trackEventSchema,
  zoneSchema,
} from './schemas.ts';
export {
  describePackShape,
  REQUIRED_ROOT_FILES,
  type PackShapeFixtures,
} from './pack-shape.ts';
export {
  describeLoadable,
  bareSpecifiersIn,
  type LoadableFixtures,
} from './loadable.ts';

export {
  describeDocumentRenderer,
  SAMPLE_DOCUMENT_PICTURE,
  type DocumentRendererFixtures,
} from './document-render.ts';
export {
  PAYMENT_AMOUNT_CASES,
  paymentProviderConformance,
  type PaymentAmountCase,
  type PaymentConformanceDriver,
  type PaymentConformanceOptions,
} from './payment-provider.ts';
export { PAYMENT_ANSWER_SCHEMAS, providerErrorSchema, type PaymentCall } from './payment-schemas.ts';
export { createDemoPaymentBackend, createDemoPaymentProvider, DEMO_SIGNATURE_HEADER } from './payment-demo.ts';
