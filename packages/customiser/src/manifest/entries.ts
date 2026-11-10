/**
 * WHAT A SHOP'S VISITORS MAY DO WITH THE CUSTOMISER'S TABLES.
 *
 * These are the add-on's own public entries. Each one with no `key` rides the
 * customer key of every app the add-on is attached to, and is held to that
 * app's rows by `appColumn`: a visitor of one shop never reads another shop's
 * bases, and a design saved through a shop's key is that shop's, whatever the
 * browser sends. The owner allows them on the install's check.
 *
 * - Everyone reads what a shop offers: its published bases and their pieces
 *   and areas, its shown ready-made designs and their parts, its palettes,
 *   colours, priced features, the fonts, and the figures its checks read.
 * - Anyone may save a design, behind the human check and the limits on a
 *   stranger's create, with the logo or photo they uploaded for it. The
 *   answer is the design's code, which the app's order line looks the design
 *   up by, and the design's own link, handed once to whoever saved it.
 * - That link, on the add-on's own link key, opens that one design and
 *   nothing else, from any device: it reads the design and changes it in
 *   place while it is a draft, so a customer who comes back keeps one design
 *   and one code. The customer may also delete it there while it is a
 *   draft, its logo and photo with it. Once ordered, the design is the
 *   order's: it still reads, and never changes or goes. The address it is
 *   mailed to is never changed through it.
 * - Whoever a shop signed in (a guest who found their order again) opens a
 *   design by its own code, the one the order's line holds: one design of
 *   that shop, never a list, and the code is never shown back. Nobody else
 *   reads a design through a shop's key: a table anyone may add to is never
 *   one anyone may read.
 *
 * - The shop's outlines, pieces and fonts are served to every visitor as
 *   files (`assets`): a font a part offers, the outline a preview draws. A
 *   customer's logo or photo is never one: it is private, handed back only to
 *   the design's own link, as a download.
 */
type Entry = Record<string, unknown>;

/** The add-on's one link key: a saved design's private link. */
export const LINK_KEY = 'customiser-link';

/** What a customer may upload into a design: the logo and the photo. */
export const DESIGN_UPLOADS = ['logo_file', 'photo_file'] as const;

/** What a visitor may write into a new design. */
export const DESIGN_WRITABLE = ['format', 'ready_design_id', 'base_id', 'values', ...DESIGN_UPLOADS, 'email'] as const;

/** What the design's own link may change, while it is a draft: all a visitor wrote, but the address the link is mailed to. */
export const DESIGN_CHANGEABLE = DESIGN_WRITABLE.filter((ref) => ref !== 'email');

/** What a visitor reads of a design opened by its link. */
export const DESIGN_OPENED = ['id', 'code', 'format', 'ready_design_id', 'base_id', 'values', 'logo_file', 'photo_file', 'state', 'updated_at'] as const;

/** What a guest the shop signed in reads of a design opened by its code: what makes it up, never the code itself. */
export const DESIGN_BY_CODE = ['id', 'format', 'ready_design_id', 'base_id', 'values', 'state', 'updated_at'] as const;

const published = [{ column: 'state', op: 'eq', value: 'published' }];
const read = (table: string, select: readonly string[], extra: Entry = {}): Entry => ({ table, methods: ['GET'], select: [...select], appColumn: 'app', ...extra });

export function entries(): Entry[] {
  return [
    read('bases', ['id', 'app', 'name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'model_file', 'faces', 'offered', 'position'], { filters: published, assets: ['outline_file', 'model_file'] }),
    read('base_pieces', ['id', 'base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'file', 'position'], { assets: ['file'] }),
    read('base_areas', ['id', 'base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position']),
    read('ready_designs', ['id', 'base_id', 'name', 'tags', 'layouts', 'preview_file', 'position'], { filters: published, pictures: ['preview_file'] }),
    read('ready_parts', ['id', 'ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position']),
    /*
     * FONTS ARE READ BY EVERY VISITOR OF EVERY APP ON THE INSTALL. The starter
     * set is written once at install, for no app in particular, so a row held
     * to its app would hide it from both shops. A font is a typeface and its
     * licence, nothing personal and nothing a shop keeps from another; a part
     * offers the fonts its rules name, so another shop's upload is never
     * offered by this shop's designs. Each font says whose it is (`app`, empty
     * for a starter font), as each base does: the full editor offers the
     * starter fonts and its own app's, never another app's.
     */
    { table: 'fonts', methods: ['GET'], select: ['id', 'app', 'family', 'name', 'style', 'weights', 'licence', 'starter', 'smallest_mm', 'file'], filters: [{ column: 'active', op: 'eq', value: true }], assets: ['file'] },
    read('palettes', ['id', 'ready_design_id', 'kind', 'code', 'name', 'position']),
    read('palette_colours', ['id', 'palette_id', 'code', 'role', 'name', 'hex', 'position']),
    read('features', ['id', 'code', 'name'], { filters: [{ column: 'active', op: 'eq', value: true }] }),
    /*
     * THE FIGURES THE CUSTOMER'S CHECKS READ: the sharpness a picture needs at
     * its printed size, the finest line the machine keeps, and where light
     * becomes dark to start with. The same figures the design question reads,
     * so the advice a customer sees is the advice the server gives. One row for
     * the install, held to no app (as the fonts are): numbers, nothing personal.
     */
    { table: 'settings', methods: ['GET'], select: ['min_dpi', 'smallest_line_mm', 'one_colour_threshold'] },
    {
      table: 'designs',
      methods: ['POST'],
      writable: [...DESIGN_WRITABLE],
      uploads: [...DESIGN_UPLOADS],
      select: ['id', 'code', 'format', 'state'],
      humanCheck: true,
      appColumn: 'app',
      anonymous: { perValue: { columns: ['email'], n: 20 }, perKeyHour: 600, perIpHour: 30 },
      // The reply carries the new design's own link, once: the page that saved it keeps changing it with no claim.
      shareLink: 'link_token',
    },
    // A design read by its own code, by a guest the shop signed in: the code an order line holds.
    { table: 'designs', methods: ['GET'], select: [...DESIGN_BY_CODE], appColumn: 'app', level: 'lookup', unlockBy: { header: true, column: 'code', self: true, length: 16 } },
    {
      table: 'designs',
      key: LINK_KEY,
      // Read, changed while a draft, and deleted by its holder while a draft (its files to the bin): an ordered design answers as gone.
      methods: ['GET', 'PATCH', 'DELETE'],
      select: [...DESIGN_OPENED],
      writable: [...DESIGN_CHANGEABLE],
      uploads: [...DESIGN_UPLOADS],
      writableWhen: { state: ['draft'] },
      claim: { by: 'token', column: 'link_token', own: true, address: 'email' },
      files: [...DESIGN_UPLOADS],
    },
  ];
}
