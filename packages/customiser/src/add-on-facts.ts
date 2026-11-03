/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates
 * read. All three are empty, and each says why, because an empty list is the
 * same shape a forgotten one takes.
 */

/**
 * Addresses that appear in the sources without ever being called. There is
 * none: the shop's screens call Adminium's own routes, and the customer's
 * editor calls the shop app's own public API, whose address the app hands it.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * Text that must never reach a browser. There is none: the add-on connects to
 * nothing (`connect: { kind: "none" }`) and holds no credential. A saved
 * design's private link is made by Adminium, kept hidden from staff, and only
 * ever mailed to the customer.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * Company marks the package names. There is none: every base, design, font
 * row and customer's design is the shop's own row. The starter fonts are
 * named by their family names under their open licences, as typefaces, not
 * as anybody's product.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
