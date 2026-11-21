/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates read.
 */

/**
 * Addresses in the sources that the add-on's server never calls. It has no
 * server. Each is reached by the visitor's own browser, from the sandboxed
 * page, or is a link a person presses.
 */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [
  { origin: 'https://maps.googleapis.com', why: 'Google’s script, loaded by the visitor’s browser inside the sandboxed page when they press the button.' },
  { origin: 'https://www.google.com', why: 'A link to the business’s place on Google, pressed by a person.' },
  { origin: 'https://search.google.com', why: 'A link to write a review on Google, pressed by a person.' },
  { origin: 'https://developers.google.com', why: 'A link to Google’s Place ID Finder on the settings screen.' },
];

/** Text that must never reach a browser. There is none: the key is a browser key, restricted by its owner, and is meant to be there. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/** Company marks the package names. */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [
  { mark: 'Google', owner: 'Google LLC' },
  { mark: 'Google Maps', owner: 'Google LLC' },
];
