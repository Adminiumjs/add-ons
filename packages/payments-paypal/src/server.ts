/**
 * THE SERVER HALF: the only file the engine loads from this add-on.
 *
 * The engine imports the built `dist/server.js` and calls
 * `createPaymentProvider({ http, credentials, mode })` once per operation
 * (`payment-provider@1`). There is no client half: the screens that set this
 * add-on up are Adminium's own (Studio → Payments), so no line of this
 * package ever reaches a browser, and the credentials it reads cannot either.
 */

export { createPaymentProvider, createPaypalProvider, forgetPaypalCaches, PAYPAL_ADD_ON_KEY, type PaypalProviderOptions } from './transport.ts';

/** The events the admin ticks on the PayPal webhook (`PAYMENT_WEBHOOK_EVENTS_EXPORT`). */
export { LISTENED_EVENTS as webhookEvents } from './wire.ts';
