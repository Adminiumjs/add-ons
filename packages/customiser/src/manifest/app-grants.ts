/**
 * WHAT AN APP'S ROLE MAY BE GIVEN OF EACH CUSTOMISER TABLE (`appGrants`).
 *
 * The shop apps give their own roles a hold on these tables
 * (`roles[].tables`), so that a maker or a pre-press role sees the panels
 * and makes a proof and the production files without a Customiser role of
 * its own. This says how far that hold may go, table by table:
 *
 * - the shop's set-up is read only: the panels draw from it, and only the
 *   Customiser's own designer changes it, from the set-up page;
 * - a customer's design is read with its personal columns (the words, the
 *   logo, the photo), and never changed from an app;
 * - a version is added (the proof is made of a design no order snapshotted
 *   yet) and its proof file set; the columns the order's posting copies
 *   (`values`, `note`) stay as they were copied;
 * - a version's files are made, attached and replaced (removed and made
 *   again).
 *
 * Once one table says this, a table that does not is given to no app's role:
 * the settings, the postings (a ledger's receipts, which no app ever holds)
 * and the log of mailed links are none of an app's.
 *
 * `manifest.test.ts` holds each list to the table's columns; the README's
 * "What an app's role needs" lists the same, as an app writes it.
 */
export interface AppGrants {
  actions: readonly ('read' | 'read_pii' | 'create' | 'update' | 'delete')[];
  creatable?: readonly string[];
  writable?: readonly string[];
}

const READ: AppGrants = { actions: ['read'] };

export const APP_GRANTS: Readonly<Record<string, AppGrants>> = {
  bases: READ,
  base_pieces: READ,
  base_areas: READ,
  ready_designs: READ,
  ready_parts: READ,
  fonts: READ,
  palettes: READ,
  palette_colours: READ,
  features: READ,
  designs: { actions: ['read', 'read_pii'] },
  design_versions: { actions: ['read', 'read_pii', 'create', 'update'], creatable: ['app', 'design_id', 'version', 'values'], writable: ['proof_file'] },
  version_files: { actions: ['read', 'create', 'update', 'delete'], creatable: ['app', 'version_id', 'kind', 'name', 'about', 'layers', 'left_out', 'position'], writable: ['file'] },
};
