/**
 * THE DESIGNS A BROWSER HOLDS, AND THE HELPERS AN APP CALLS.
 *
 * "Your designs" lists the designs this browser holds a link session for:
 * the session the save answered, or the one the e-mailed link opened. The
 * editor itself keeps nothing in the browser's storage: the app keeps these
 * sessions where it keeps its own (its claim sessions already live there),
 * from what `onSaved`, `onAddToBasket` and `openSavedLink` hand it
 * (`heldDesign`), and hands them back to `YourDesigns`. Only the session is
 * kept, never the link's own code: the code is in the e-mail, and a session
 * ends on its own; when it has, the design drops out of the list until its
 * link is opened again.
 *
 * An app's header shows "Your designs" only while the browser holds one
 * (`hasSavedDesigns`), and otherwise sends the customer to its order lookup,
 * whose code step leads on to the designs the order names (`readDesigns`).
 */
import type { CustomiserApi, HeldSession, SavedDesign } from './api.ts';

/** One design a browser holds: what the app keeps for "Your designs". */
export interface HeldDesign {
  id: string | number;
  base: string | number;
  session: HeldSession;
  /** The address its link went to, shown back to its own browser only. */
  email: string | null;
  savedAt: string;
}

/** What to keep of a saved design, or null when this browser holds no session on it. */
export function heldDesign(design: SavedDesign, email: string | null = null): HeldDesign | null {
  if (design.session === null) return null;
  return { id: design.id, base: design.base_id, session: design.session, email, savedAt: new Date().toISOString() };
}

/** The designs whose session is still open, newest first. */
export const liveDesigns = (held: readonly HeldDesign[], now = Date.now()): HeldDesign[] => held.filter((one) => one.session.expiresAt > now).sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));

/** Whether the browser holds a design of its own: the app's "Your designs" button shows only then. */
export const hasSavedDesigns = (held: readonly HeldDesign[], now = Date.now()): boolean => liveDesigns(held, now).length > 0;

/**
 * Open a design by its e-mailed link: the code in the link's fragment
 * (`/design#<code>`, read with the public client's `linkFromFragment`). The
 * answer carries the session to keep (`heldDesign`); `unknown` or `closed`
 * when the link opens nothing.
 */
export const openSavedLink = (api: CustomiserApi, token: string): Promise<SavedDesign | 'unknown' | 'closed'> => api.openLink(token);

/** The designs an order names, by their codes, read with the session the app's order lookup opened. */
export const readDesigns = (api: CustomiserApi, codes: readonly string[]): Promise<SavedDesign[]> => api.byCodes(codes);
