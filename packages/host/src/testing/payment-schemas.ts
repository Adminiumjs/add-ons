/**
 * The `payment-provider@1` Zod validators, COPIED from
 * `@adminium/add-on-contracts` (`src/payment-provider.ts`) alongside the types in
 * `../contracts/payment-provider.ts`. Test-only, like `schemas.ts`.
 */

import { z } from 'zod';

import {
  CHECKOUT_STATUSES,
  PAYMENT_EVENT_KINDS,
  PROVIDER_ERROR_CODES,
  REFUND_STATUSES,
} from '../contracts/payment-provider.ts';

export const providerErrorSchema = z
  .object({
    ok: z.literal(false),
    code: z.enum(PROVIDER_ERROR_CODES),
    providerMessage: z.string().max(2000),
    retryable: z.boolean(),
  })
  .strict();

/** A non-negative decimal amount as text: "120.00", "12000", "45.250". */
export const decimalAmountSchema = z.string().regex(/^(0|[1-9]\d{0,17})(\.\d{1,6})?$/, 'a decimal amount such as 120.00');

/** An ISO 4217 code in capitals. */
export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/, 'an ISO 4217 code such as EUR');

/** An amount in the provider's smallest unit, as integer text (no float ever holds money). */
export const minorAmountSchema = z.string().regex(/^(0|[1-9]\d{0,20})$/, 'an integer amount in the smallest unit');

export const minorAmountAnswerSchema = z.object({ minor: minorAmountSchema, currency: currencyCodeSchema }).strict();

export const credentialCheckSchema = z
  .object({
    ok: z.literal(true),
    accountId: z.string().min(1).max(255),
    livemode: z.boolean(),
    missing: z.array(z.string().min(1).max(200)).max(50),
  })
  .strict();

export const checkoutCreatedSchema = z
  .object({
    ok: z.literal(true),
    ref: z.string().min(1).max(255),
    url: z.string().url().max(2048),
    expiresAt: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const paidWithSchema = z
  .object({
    method: z.string().min(1).max(64),
    label: z
      .string()
      .min(1)
      .max(120)
      .refine((text) => !/\d{9,}/.test(text.replace(/[\s-]/g, '')), 'never a card or account number'),
    delayed: z.boolean(),
  })
  .strict();

export const checkoutStateSchema = z
  .object({
    ok: z.literal(true),
    ref: z.string().min(1).max(255),
    status: z.enum(CHECKOUT_STATUSES),
    attemptId: z.string().min(1).max(255).nullable(),
    amount: decimalAmountSchema.nullable(),
    currency: currencyCodeSchema.nullable(),
    livemode: z.boolean(),
    paymentRef: z.string().min(1).max(255).nullable(),
    paidWith: paidWithSchema.nullable(),
    settledAt: z.number().int().nonnegative().nullable(),
    failureMessage: z.string().max(2000).nullable(),
  })
  .strict()
  .refine((state) => (state.amount === null) === (state.currency === null), 'amount and currency come together')
  .refine((state) => state.status !== 'succeeded' || state.amount !== null, 'a success says what was taken');

export const expireResultSchema = z
  .object({ ok: z.literal(true), ref: z.string().min(1).max(255), status: z.enum(CHECKOUT_STATUSES) })
  .strict();

export const refundStateSchema = z
  .object({
    ok: z.literal(true),
    ref: z.string().min(1).max(255),
    paymentRef: z.string().min(1).max(255),
    status: z.enum(REFUND_STATUSES),
    amount: decimalAmountSchema,
    currency: currencyCodeSchema,
    failureMessage: z.string().max(2000).nullable(),
  })
  .strict();

export const paymentEventSchema = z
  .object({
    ok: z.literal(true),
    eventId: z.string().min(1).max(255),
    type: z.string().min(1).max(120),
    kind: z.enum(PAYMENT_EVENT_KINDS),
    checkoutRef: z.string().min(1).max(255).nullable(),
    paymentRef: z.string().min(1).max(255).nullable(),
    refundRef: z.string().min(1).max(255).nullable(),
    livemode: z.boolean(),
    occurredAt: z.number().int().nonnegative(),
  })
  .strict();

export const missedEventsSchema = z
  .object({
    ok: z.literal(true),
    events: z.array(paymentEventSchema).max(500),
    cursor: z.string().max(1024).nullable(),
    more: z.boolean(),
  })
  .strict();

export const methodListSchema = z
  .object({
    ok: z.literal(true),
    methods: z
      .array(
        z
          .object({ id: z.string().min(1).max(64), label: z.string().min(1).max(120), delayed: z.boolean() })
          .strict(),
      )
      .max(100),
  })
  .strict();

/**
 * The schema each answer must pass, by call. The engine parses every answer
 * with these; a provider whose answer fails is treated as unavailable.
 */
export const PAYMENT_ANSWER_SCHEMAS = {
  checkCredentials: credentialCheckSchema,
  createCheckout: checkoutCreatedSchema,
  status: checkoutStateSchema,
  complete: checkoutStateSchema,
  expire: expireResultSchema,
  refund: refundStateSchema,
  refundStatus: refundStateSchema,
  verifyWebhook: paymentEventSchema,
  listMissedEvents: missedEventsSchema,
  methodsFor: methodListSchema,
} as const;

export type PaymentCall = keyof typeof PAYMENT_ANSWER_SCHEMAS;

