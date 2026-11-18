/**
 * A PICTURE FROM THE PERSON'S COMPUTER, INTO A PAGE.
 *
 * The data kit's upload (from Adminium 0.3.43) puts a file into a file column
 * of one of the add-on's own rows, through the dashboard's own files route,
 * judged there as any upload is. The editor uploads into the page's
 * `picture_upload` column, a holding place, and then asks the engine to keep
 * that file as the page's own cleaned picture (`editor/engine.ts`). The
 * column only ever holds the last one uploaded.
 *
 * Typed here, as `host.ts` types every other part, and read when a page asks:
 * a host without it has no upload, and the editor then offers Files only.
 */
import dataKit from '@adminium/add-on-contracts/runtime/data';

/** The file the kit put into the column, by its id. */
export interface Uploaded {
  id: string;
  name: string;
  mime: string;
  size: number;
}

export interface Upload {
  upload: (key: string | number, file: Blob, options?: { name?: string }) => Promise<Uploaded>;
  uploading: boolean;
}

/** The kit's upload into one file column, or undefined on a host that has none. */
export const hostUpload = (): ((table: string, column: string) => Upload) | undefined => {
  const hook = (dataKit as Readonly<Record<string, unknown>>)['useUpload'];
  return typeof hook === 'function' ? (hook as (table: string, column: string) => Upload) : undefined;
};
