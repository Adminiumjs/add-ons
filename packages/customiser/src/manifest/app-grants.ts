/**
 * WHAT AN APP'S ROLE MAY BE GIVEN OF EACH CUSTOMISER TABLE (`appGrants`).
 *
 * The shop apps give their own roles a hold on these tables
 * (`roles[].tables`), so that a maker or a pre-press role sees the panels
 * and makes a proof and the production files without a Customiser role of
 * its own. This says how far that hold may go, table by table:
 *
 * - the settings are read (the set-up page and the panels start from them)
 *   and changed, column by column, from the set-up page's Shop settings: the
 *   shop's owner keeps its own one-colour line. They are the install's, one
 *   row every app on it shares. The unit sizes are shown in is not offered:
 *   nothing reads it yet;
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
 *
 * WHOSE ROWS. This says what an app's role may hold of a table, never which
 * rows: Adminium's ceiling has no rows. With two shop apps on one install,
 * each app keeps its roles to its own rows itself, by the `app` column every
 * table but the settings carries (`ownSetUp`, `ownPanel` and `ownDesigns`
 * below, which the README's examples write out): a new row only tagged with
 * its own app, and a read, a change and a removal only of its own app's
 * rows, a customer's words and logo among them. The starter fonts are
 * nobody's app (`app` empty, which a value limit cannot name): an owner
 * reads and changes them by `starter`, so its set-up still adds their
 * files, and never removes one; `starter` itself is never an app's to
 * change, and a font an app adds is never one. The settings are one row for
 * the install, whichever apps it runs.
 */
export interface AppGrants {
  actions: readonly ('read' | 'read_pii' | 'create' | 'update' | 'delete')[];
  creatable?: readonly string[];
  writable?: readonly string[];
}

/** What the set-up page does to a table: a base is added and changed, never removed. */
const ADD_CHANGE = ['read', 'create', 'update'] as const;
const ADD_CHANGE_REMOVE = ['read', 'create', 'update', 'delete'] as const;

/** The settings an app's role may change: every one something reads (the unit sizes are shown in is read by nothing yet). */
export const SETTINGS_WRITABLE = ['default_bleed_mm', 'default_safe_mm', 'one_colour_threshold', 'smallest_line_mm', 'min_dpi'] as const;

export const APP_GRANTS: Readonly<Record<string, AppGrants>> = {
  settings: { actions: ['read', 'update'], writable: SETTINGS_WRITABLE },
  bases: { actions: ADD_CHANGE, creatable: ['app', 'name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'model_file', 'print_file', 'faces', 'offered', 'state', 'position'], writable: ['name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'model_file', 'print_file', 'faces', 'offered', 'state', 'position'] },
  base_pieces: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'left_out', 'file', 'position'], writable: ['base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'left_out', 'file', 'position'] },
  base_areas: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position'], writable: ['base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position'] },
  ready_designs: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'base_id', 'name', 'tags', 'layouts', 'state', 'preview_file', 'position'], writable: ['base_id', 'name', 'tags', 'layouts', 'state', 'preview_file', 'position'] },
  ready_parts: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position'], writable: ['ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position'] },
  fonts: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'family', 'name', 'style', 'weights', 'licence', 'starter', 'smallest_mm', 'file', 'active'], writable: ['family', 'name', 'style', 'weights', 'licence', 'smallest_mm', 'file', 'active'] },
  palettes: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'ready_design_id', 'kind', 'code', 'name', 'position'], writable: ['ready_design_id', 'kind', 'code', 'name', 'position'] },
  palette_colours: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'palette_id', 'code', 'role', 'name', 'hex', 'position'], writable: ['palette_id', 'code', 'role', 'name', 'hex', 'position'] },
  features: { actions: ADD_CHANGE_REMOVE, creatable: ['app', 'code', 'name', 'active'], writable: ['code', 'name', 'active'] },
  designs: { actions: ['read', 'read_pii'] },
  design_versions: { actions: ['read', 'read_pii', 'create', 'update'], creatable: ['app', 'design_id', 'version', 'values'], writable: ['proof_file'] },
  version_files: { actions: ['read', 'create', 'update', 'delete'], creatable: ['app', 'version_id', 'kind', 'name', 'about', 'layers', 'left_out', 'position'], writable: ['file'] },
};

/** The tables the set-up page adds to, changes and removes from, each row tagged with the app it belongs to. */
export const SET_UP_TABLES = ['bases', 'base_pieces', 'base_areas', 'ready_designs', 'ready_parts', 'fonts', 'palettes', 'palette_colours', 'features'] as const;

/** Rows whose `app` is this app's, now. */
const ownRows = (app: string) => ({ reach: 'all', while: { column: 'app', in: [app] } }) as const;
/** The starter fonts: the install's, no app's. */
const starterRows = { reach: 'all', while: { column: 'starter', in: [true] } } as const;

/**
 * An app owner's grant on one set-up table, kept to that app's own rows, as
 * an app's `roles[].tables` entry writes it: the actions and columns
 * `APP_GRANTS` allows; a new row only tagged with `app` (and a new font
 * never a starter); a read, a change and a removal only of rows tagged with
 * it, and, on the fonts, a read and a change of the starter fonts too. A
 * base is never removed.
 */
export function ownSetUp(app: string, table: (typeof SET_UP_TABLES)[number]) {
  const grants = APP_GRANTS[table]!;
  const own = ownRows(app);
  const mine = table === 'fonts' ? [own, starterRows] : own;
  return {
    addOn: 'customiser',
    table,
    actions: [...grants.actions],
    limit: {
      creatable: [...grants.creatable!],
      creatableValues: table === 'fonts' ? { app: [app], starter: [false] } : { app: [app] },
      writable: [...grants.writable!],
      rows: { read: mine, update: mine, ...(grants.actions.includes('delete') ? { delete: own } : {}) },
    },
  };
}

/** The settings, read and changed: the install's one row. */
export function ownSettings() {
  return { addOn: 'customiser', table: 'settings', actions: ['read', 'update'], limit: { writable: [...SETTINGS_WRITABLE] } };
}

/** A read of the customers' designs (with their words, logo and photo where `pii`), of this app's customers alone. */
export function ownDesigns(app: string, pii: boolean) {
  return { addOn: 'customiser', table: 'designs', actions: pii ? ['read', 'read_pii'] : ['read'], limit: { rows: { read: ownRows(app) } } };
}

/**
 * What a role that makes the proof and the files on the order-line panel
 * holds, of this app's customers alone: their designs with their words and
 * pictures; a version added (tagged with the app) and its proof set; its
 * files made, attached and replaced; the settings and the shop's set-up
 * read, which hold nobody's personal data.
 */
export function ownPanel(app: string) {
  const own = ownRows(app);
  const versions = APP_GRANTS['design_versions']!;
  const files = APP_GRANTS['version_files']!;
  return [
    ownDesigns(app, true),
    { addOn: 'customiser', table: 'design_versions', actions: [...versions.actions], limit: { creatable: [...versions.creatable!], creatableValues: { app: [app] }, writable: [...versions.writable!], rows: { read: own, update: own } } },
    { addOn: 'customiser', table: 'version_files', actions: [...files.actions], limit: { creatable: [...files.creatable!], creatableValues: { app: [app] }, writable: [...files.writable!], rows: { read: own, update: own, delete: own } } },
    { addOn: 'customiser', table: 'settings', actions: ['read'] },
    ...SET_UP_TABLES.map((table) => ({ addOn: 'customiser', table, actions: ['read'] })),
  ];
}
