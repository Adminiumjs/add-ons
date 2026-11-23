/**
 * WHAT THIS ADD-ON REACHES, HIDES AND NAMES — the three lists the shared gates read.
 */

/** Addresses in the sources that the server half never calls: links a person presses in the setup guide. */
export const INERT_ORIGINS: readonly { origin: string; why: string }[] = [
  { origin: 'https://console.cloud.google.com', why: 'A link in the setup guide, pressed by the person setting up.' },
  { origin: 'https://entra.microsoft.com', why: 'A link in the Outlook guide, in the screens both calendar add-ons share.' },
  { origin: 'https://graph.microsoft.com', why: 'A scope name in the Outlook guide, in the screens both add-ons share. Never called from here.' },
];

/** Text that must never reach a browser. The add-on holds no secret: the engine keeps the app's and every person's. */
export const NEVER_IN_A_BROWSER: readonly { text: string; why: string }[] = [];

/** Company marks the package names. */
export const COMPANY_MARKS: readonly { mark: string; owner: string }[] = [
  { mark: 'Google', owner: 'Google LLC' },
  { mark: 'Google Calendar', owner: 'Google LLC' },
  { mark: 'Google Workspace', owner: 'Google LLC' },
  { mark: 'Gmail', owner: 'Google LLC' },
  { mark: 'Google Cloud', owner: 'Google LLC' },
];
