/**
 * THE DESIGNS THIS BROWSER HOLDS, AND THE HELPERS AN APP CALLS.
 *
 * "Your designs" lists the designs this browser holds a link session for:
 * the session the save answered, or the one the e-mailed link opened. The
 * session is kept on this device (`localStorage`), never the link's own code:
 * the code is in the e-mail, and a session ends on its own. When it has, the
 * design drops out of the list until its link is opened again.
 *
 * An app's header shows "Your designs" only while this browser holds one
 * (`hasSavedDesigns`), and otherwise sends the customer to its order lookup,
 * whose code step leads on to the designs the order names (`readDesigns`).
 */
import type { CustomiserApi, HeldSession, SavedDesign } from './api.ts';

const KEY = 'adminium.customiser.designs';

export interface Remembered {
  id: string | number;
  base: string | number;
  session: HeldSession;
  /** The address the link went to, shown back to its own browser only. */
  email: string | null;
  savedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function read(): Remembered[] {
  try {
    const raw = storage()?.getItem(KEY);
    const list = raw === null || raw === undefined ? [] : (JSON.parse(raw) as unknown);
    return Array.isArray(list) ? (list as Remembered[]).filter((one) => typeof one === 'object' && one !== null && typeof one.session?.token === 'string') : [];
  } catch {
    return [];
  }
}

function write(list: readonly Remembered[]): void {
  try {
    storage()?.setItem(KEY, JSON.stringify(list));
  } catch {
    // A browser that keeps nothing still edits; the e-mailed link still opens the design.
  }
}

/** The designs this browser holds a live session for, newest first. */
export function rememberedDesigns(now = Date.now()): Remembered[] {
  const list = read();
  const live = list.filter((one) => one.session.expiresAt > now);
  if (live.length !== list.length) write(live);
  return live.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
}

/** Whether this browser holds a design of its own: the app's "Your designs" button shows only then. */
export const hasSavedDesigns = (): boolean => rememberedDesigns().length > 0;

/** Keep a design's session on this browser. */
export function rememberDesign(design: SavedDesign, email: string | null = null): void {
  if (design.session === null) return;
  const others = read().filter((one) => String(one.id) !== String(design.id));
  const before = read().find((one) => String(one.id) === String(design.id));
  write([{ id: design.id, base: design.base_id, session: design.session, email: email ?? before?.email ?? null, savedAt: new Date().toISOString() }, ...others]);
}

/** Take a design off this browser's list. The design itself stays until it expires. */
export function forgetDesign(id: string | number): Remembered | null {
  const list = read();
  const gone = list.find((one) => String(one.id) === String(id)) ?? null;
  write(list.filter((one) => one !== gone));
  return gone;
}

/** Put back a design taken off the list (Undo). */
export function restoreDesign(one: Remembered): void {
  write([one, ...read().filter((other) => String(other.id) !== String(one.id))]);
}

/**
 * Open a design by its e-mailed link: the code in the link's fragment
 * (`/design#<code>`, read with the public client's `linkFromFragment`). The
 * design is kept on this browser's list; `unknown` or `closed` when the link
 * opens nothing.
 */
export async function openSavedLink(api: CustomiserApi, token: string): Promise<SavedDesign | 'unknown' | 'closed'> {
  const opened = await api.openLink(token);
  if (typeof opened !== 'string') rememberDesign(opened);
  return opened;
}

/** The designs an order names, by their codes, read with the session the app's order lookup opened. */
export const readDesigns = (api: CustomiserApi, codes: readonly string[]): Promise<SavedDesign[]> => api.byCodes(codes);
