/**
 * THE SERVER HALF: the only file the engine loads from this add-on.
 *
 * The engine imports the built `dist/server.js` and calls
 * `createPaymentProvider({ http, credentials, mode })` once per operation
 * (`payment-provider@1`). There is no client half: the screens that set this
 * add-on up are Adminium's own (Studio → Payments), so no line of this
 * package ever reaches a browser, and the keys it reads cannot either.
 */

export { createPaymentProvider, createStripeProvider, STRIPE_ADD_ON_KEY, type StripeProviderOptions } from './transport.ts';

/** The events the admin ticks on the Stripe webhook endpoint (`PAYMENT_WEBHOOK_EVENTS_EXPORT`). */
export { LISTENED_EVENTS as webhookEvents } from './wire.ts';

/**
 * The private Stripe App that makes the restricted key, stamped for one shop
 * (`keyAppTemplate({ shopName, installId })` → the files of the download).
 * The setup screen's "Download the app template" calls it; nothing else does.
 */
export { keyAppTemplate, keyAppIssues, KEY_APP_PERMISSIONS } from './key-app.ts';
