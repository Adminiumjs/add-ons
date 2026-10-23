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
 * Where an access sits on the Stripe dashboard form for a restricted key: the
 * Core list, Connect, or a group of its own (whose heading is the access name).
 */
export type PermissionGroup = 'Core' | 'Connect' | 'Checkout Sessions' | 'Webhook Endpoints, Event Destinations';

/**
 * THE PERMISSIONS A KEY NEEDS, each with a call that proves it without
 * changing anything at Stripe. The names are the words of the Stripe
 * dashboard form for a restricted key (read 2026-10-22 in a sandbox), and
 * `group` is where that form lists each one, so the admin can find a missing one.
 *
 * Reads are proved with a one-item list. Writes are proved with a POST that
 * carries NO parameter at all, so nothing is looked up and nothing can be
 * made: a key that may write gets 400 for the missing parameter, a key that
 * may not gets a permission refusal (`more_permissions_required`).
 *
 * Measured on a sandbox key with both writes set to Read (2026-10-23):
 * - `POST /v1/checkout/sessions` with no parameter → `more_permissions_required`.
 * - `POST /v1/refunds` with no parameter → 400 "payment_intent or charge" —
 *   Stripe checks that parameter BEFORE the permission (and looks a made-up
 *   PaymentIntent up before it too: 404), so a refund of nothing cannot see
 *   whether the key may give refunds. It is NOT the probe.
 * - `POST /v1/charges` with no parameter → 403 `more_permissions_required`
 *   naming `charge_write`, the one permission that covers refunds; with Write
 *   on, 400 `parameter_missing` "Must provide source or customer.". It is the
 *   probe.
 */
export const PERMISSION_PROBES: readonly {
  name: string;
  group: PermissionGroup;
  method: 'GET' | 'POST';
  path: string;
  optional?: boolean;
}[] = [
  { name: 'Checkout Sessions: write', group: 'Checkout Sessions', method: 'POST', path: STRIPE_PATHS.sessions },
  { name: 'Checkout Sessions: read', group: 'Checkout Sessions', method: 'GET', path: `${STRIPE_PATHS.sessions}?limit=1` },
  { name: 'Payment Intents: read', group: 'Core', method: 'GET', path: `${STRIPE_PATHS.paymentIntents}?limit=1` },
  // The refund permission is checked on /v1/charges: an empty /v1/refunds is refused for its parameter first (see above).
  { name: 'Charges and Refunds: write', group: 'Core', method: 'POST', path: STRIPE_PATHS.charges },
  { name: 'Events: read', group: 'Core', method: 'GET', path: `${STRIPE_PATHS.events}?limit=1` },
  { name: 'Payment Disputes: read', group: 'Core', method: 'GET', path: `${STRIPE_PATHS.disputes}?limit=1` },
  { name: 'Payment Method Configurations: read', group: 'Core', method: 'GET', path: `${STRIPE_PATHS.paymentMethodConfigurations}?limit=1` },
  {
    name: 'Webhook Endpoints, Event Destinations: read',
    group: 'Webhook Endpoints, Event Destinations',
    method: 'GET',
    path: `${STRIPE_PATHS.webhookEndpoints}?limit=1`,
    optional: true,
  },
];

/**
 * The access a key needs to say which account it belongs to (`GET
 * /v1/account`). On the form it is under Connect, as "In your account: Read".
 */
export const ACCOUNT_PERMISSION = { name: 'Accounts: read', group: 'Connect' } as const satisfies { name: string; group: PermissionGroup };

/** A permission as a message names it: with the place on the form to find it ("Accounts: read (under Connect, In your account)"). */
export function permissionLabel(permission: { name: string; group: PermissionGroup }): string {
  if (permission.group === 'Connect') return `${permission.name} (under Connect, In your account)`;
  if (permission.group === 'Core') return `${permission.name} (under Core)`;
  return permission.name;
}
