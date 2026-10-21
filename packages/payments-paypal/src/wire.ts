/**
 * EVERY FACT ABOUT THE PAYPAL REST API THIS ADD-ON RELIES ON, IN ONE PLACE.
 *
 * Read from PayPal's published OpenAPI descriptions
 * (`paypal/paypal-rest-api-specifications`, commit `90e8041ffe`, 2026-04-07:
 * `checkout_orders_v2.json` 2.32, `payments_payment_v2.json` 2.12,
 * `notifications_webhooks_v1.json` 1.11, read 2026-10-21) and the PayPal
 * developer pages named in plan 70's facts check. The OpenAPI suite checks
 * every request this add-on builds against the same descriptions.
 */

import type { PaymentMode } from '@adminium/add-on-host/contracts';

/** The hosts of one mode. A call in one mode never reaches the other's host. */
export interface PaypalHosts {
  /** The REST API: the only host the credentials are sent to. */
  readonly api: string;
  /** Where a customer approves the payment. */
  readonly checkout: string;
}

export const PAYPAL_HOSTS: Readonly<Record<PaymentMode, PaypalHosts>> = {
  test: { api: 'https://api-m.sandbox.paypal.com', checkout: 'www.sandbox.paypal.com' },
  live: { api: 'https://api-m.paypal.com', checkout: 'www.paypal.com' },
};

/**
 * The hosts a webhook's signing certificate may be fetched from: exact
 * names, https only. PayPal states no rule for this (its example names
 * `api.sandbox.paypal.com`); pinning it is Adminium's own hardening, so a
 * forged delivery cannot point the check at a certificate of its choosing.
 */
export const CERT_HOSTS: Readonly<Record<PaymentMode, readonly string[]>> = {
  test: ['api.sandbox.paypal.com', 'api-m.sandbox.paypal.com'],
  live: ['api.paypal.com', 'api-m.paypal.com'],
};

/**
 * The certificate's subject. PayPal signs webhooks with a certificate for
 * this name (VERIFY WITH A SANDBOX DELIVERY: plan 70 P0-T05, whether the
 * sandbox uses the same name).
 */
export const CERT_SUBJECT = 'messageverificationcerts.paypal.com';

export const PAYPAL_PATHS = {
  token: '/v1/oauth2/token',
  orders: '/v2/checkout/orders',
  order: (id: string) => `/v2/checkout/orders/${encodeURIComponent(id)}`,
  capture: (id: string) => `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
  refundCapture: (id: string) => `/v2/payments/captures/${encodeURIComponent(id)}/refund`,
  refund: (id: string) => `/v2/payments/refunds/${encodeURIComponent(id)}`,
  events: '/v1/notifications/webhooks-events',
} as const;

/**
 * How long a checkout stays payable: six hours (plan 70 §4.2). PayPal keeps a
 * `PayPal-Request-Id` for six hours on order create and capture (facts §5), so
 * an order is never captured after its capture key could have been forgotten.
 */
export const ORDER_LIFETIME_MS = 6 * 60 * 60 * 1000;

/**
 * An order Adminium has ended carries this after its attempt id in
 * `custom_id`. PayPal has no call that cancels an order; the marker is how
 * `status` reads it as ended and `complete` refuses to capture it.
 */
export const VOID_MARKER = ':void';

/** The events the sweep reads back when a webhook went missing (the webhook guide lists the same). */
export const LISTENED_EVENTS = [
  'CHECKOUT.ORDER.APPROVED',
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.DENIED',
  'PAYMENT.CAPTURE.PENDING',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
] as const;

/** Webhook headers, in lower case as the engine hands them. */
export const WEBHOOK_HEADERS = {
  id: 'paypal-transmission-id',
  time: 'paypal-transmission-time',
  signature: 'paypal-transmission-sig',
  certUrl: 'paypal-cert-url',
  algorithm: 'paypal-auth-algo',
} as const;

/** The webhook id PayPal signs simulator events with (developer.paypal.com/api/rest/webhooks/simulator). */
export const SIMULATOR_WEBHOOK_ID = 'WEBHOOK_ID';
