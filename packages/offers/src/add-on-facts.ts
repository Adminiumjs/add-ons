/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates
 * read. All three are empty, and each says why, because an empty list is the
 * same shape a forgotten one takes.
 */

/**
 * Addresses that appear in the sources without ever being called. There is
 * none: this add-on calls nothing and names no address.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * Text that must never reach a browser. There is none: the add-on connects to
 * nothing (`connect: { kind: "none" }`) and holds no credential. A card's or a
 * voucher's code is a row of the operator's database, kept from the roles that
 * may not read it by the manifest's own read limits.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * Company marks the package names. There is none: every offer, code, voucher
 * and card in a deployment is the operator's own row, typed by them or made
 * for them and kept in their database. Nothing here names a company, a card
 * scheme or a payment service that belongs to somebody.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
