/**
 * THE STARTER FONTS' FILES, FETCHED FROM BESIDE THIS PAGE.
 *
 * The install writes the open-licence starter fonts as rows with no file (a
 * seed holds plain values). Their WOFF2 files ship in this package beside the
 * set-up page's code, each with its licence text, and Adminium hands a page
 * the files beside its code from its page-files route, behind the page's own
 * gates. "Add the starter fonts" reads each missing file from there and
 * uploads it into its row through the fonts' own upload, as a shop's own font
 * is uploaded.
 *
 * An Adminium before the page-files route answers 404 for every file: the
 * button is then switched off and says it needs a newer Adminium.
 */

/** Where Adminium serves the files beside the set-up page's code. */
export const PAGE_FILES = '/api/v1/add-ons/customiser/pages/customiser/files/';

/** A starter family's file name: its family name without the spaces (`Zilla Slab` → `ZillaSlab`). */
export const starterName = (family: string): string => family.replace(/\s+/g, '');

/** The path of a starter family's font, below the page's folder. */
export const starterFontPath = (family: string): string => `fonts/${starterName(family)}.woff2`;

/** The path of a starter family's licence text, below the page's folder. */
export const starterLicencePath = (family: string): string => `fonts/${starterName(family)}-OFL.txt`;

/** Whether this Adminium serves the files beside the page: `old` when it has no such route. */
export type FilesRoute = 'checking' | 'ready' | 'old';

/**
 * Ask for one family's licence text (a few KB) to learn whether the route is
 * there. A 404 is an Adminium without it; anything else is left to the button,
 * which says what went wrong when it is pressed.
 */
export async function filesRoute(family: string, get: typeof fetch = fetch): Promise<FilesRoute> {
  try {
    const answer = await get(`${PAGE_FILES}${starterLicencePath(family)}`, { credentials: 'same-origin' });
    return answer.status === 404 ? 'old' : 'ready';
  } catch {
    return 'ready';
  }
}

/** Adminium did not hand over a starter font's file: the status it answered. */
export class StarterFileUnread extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`The starter font's file was not handed over (${String(status)}).`);
    this.status = status;
  }
}

/** One starter family's font, as a file to upload; a file Adminium does not hand over throws `StarterFileUnread`. */
export async function starterFile(family: string, get: typeof fetch = fetch): Promise<File> {
  const path = starterFontPath(family);
  const answer = await get(`${PAGE_FILES}${path}`, { credentials: 'same-origin' });
  if (!answer.ok) throw new StarterFileUnread(answer.status);
  const bytes = await answer.arrayBuffer();
  return new File([bytes], path.slice('fonts/'.length), { type: 'font/woff2' });
}
