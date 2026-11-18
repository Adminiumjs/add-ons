/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates
 * read. All three are empty, and each says why, because an empty list is the
 * same shape a forgotten one takes.
 */

/**
 * Addresses that appear in the sources without ever being called. The screens
 * call Adminium's own routes, and the loader line a website pastes names the
 * owner's own server, read from Adminium when it is shown. The one address
 * written here is the sample visitors' website, a reserved example domain: it
 * is a "came from" line staff read, never fetched by anything.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [{ origin: 'https://www.example.com', why: 'the sample chats came from it; shown as text in the side rail, never fetched' }];

/**
 * Text that must never reach a browser. There is none: the add-on connects to
 * nothing (`connect: { kind: "none" }`) and holds no credential. A visitor's
 * conversation token is made and checked by Adminium alone.
 */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/**
 * Company marks the package names. There is none: the AI service an owner set
 * up is named by Adminium when a page shows it, never written here.
 */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [];
