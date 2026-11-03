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
 *   colours, priced features, and the fonts.
 * - Anyone may save a design, behind the human check and the limits on a
 *   stranger's create. The answer is the design's code, which the app's order
 *   line looks the design up by. Nobody reads a design through the shop's
 *   key: a table anyone may add to is never one anyone may read.
 * - A saved design opens again only by its private link, on the add-on's own
 *   link key, which reads that one design and nothing else.
 *
 * TODO(J1): `uploads` on the designs entry, so a guest's logo or photo can
 * ride the create into `designs.logo_file` / `photo_file`. TODO(J10): `assets`, so the shop's
 * fonts and SVG pieces are served to every visitor.
 */
type Entry = Record<string, unknown>;

/** The add-on's one link key: a saved design's private link. */
export const LINK_KEY = 'customiser-link';

/** What a visitor may write into a new design. */
export const DESIGN_WRITABLE = ['format', 'ready_design_id', 'base_id', 'values', 'email'] as const;

/** What a visitor reads of a design opened by its link. */
export const DESIGN_OPENED = ['id', 'code', 'format', 'ready_design_id', 'base_id', 'values', 'logo_file', 'photo_file', 'state', 'last_changed_at'] as const;

const published = [{ column: 'state', op: 'eq', value: 'published' }];
const read = (table: string, select: readonly string[], extra: Entry = {}): Entry => ({ table, methods: ['GET'], select: [...select], appColumn: 'app', ...extra });

export function entries(): Entry[] {
  return [
    read('bases', ['id', 'name', 'kind', 'width_mm', 'height_mm', 'depth_mm', 'corner_mm', 'bleed_mm', 'safe_mm', 'sides', 'back_feature_id', 'material', 'thickness_mm', 'outline_file', 'position'], { filters: published }),
    read('base_pieces', ['id', 'base_id', 'code', 'name', 'width_mm', 'height_mm', 'layers', 'position']),
    read('base_areas', ['id', 'base_id', 'code', 'name', 'side', 'piece_id', 'face', 'shape', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'takes', 'required', 'rules', 'feature_id', 'position']),
    read('ready_designs', ['id', 'base_id', 'name', 'tags', 'layouts', 'preview_file', 'position'], { filters: published, pictures: ['preview_file'] }),
    read('ready_parts', ['id', 'ready_design_id', 'code', 'name', 'kind', 'locked', 'required', 'side', 'layout', 'area_id', 'piece_id', 'x_mm', 'y_mm', 'w_mm', 'h_mm', 'rules', 'value', 'feature_id', 'position']),
    /*
     * FONTS ARE READ BY EVERY VISITOR OF EVERY APP ON THE INSTALL. The starter
     * set is written once at install, for no app in particular, so a row held
     * to its app would hide it from both shops. A font is a typeface and its
     * licence, nothing personal and nothing a shop keeps from another; a part
     * offers the fonts its rules name, so another shop's upload is never
     * offered by this shop's designs.
     */
    { table: 'fonts', methods: ['GET'], select: ['id', 'family', 'name', 'style', 'weights', 'licence', 'starter', 'smallest_mm', 'file'], filters: [{ column: 'active', op: 'eq', value: true }] },
    read('palettes', ['id', 'ready_design_id', 'kind', 'code', 'name', 'position']),
    read('palette_colours', ['id', 'palette_id', 'code', 'role', 'name', 'hex', 'position']),
    read('features', ['id', 'code', 'name'], { filters: [{ column: 'active', op: 'eq', value: true }] }),
    {
      table: 'designs',
      methods: ['POST'],
      writable: [...DESIGN_WRITABLE],
      select: ['id', 'code', 'format', 'state'],
      humanCheck: true,
      appColumn: 'app',
      anonymous: { perValue: { columns: ['email'], n: 20 }, perKeyHour: 600, perIpHour: 30 },
    },
    {
      table: 'designs',
      key: LINK_KEY,
      methods: ['GET'],
      select: [...DESIGN_OPENED],
      claim: { by: 'token', column: 'link_token' },
      files: ['logo_file', 'photo_file'],
    },
  ];
}
