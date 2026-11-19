/**
 * WHICH COPY OF THE ADD-ON ADMINIUM'S LANDING ROUTES ARE ASKED ABOUT.
 *
 * The add-on may be installed once per database, and every route under
 * `/api/v1/landing/<add-on>/` picks one install the same way: the
 * `X-Adminium-Install` header, else `?connectionId=` (the install on that
 * database), else the key's only install; with several and nothing naming
 * one, it answers 409 and picks none.
 *
 * The dashboard names the copy a page was opened for on the add-on's own
 * routes (`/api/v1/add-ons/<add-on>/…`, the kit's) and on no other, and the
 * `api` a page is handed sends no header of its own; a picture the canvas
 * draws is an `<img>`, which cannot send one either. So the page asks the
 * kit's read (named by the dashboard) which database its tables are on, and
 * names that database on every landing route as `?connectionId=`: the same
 * install the kit names, by the rule's second selector, in a form an address
 * can carry.
 *
 * Held while a page of the add-on is open: one page of it is drawn at a time.
 * Until the kit has answered (or when it cannot say), nothing is named, and a
 * server with one install answers for it.
 */

/** The add-on's own kit read: the dashboard names the copy on it. */
export const kitPath = (addOn: string): string => `/api/v1/add-ons/${encodeURIComponent(addOn)}/kit`;

let connection: string | null = null;

/** Name this database on every landing route from now on; null names none. */
export function scopeLanding(connectionId: string | null): void {
  connection = connectionId !== null && connectionId !== '' ? connectionId : null;
}

/** The database named now, if any. */
export const scopedConnection = (): string | null => connection;

/** A landing route's path, with the copy's database named on it when one is known. */
export function landingPath(path: string): string {
  if (connection === null) return path;
  return `${path}${path.includes('?') ? '&' : '?'}connectionId=${encodeURIComponent(connection)}`;
}

/** The database the kit's read says the add-on's tables are on; null when it does not say. */
export function connectionOf(kit: unknown): string | null {
  if (typeof kit !== 'object' || kit === null) return null;
  const id = (kit as { connectionId?: unknown }).connectionId;
  return typeof id === 'string' && id !== '' ? id : null;
}

/** Read the kit and name its database from now on; a read that fails names none. */
export async function readScope(get: (path: string) => Promise<unknown>, addOn: string): Promise<string | null> {
  let found: string | null = null;
  try {
    found = connectionOf(await get(kitPath(addOn)));
  } catch {
    found = null;
  }
  scopeLanding(found);
  return found;
}
