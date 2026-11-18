/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates
 * read. All three are empty, and each says why, because an empty list is the
 * same shape a forgotten one takes.
 */

/**
 * Addresses that appear in the sources without ever being called. There are
 * none: the screens call Adminium's own routes, and a page's address is read
 * from Adminium when it is shown, never written here.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * Text that must never reach a browser. There is none: the add-on connects to
 * nothing (`connect: { kind: "none" }`) and holds no credential. Adminium alone
 * draws a page for a stranger and serves its pictures.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * Company marks the package names. There is none: the AI service Milo drafts
 * with is named by Adminium when a page shows it, never written here.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
