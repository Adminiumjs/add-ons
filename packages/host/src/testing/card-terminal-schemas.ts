/**
 * The `card-terminal@1` Zod validators, COPIED from `@adminium/add-on-contracts`
 * (`src/card-terminal.ts`) alongside the types in `../contracts/card-terminal.ts`.
 * Test-only, like `payment-schemas.ts`.
 */

import { z } from 'zod';

import { READER_CHARGE_STATUSES } from '../contracts/card-terminal.ts';
import { credentialCheckSchema, currencyCodeSchema, decimalAmountSchema, paymentEventSchema, refundStateSchema } from './payment-schemas.ts';

const locationSchema = z.object({ id: z.string().min(1).max(255), name: z.string().min(1).max(255) }).strict();

export const readerLocationsSchema = z.object({ ok: z.literal(true), locations: z.array(locationSchema).max(500) }).strict();

const readerSchema = z
  .object({
    id: z.string().min(1).max(255),
    label: z.string().max(255),
    locationId: z.string().max(255).nullable(),
    model: z.string().max(120).nullable(),
    online: z.boolean(),
    lastSeenAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const readerListSchema = z.object({ ok: z.literal(true), readers: z.array(readerSchema).max(500) }).strict();

export const pairingStartedSchema = z
  .object({
    ok: z.literal(true),
    way: z.enum(['enter', 'show']),
    code: z.string().min(1).max(64).nullable(),
    pairing: z.string().min(1).max(512),
    expiresAt: z.number().int().nonnegative(),
  })
  .strict();

export const pairingFinishedSchema = z.union([
  z.object({ ok: z.literal(true), state: z.literal('paired'), reader: readerSchema }).strict(),
  z.object({ ok: z.literal(true), state: z.literal('waiting') }).strict(),
]);

export const readerUnpairedSchema = z.object({ ok: z.literal(true) }).strict();

export const readerChargeStateSchema = z
  .object({
    ok: z.literal(true),
    ref: z.string().min(1).max(255),
    status: z.enum(READER_CHARGE_STATUSES),
    amount: decimalAmountSchema.nullable(),
    tip: decimalAmountSchema.nullable(),
    currency: currencyCodeSchema,
    paymentRef: z.string().min(1).max(255).nullable(),
    brand: z.string().max(40).nullable(),
    last4: z.string().regex(/^\d{4}$/).nullable(),
    approvalCode: z.string().max(32).nullable(),
    interac: z.boolean(),
    failureMessage: z.string().max(2000).nullable(),
  })
  .strict();

export const terminalEventsSchema = z
  .object({ ok: z.literal(true), events: z.array(paymentEventSchema).max(500), cursor: z.string().max(1024).nullable(), more: z.boolean() })
  .strict();

export const CARD_TERMINAL_ANSWER_SCHEMAS = {
  checkCredentials: credentialCheckSchema,
  listLocations: readerLocationsSchema,
  listReaders: readerListSchema,
  startPairing: pairingStartedSchema,
  finishPairing: pairingFinishedSchema,
  unpairReader: readerUnpairedSchema,
  sendToReader: readerChargeStateSchema,
  readerStatus: readerChargeStateSchema,
  cancelOnReader: readerChargeStateSchema,
  refund: refundStateSchema,
  refundStatus: refundStateSchema,
  listEvents: terminalEventsSchema,
} as const;

export type CardTerminalCall = keyof typeof CARD_TERMINAL_ANSWER_SCHEMAS;
