/**
 * EVERY FACT ABOUT THE STRIPE API THIS ADD-ON RELIES ON, IN ONE PLACE.
 *
 * Read from Stripe's published OpenAPI description (`stripe/openapi`,
 * `openapi/spec3.json`, version `2026-09-30.endive`, read 2026-10-21) and the
 * Stripe docs pages named beside each value. The stripe-mock suite sends every
 * request this add-on builds to Stripe's own mock server, which checks it
 * against that same description, so a field that drifts fails there.
 *
 * Nothing here is a secret, and nothing here reaches a browser: this file is
 * only reachable from the server half.
 */

/** The API this add-on calls. The only host it sends a key to. */
export const STRIPE_API_ORIGIN = 'https://api.stripe.com';

/**
 * The hosts a customer may be sent to. `checkout.stripe.com` serves every
 * hosted Checkout page; a shop's own custom checkout domain is the engine's
 * business (it is not in this list, so it is refused until the engine learns it).
 */
export const STRIPE_CHECKOUT_HOSTS = ['checkout.stripe.com'] as const;

/**
 * The API version every request pins (`Stripe-Version`). Pinned, never "the
 * account's default", so a shop that upgrades its account in the Stripe
 * dashboard cannot change what this add-on reads.
 */
export const STRIPE_API_VERSION = '2026-09-30.endive';

/** The paths, so tests and the mock suite name the same strings as the transport. */
export const STRIPE_PATHS = {
  account: '/v1/account',
  sessions: '/v1/checkout/sessions',
  session: (id: string) => `/v1/checkout/sessions/${encodeURIComponent(id)}`,
  expireSession: (id: string) => `/v1/checkout/sessions/${encodeURIComponent(id)}/expire`,
  refunds: '/v1/refunds',
  refund: (id: string) => `/v1/refunds/${encodeURIComponent(id)}`,
  events: '/v1/events',
  paymentMethodConfigurations: '/v1/payment_method_configurations',
  paymentIntents: '/v1/payment_intents',
  charges: '/v1/charges',
  disputes: '/v1/disputes',
  webhookEndpoints: '/v1/webhook_endpoints',
} as const;

/**
 * How long a checkout stays open. Stripe allows 30 minutes to 24 hours
 * (`expires_at`); Adminium uses one hour, so a pay link that was abandoned
 * cannot be paid a day later against a balance that has moved.
 */
export const SESSION_LIFETIME_SECONDS = 60 * 60;

/**
 * The signature tolerance Stripe's own libraries use: five minutes.
 * Never widened (a wider window is a wider replay window).
 */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/** The header Stripe signs its webhooks with, in lower case as the engine hands it. */
export const SIGNATURE_HEADER = 'stripe-signature';

/**
 * The events the sweep asks for when a webhook went missing (at most 20, the
 * events list's limit for `types`). The webhook guide asks the admin to tick
 * the same list.
 */
export const LISTENED_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'refund.created',
  'refund.updated',
  'refund.failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
] as const;

/**
 * A key must be a restricted key of the mode it is used in. A secret key
 * (`sk_`) opens the whole account; it is refused before any call is made.
 */
export const RESTRICTED_KEY = /^rk_(test|live)_[A-Za-z0-9]{10,}$/;

/** A webhook signing secret, as Stripe shows it on an endpoint. */
export const WEBHOOK_SECRET = /^whsec_[A-Za-z0-9+/=]{10,}$/;

/**
 * THE PERMISSIONS A KEY NEEDS, each with a call that proves it without
 * changing anything at Stripe.
 *
 * Reads are proved with a one-item list. Writes are proved by asking for
 * something that does not exist: a key that may write gets "No such …"
 * (`resource_missing`), a key that may not gets a permission refusal, and
 * nothing is created either way. The names are the Stripe dashboard's own
 * words, which is what the admin sees next to each missing one.
 *
 * VERIFY WITH A SANDBOX KEY (plan 70 P0-T05): that a write probe on a missing
 * object is refused for permission BEFORE it is looked up, and that reading
 * the account (`Accounts: read`) is what a restricted key needs for its own
 * account id.
 */
export const PERMISSION_PROBES: readonly {
  name: string;
  method: 'GET' | 'POST';
  path: string;
  body?: Readonly<Record<string, string>>;
  optional?: boolean;
}[] = [
  { name: 'Checkout Sessions: write', method: 'POST', path: STRIPE_PATHS.expireSession('cs_adminium_permission_check') },
  { name: 'Checkout Sessions: read', method: 'GET', path: `${STRIPE_PATHS.sessions}?limit=1` },
  { name: 'PaymentIntents: read', method: 'GET', path: `${STRIPE_PATHS.paymentIntents}?limit=1` },
  {
    name: 'Charges and Refunds: write',
    method: 'POST',
    path: STRIPE_PATHS.refunds,
    body: { payment_intent: 'pi_adminium_permission_check' },
  },
  { name: 'Events: read', method: 'GET', path: `${STRIPE_PATHS.events}?limit=1` },
  { name: 'Disputes: read', method: 'GET', path: `${STRIPE_PATHS.disputes}?limit=1` },
  { name: 'Payment Method Configurations: read', method: 'GET', path: `${STRIPE_PATHS.paymentMethodConfigurations}?limit=1` },
  { name: 'Webhook endpoints: read', method: 'GET', path: `${STRIPE_PATHS.webhookEndpoints}?limit=1`, optional: true },
];
