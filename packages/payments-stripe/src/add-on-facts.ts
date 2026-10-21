/**
 * THE FACTS A HOST'S OWN GATES NEED FROM THIS ADD-ON (see `shipping-dhl`'s
 * copy of this file for why they travel with the add-on).
 *
 * This add-on is loaded by the Adminium engine only. It has no client half
 * and is never vendored into an app, so no browser can hold any of it; the
 * two lists below say what a host would have to keep out of one if that ever
 * changed.
 */

/**
 * Addresses this add-on names. None is inert: the server half CALLS the API
 * host, and sends the customer to the checkout host. Both are in
 * `manifest.json`'s `network.allow`, and the egress guard refuses anything
 * else. The sources suite checks that no other address appears.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/** Strings that must never reach a browser. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [
  { text: 'secret_key', why: 'a `secret: true` setting key from manifest.json: the name the restricted key is saved under' },
  { text: 'webhook_secret', why: 'the other `secret: true` setting key from manifest.json' },
  { text: 'api.stripe.com', why: 'the host the key is sent to; only the server half may name it' },
];

/**
 * The marks this add-on's words name (TRADEMARKS.md, "Card payments"). Stripe
 * and Link are the service it connects to; the rest are ways to pay and card
 * schemes it names as Stripe reports them.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [
  { mark: 'Stripe', owner: 'Stripe, Inc.' },
  { mark: 'Link', owner: 'Stripe, Inc.' },
  { mark: 'PayPal', owner: 'PayPal, Inc.' },
  { mark: 'Apple Pay', owner: 'Apple Inc.' },
  { mark: 'Google Pay', owner: 'Google LLC' },
  { mark: 'Klarna', owner: 'Klarna Bank AB' },
  { mark: 'Visa', owner: 'Visa Inc.' },
  { mark: 'Mastercard', owner: 'Mastercard International Incorporated' },
  { mark: 'American Express', owner: 'American Express Company' },
];
