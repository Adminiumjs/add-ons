/**
 * WHAT AN APP'S ROLE MAY BE GIVEN OF EACH CUSTOMISER TABLE (`appGrants`).
 *
 * The shop apps give their own roles a hold on these tables
 * (`roles[].tables`), so that a maker or a pre-press role sees the panels
 * and makes a proof and the production files without a Customiser role of
 * its own. This says how far that hold may go, table by table:
 *
 * - the settings are read: the set-up page starts from them;
 * - the shop's set-up is what the set-up page reads and writes: a role an
 *   app gives the set-up (a shop's owner) adds, changes and removes the
 *   rows the page does, every column but the app a row belongs to; a base
 *   is never removed there, so neither is it here. The panels read it;
 * - a customer's design is read with its personal columns (the words, the
 *   logo, the photo), and never changed from an app;
 * - a version is added (the proof is made of a design no order snapshotted
 *   yet) and its proof file set; the columns the order's posting copies
 *   (`values`, `note`) stay as they were copied;
 * - a version's files are made, attached and replaced (removed and made
 *   again).
 *
 * Once one table says this, a table that does not is given to no app's role:
 * the postings (a ledger's receipts, which no app ever holds) and the log of
 * mailed links are none of an app's.
 *
 * `manifest.test.ts` holds each list to the table's columns; the README's
 * "What an app's role needs" lists the same, as an app writes it.
 */
export interface AppGrants {
  actions: readonly ('read' | 'read_pii' | 'create' | 'update' | 'delete')[];
  creatable?: readonly string[];
  writable?: readonly string[];
}

/** What the set-up page does to a table: a base is added and changed, never removed. */
const ADD_CHANGE = ['read', 'create', 'update'] as const;
const ADD_CHANGE_REMOVE = ['read', 'create', 'update', 'delete'] as const;

export const APP_GRANTS: Readonly<Record<string, AppGrants>> = {
  settings: { actions: ['read'] },
  bases: { actions: ADD_CHANGE, creatable: ['app', 'name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'model_file', 'print_file', 'faces', 'offered', 'state', 'position'], writable: ['name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'model_file', 'print_file', 'faces', 'offered', 'state', 'position'] },
  base_pieces: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'left_out', 'file', 'position'], writable: ['base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'left_out', 'file', 'position'] },
  base_areas: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position'], writable: ['base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position'] },
  ready_designs: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'name', 'tags', 'layouts', 'state', 'preview_file', 'position'], writable: ['base_id', 'name', 'tags', 'layouts', 'state', 'preview_file', 'position'] },
  ready_parts: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position'], writable: ['ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position'] },
  fonts: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'family', 'name', 'style', 'weights', 'licence', 'starter', 'smallest_mm', 'file', 'active'], writable: ['family', 'name', 'style', 'weights', 'licence', 'starter', 'smallest_mm', 'file', 'active'] },
  palettes: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'ready_design_id', 'kind', 'code', 'name', 'position'], writable: ['ready_design_id', 'kind', 'code', 'name', 'position'] },
  palette_colours: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'palette_id', 'code', 'role', 'name', 'hex', 'position'], writable: ['palette_id', 'code', 'role', 'name', 'hex', 'position'] },
  features: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'code', 'name', 'active'], writable: ['code', 'name', 'active'] },
  designs: { actions: ['read', 'read_pii'] },
  design_versions: { actions: ['read', 'read_pii', 'create', 'update'], creatable: ['app', 'design_id', 'version', 'values'], writable: ['proof_file'] },
  version_files: { actions: ['read', 'create', 'update', 'delete'], creatable: ['app', 'version_id', 'kind', 'name', 'about', 'layers', 'left_out', 'position'], writable: ['file'] },
};
