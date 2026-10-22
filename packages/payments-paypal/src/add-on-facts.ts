/**
 * THE FACTS A HOST'S OWN GATES NEED FROM THIS ADD-ON (see `shipping-dhl`'s
 * copy of this file for why they travel with the add-on).
 *
 * This add-on is loaded by the Adminium engine only. It has no client half
 * and is never vendored into an app, so no browser can hold any of it; the
 * lists below say what a host would have to keep out of one if that ever
 * changed.
 */

/**
 * Addresses this add-on names. None is inert: the server half calls the REST
 * API of its mode, sends the customer to the PayPal page of its mode, and
 * fetches webhook certificates from the pinned hosts. All are in
 * `manifest.json`'s `network.allow`; the sources suite checks no other appears.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/** Strings that must never reach a browser. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [
  { text: 'client_id', why: 'a `secret: true` setting key from manifest.json' },
  { text: 'client_secret', why: 'a `secret: true` setting key from manifest.json: the secret opens the whole PayPal account' },
  { text: 'webhook_id', why: 'a `secret: true` setting key from manifest.json' },
  { text: 'api-m.paypal.com', why: 'the live API host the credentials are sent to' },
  { text: 'api-m.sandbox.paypal.com', why: 'the sandbox API host the credentials are sent to' },
];

/** The marks this add-on's words name (TRADEMARKS.md, "Wallet payments"). */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [{ mark: 'PayPal', owner: 'PayPal, Inc.' }];
