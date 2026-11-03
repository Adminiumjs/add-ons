/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates
 * read. All three are empty, and each says why, because an empty list is the
 * same shape a forgotten one takes.
 */

/**
 * Addresses that appear in the sources without ever being called. There is
 * none: the screens call Adminium's own routes and name no address. A form's
 * public link is the owner's own server's, read from Adminium when it is shown.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [];

/**
 * Text that must never reach a browser. There is none: the add-on connects to
 * nothing (`connect: { kind: "none" }`) and holds no credential. A survey
 * link's token is made by Adminium when the mail is sent, and only its check
 * is kept.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * Company marks the package names. There is none: every form, survey, answer
 * and invitation is the operator's own row, and nothing here names a company,
 * a form service or a mail service that belongs to somebody.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
