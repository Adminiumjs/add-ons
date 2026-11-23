/**
 * The facts a host's own gates need from this add-on. They travel with it, so a
 * host that vendors it needs no edit (see `shipping-dhl/src/add-on-facts.ts`).
 */

/** Addresses this add-on names and cannot call from a browser. None: both hosts are server-only. */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/** Strings that must never appear in a client bundle. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [
  { text: "api_key", why: "the `secret: true` setting key from manifest.json: the name the Shippo key is saved under" },
  { text: "ShippoToken", why: "the scheme the key is sent with: only the server half builds that header" },
  { text: "api.goshippo.com", why: "the host the key is sent to; only the server half may name it" },
  { text: "deliver.goshippo.com", why: "the host signed label files come from; only the server half may name it" },
];

/** The marks this add-on's words name. Carriers' names come from Shippo's answers at run time. */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [{ mark: "Shippo", owner: "Popout, Inc." }];
