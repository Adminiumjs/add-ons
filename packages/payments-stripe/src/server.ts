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
