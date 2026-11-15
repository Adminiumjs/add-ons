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
 * Addresses this add-on names. None is inert: the server half calls the
 * Terminal API of its mode. Both are in `manifest.json`'s `network.allow`; the
 * sources suite checks no other appears.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/** Strings that must never reach a browser. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [
  { text: 'access_token', why: 'the `secret: true` setting key from manifest.json: the token opens the whole Square account' },
  { text: 'connect.squareup.com', why: 'the live API host the token is sent to' },
  { text: 'connect.squareupsandbox.com', why: 'the sandbox API host the token is sent to' },
];

/** The marks this add-on's words name (TRADEMARKS.md, "Card readers"). */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [
  { mark: 'Square', owner: 'Block, Inc.' },
  { mark: 'Square Terminal', owner: 'Block, Inc.' },
  { mark: 'Interac', owner: 'Interac Corp.' },
];
